import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from study import ingest,temporal_split

class StatsBombResearchTest(unittest.TestCase):
    def test_local_snapshot_and_holdout(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);events=base/"events";events.mkdir()
            matches=[
                {"match_id":1,"competition":{"competition_id":9},"season":{"season_id":281},"match_date":"2023-12-01","home_team":{"home_team_name":"A"},"away_team":{"away_team_name":"B"},"home_score":1,"away_score":0},
                {"match_id":2,"competition":{"competition_id":9},"season":{"season_id":281},"match_date":"2024-02-01","home_team":{"home_team_name":"C"},"away_team":{"away_team_name":"D"},"home_score":0,"away_score":0}
            ]
            (base/"matches.json").write_text(json.dumps(matches))
            (events/"1.json").write_text(json.dumps([{"type":{"name":"Shot"},"team":{"name":"A"},"player":{"name":"P"},"minute":13,"shot":{"statsbomb_xg":0.3,"outcome":{"name":"Goal"}}}]))
            out=base/"local.sqlite";self.assertEqual(ingest(base/"matches.json",events,out),2)
            self.assertEqual(temporal_split(out,"2024-01-01")["holdout_matches"],1)
            with sqlite3.connect(out) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM research_shots").fetchone()[0],1)
                self.assertEqual(db.execute("SELECT shot_count FROM research_matches WHERE statsbomb_match_id=1").fetchone()[0],1)
if __name__=="__main__":unittest.main()
