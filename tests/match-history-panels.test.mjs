import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {faTeamResults,faPrimaryHistory,faSeasonForm} from '../frontend/football-primary.mjs';

const sql=f=>readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8');
function db(withFootballTable=true){
 const s=new DatabaseSync(':memory:');
 s.exec(`CREATE TABLE sportmonks_training_results (fixture_id INTEGER PRIMARY KEY,dataset_slug TEXT NOT NULL,league_key TEXT NOT NULL,match_date TEXT NOT NULL,home_team TEXT NOT NULL,away_team TEXT NOT NULL,home_score INTEGER NOT NULL,away_score INTEGER NOT NULL,observed_at TEXT NOT NULL,home_team_id INTEGER,away_team_id INTEGER);
  CREATE INDEX sportmonks_training_home_id ON sportmonks_training_results(home_team_id,match_date);CREATE INDEX sportmonks_training_away_id ON sportmonks_training_results(away_team_id,match_date);`);
 if(withFootballTable){s.exec(`CREATE TABLE team_badges(fa_team_id INTEGER PRIMARY KEY,team_name TEXT,source_ref TEXT,matched_by TEXT,updated_at TEXT);`);
  s.exec(sql('20261029_football_training_results.sql'));s.exec(sql('20261029_football_training_team_index.sql'));}
 const d1={prepare(q){let a=[];return {bind(...v){a=v;return this},async all(){return {results:s.prepare(q).all(...a)}}}},
  async batch(st){return Promise.all(st.map(x=>x.all()))}};
 return {s,d1};
}
const sm=(s,id,date,h,a,hs,as,slug='seriea-2026-27',league='seriea')=>s.prepare("INSERT INTO sportmonks_training_results VALUES(?,?,?,?,?,?,?,?,'t',?,?)").run(id,slug,league,date,'T'+h,'T'+a,hs,as,h,a);
const fa=(s,id,date,h,a,hs,as,slug='seriea-2026-27',league='seriea')=>s.prepare("INSERT INTO football_training_results VALUES(?,?,?,?,?,?,?,?,?,?,0,0,'t')").run(id,slug,league,date,'T'+h,'T'+a,h,a,hs,as);

test('history merges archive and synced results, counts an overlapping match once, and keeps old head-to-head meetings',async()=>{
 const {s,d1}=db();
 sm(s,1,'2026-10-25',10,30,2,1);            // archive
 fa(s,900,'2026-10-25',10,30,2,1);          // same match synced again: counted once
 fa(s,901,'2026-11-01',40,10,0,3);          // only in Football-API (after the archive ends)
 sm(s,2,'2024-09-01',10,20,1,1,'seriea-2024-25'); // old head-to-head, pushed out of the per-team window below
 for(let i=0;i<70;i++)sm(s,100+i,'2025-'+String(1+i%12).padStart(2,'0')+'-'+String(1+i%28).padStart(2,'0'),10,50+i,1,0,'seriea-2025-26');
 const env={TIKI_DB:d1},legacy={home_id:10,away_id:20};
 const h=await faPrimaryHistory(env,legacy,{date:'2026-11-05T19:00:00Z'});
 assert.equal(h.home[0].id,'football-api-901');assert.equal(h.home[0].result,'W','won 3-0 away');
 assert.equal(h.home.filter(r=>r.date==='2026-10-25').length,1);assert.equal(h.home[1].id,'archived-sportmonks-1');
 assert.equal(h.home.length,8);assert.deepEqual(h.head_to_head.map(r=>r.date),['2024-09-01']);
 assert.equal(h.source,'archived_and_synced_results');
 assert.deepEqual((await faPrimaryHistory(env,null,{date:'2026-11-05'})).home,[]);
});
test('a missing synced-results table still returns the archive history',async()=>{
 const {s,d1}=db(false);sm(s,1,'2026-10-25',10,30,2,1);
 const h=await faPrimaryHistory({TIKI_DB:d1},{home_id:10,away_id:20},{date:'2026-11-05T19:00:00Z'});
 assert.equal(h.home.length,1);
});
test('season form: 2026-27 only, home club at home and away club away, three-day embargo, UEFA split',async()=>{
 const {s,d1}=db();
 sm(s,1,'2026-08-20',10,30,2,0);                                   // home win
 fa(s,902,'2026-10-29',10,31,0,1);                                 // home loss
 sm(s,3,'2026-09-30',10,32,1,1,'ucl-2026-27','ucl');               // UEFA draw at home
 sm(s,4,'2026-05-01',10,33,5,0,'seriea-2025-26');                  // last season: excluded
 fa(s,903,'2026-11-03',10,34,4,0);                                 // inside the 3-day embargo: excluded
 sm(s,5,'2026-09-10',10,35,3,0);sm(s,6,'2026-09-12',36,10,0,0);   // home club away: not its home record
 sm(s,7,'2026-09-20',37,20,1,2);                                   // away club wins away
 const found=await faTeamResults(d1,10,20,'2026-11-06');
 const f=faSeasonForm(found,{home_id:10,away_id:20},Date.parse('2026-11-05T12:00:00Z'));
 assert.equal(f.training_cutoff_exclusive,'2026-11-02');assert.equal(f.source,'stored_final_results');
 assert.deepEqual({p:f.home.played,w:f.home.wins,d:f.home.draws,l:f.home.losses,gf:f.home.goals_for,ga:f.home.goals_against,u:f.home.uefa_matches,dom:f.home.domestic_matches},{p:4,w:2,d:1,l:1,gf:6,ga:2,u:1,dom:3});
 assert.deepEqual({p:f.away.played,w:f.away.wins,venue:f.away.venue},{p:1,w:1,venue:'away'});
 assert.equal(faSeasonForm({rows:[]},{home_id:1,away_id:2}).home,null);
});
test('every panel lookup uses an index, never a full table scan',()=>{
 const {s}=db();
 for(const [table,idCol] of [['sportmonks_training_results','fixture_id'],['football_training_results','fa_match_id']])
  for(const where of ['home_team_id IN (1,2) AND match_date<\'2026-11-01\'','away_team_id IN (1,2) AND match_date<\'2026-11-01\'','((home_team_id=1 AND away_team_id=2) OR (home_team_id=2 AND away_team_id=1)) AND match_date<\'2026-11-01\'']){
   const plan=s.prepare('EXPLAIN QUERY PLAN SELECT '+idCol+' FROM '+table+' WHERE '+where+' ORDER BY match_date DESC LIMIT 60').all().map(r=>r.detail).join(' | ');
   assert.doesNotMatch(plan,/SCAN (?:TABLE )?\w+_training_results(?! USING)/,table+': '+plan);assert.match(plan,/USING (?:COVERING )?INDEX/,plan);
  }
});
