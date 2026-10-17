#!/usr/bin/env python3
"""Research-only StatsBomb Open Data adapter. Never writes to Tiki-Data production databases.

Usage: python3 research/statsbomb/study.py --matches PATH/TO/season.json --events-dir PATH/TO/data/events --out /tmp/statsbomb-research.sqlite
"""
import argparse
import json
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS research_matches (
 statsbomb_match_id INTEGER PRIMARY KEY, competition_id INTEGER, season_id INTEGER,
 utc_date TEXT NOT NULL, home TEXT NOT NULL, away TEXT NOT NULL,
 home_score INTEGER, away_score INTEGER, shot_count INTEGER NOT NULL DEFAULT 0,
 shot_xg_total REAL NOT NULL DEFAULT 0.0, source TEXT NOT NULL DEFAULT 'StatsBomb Open Data'
);
CREATE TABLE IF NOT EXISTS research_shots(
 statsbomb_match_id INTEGER NOT NULL, team TEXT NOT NULL, player TEXT,
 minute INTEGER, shot_xg REAL NOT NULL, is_goal INTEGER NOT NULL,
 PRIMARY KEY(statsbomb_match_id, team, player, minute, shot_xg)
);
CREATE INDEX IF NOT EXISTS idx_research_date ON research_matches(utc_date);
"""

def load_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)

def match_row(match):
    mid=match.get("match_id")
    comp=match.get("competition",{}).get("competition_id")
    season=match.get("season",{}).get("season_id")
    home=match.get("home_team",{}).get("home_team_name")
    away=match.get("away_team",{}).get("away_team_name")
    day=match.get("match_date")
    if not isinstance(mid,int) or not home or not away or not day:
        return None
    score=lambda v: v if isinstance(v,int) and 0<=v<=40 else None
    return mid,comp,season,day,str(home)[:110],str(away)[:110],score(match.get("home_score")),score(match.get("away_score"))

def shot_rows(events,match_id):
    rows=[]
    for e in events:
        if e.get("type",{}).get("name")!="Shot":
            continue
        xg=e.get("shot",{}).get("statsbomb_xg")
        if not isinstance(xg,(int,float)) or not 0<=xg<=1:
            continue
        team=e.get("team",{}).get("name","")[:110]
        player=e.get("player",{}).get("name","")[:110]
        minute=e.get("minute")
        if not team or not isinstance(minute,int):continue
        is_goal=int(e.get("shot",{}).get("outcome",{}).get("name")=="Goal")
        rows.append((match_id,team,player,minute,round(float(xg),7),is_goal))
    return rows

def ingest(matches_file,events_dir,database,max_matches=None):
    matches=load_json(matches_file)
    if not isinstance(matches,list):raise ValueError("Expected StatsBomb matches JSON array")
    dest=Path(database)
    dest.parent.mkdir(parents=True,exist_ok=True)
    count=0
    with sqlite3.connect(dest) as db:
        db.executescript(SCHEMA)
        for item in matches[:max_matches] if max_matches else matches:
            row=match_row(item)
            if row is None:continue
            mid=row[0]
            path=Path(events_dir)/f"{mid}.json"
            shots=shot_rows(load_json(path),mid) if path.is_file() else []
            db.execute("INSERT OR REPLACE INTO research_matches (statsbomb_match_id, competition_id, season_id, utc_date, home, away, home_score, away_score, shot_count, shot_xg_total) VALUES (?,?,?,?,?,?,?,?,?,?)",(*row,len(shots),sum(x[4] for x in shots)))
            db.execute("DELETE FROM research_shots WHERE statsbomb_match_id=?",(mid,))
            db.executemany("INSERT OR IGNORE INTO research_shots VALUES (?,?,?,?,?,?)",shots)
            count+=1
    return count

def temporal_split(database,cutoff):
    """Returns metadata for leakage-safe pre-cutoff training and on/after cutoff evaluation."""
    with sqlite3.connect(database) as db:
        train=db.execute("SELECT COUNT(*) FROM research_matches WHERE utc_date < ?",(cutoff,)).fetchone()[0]
        evaluation=db.execute("SELECT COUNT(*) FROM research_matches WHERE utc_date >= ?",(cutoff,)).fetchone()[0]
    return {"train_before":cutoff,"train_matches":train,"holdout_matches":evaluation}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--matches",required=True,help="Local StatsBomb data/matches/<competition>/<season>.json")
    p.add_argument("--events-dir",required=True,help="Local StatsBomb data/events")
    p.add_argument("--out",required=True,help="Local research SQLite database; NEVER the production D1 DB")
    p.add_argument("--max-matches",type=int,default=None)
    p.add_argument("--holdout-from",help="Date YYYY-MM-DD for temporal split")
    args=p.parse_args()
    n=ingest(args.matches,args.events_dir,args.out,args.max_matches)
    print(f"Imported {n} research-only matches")
    if args.holdout_from:print(temporal_split(args.out,args.holdout_from))

if __name__=="__main__":main()
