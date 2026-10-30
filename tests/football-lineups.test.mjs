import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {faSyncLineups} from '../frontend/football-primary.mjs';
import {faRecentLineupEvidence} from '../frontend/recent-lineup-evidence.mjs';

const sql=f=>readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8');
function d1(sqlite,log=[]){
 return {prepare(q){let args=[];log.push(q);return {bind(...v){args=v;return this},async first(){return sqlite.prepare(q).get(...args)||null},
  async all(){return {results:sqlite.prepare(q).all(...args)}},async run(){return sqlite.prepare(q).run(...args)}}},
  async batch(stmts){const out=[];for(const s of stmts)out.push(await s.run());return out}};
}
function env(){
 const tiki=new DatabaseSync(':memory:'),trial=new DatabaseSync(':memory:');
 tiki.exec(sql('20261029_team_badges.sql'));tiki.exec(sql('20261029_football_training_results.sql'));tiki.exec(sql('20261030_football_lineups.sql'));
 trial.exec(sql('20261028_football_trial.sql'));
 const result=tiki.prepare("INSERT INTO football_training_results VALUES(?,'epl-2026-27','epl',?,'Home','Away',18,14,1,0,17,19,'t')");
 result.run(101,'2026-11-01');result.run(102,'2026-11-02');result.run(103,'2026-11-03');
 return {tiki,trial,TIKI_DB:d1(tiki),FOOTBALL_TRIAL_DB:d1(trial),FOOTBALL_API_KEY:'private-key',FOOTBALL_API_KEY_SECRET:'private-secret'};
}
const squad=(prefix,first)=>Array.from({length:14},(_,i)=>({id:first+i,name:prefix+' '+(i+1),shirt_number:String(i+1),substitution:i>=11?'1':'0'}));
const lineupReply=(home,away)=>Response.json({success:true,data:{lineup:{home:{team:{name:'Home'},players:home},away:{team:{name:'Away'},players:away}}}});
const NOW=Date.parse('2026-11-04T06:00:00Z');

test('stores starters and bench of finished matches, newest first, from one provider request each',async()=>{
 const e=env(),asked=[];
 e.tiki.exec("INSERT INTO football_training_results VALUES(50,'epl-2026-27','epl','2026-08-30','Home','Away',18,14,1,0,17,19,'t')");
 const get=async u=>{const id=Number(new URL(u).searchParams.get('match_id'));asked.push(id);return id===102?lineupReply([],[]):lineupReply(squad('H',1000),squad('A',2000))};
 const r=await faSyncLineups(e,NOW,get);
 assert.deepEqual(asked.sort(),[101,102,103],'a match older than 60 days is not worth a request');
 assert.deepEqual([r.status,r.stored,r.empty,r.pending],['ok',2,1,3]);
 const rows=e.tiki.prepare('SELECT * FROM football_lineups ORDER BY fa_match_id,fa_team_id').all();
 assert.equal(rows.length,4);
 assert.deepEqual([rows[0].fa_match_id,rows[0].fa_team_id,rows[0].match_date,rows[0].league_key],[101,17,'2026-11-01','epl']);
 assert.equal(JSON.parse(rows[0].starters_json).length,11);
 assert.deepEqual(JSON.parse(rows[0].bench_json)[0],{id:1011,name:'H 12',number:12});
 assert.ok(!JSON.stringify(rows).includes('private'),'credentials never reach storage');
});

test('empty provider lineups are retried at most three times, twelve hours apart; stored ones never again',async()=>{
 const e=env();let calls=0;
 const get=async u=>{calls++;return Number(new URL(u).searchParams.get('match_id'))===102?lineupReply([],[]):lineupReply(squad('H',1000),squad('A',2000))};
 await faSyncLineups(e,NOW,get);assert.equal(calls,3);
 await faSyncLineups(e,NOW+3600000,get);assert.equal(calls,3,'nothing is due an hour later');
 await faSyncLineups(e,NOW+13*3600000,get);assert.equal(calls,4,'only the empty match is asked again');
 await faSyncLineups(e,NOW+26*3600000,get);assert.equal(calls,5);
 await faSyncLineups(e,NOW+39*3600000,get);assert.equal(calls,5,'three attempts, then it is left alone');
 assert.equal(e.tiki.prepare('SELECT attempts FROM football_lineup_fetches WHERE fa_match_id=102').get().attempts,3);
});

test('a lineup cached by a match-page visit on match day is reused; one cached before match day is not',async()=>{
 const e=env(),asked=[];
 const cache=e.trial.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)');
 const payload=JSON.stringify({home:{team:'Home',players:[{id:1,name:'Cached Keeper',number:'1',substitute:false}]},away:{team:'Away',players:[]}});
 cache.run('lineups-103',payload,Date.parse('2026-11-03T21:00:00Z'));
 cache.run('lineups-101',payload,Date.parse('2026-10-31T12:00:00Z'));
 await faSyncLineups(e,NOW,async u=>{asked.push(Number(new URL(u).searchParams.get('match_id')));return lineupReply(squad('H',1000),squad('A',2000))});
 assert.deepEqual(asked.sort(),[101,102]);
 assert.equal(JSON.parse(e.tiki.prepare('SELECT starters_json FROM football_lineups WHERE fa_match_id=103').get().starters_json)[0].name,'Cached Keeper');
});

test('runs are bounded and an exhausted provider budget leaves matches for a later run',async()=>{
 const e=env(),asked=[];
 const get=async u=>{asked.push(Number(new URL(u).searchParams.get('match_id')));return lineupReply(squad('H',1000),squad('A',2000))};
 const r=await faSyncLineups(e,NOW,get,2);
 assert.deepEqual(asked,[103,102]);assert.equal(r.pending,2);
 e.trial.exec("INSERT INTO football_trial_usage VALUES('2026-11-04',8500) ON CONFLICT(day_utc) DO UPDATE SET used=8500");
 const out=await faSyncLineups(e,NOW,get);
 assert.equal(out.status,'partial');assert.equal(asked.length,2);
 assert.equal(e.tiki.prepare('SELECT count(*) n FROM football_lineup_fetches WHERE fa_match_id=101').get().n,0);
 assert.equal((await faSyncLineups({},NOW)).status,'unavailable');
});

test('the scheduled training stores lineups only after publishing the model, and cannot fail because of them',()=>{
 const w=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
 const body=w.slice(w.indexOf('async function tdRunScheduledTraining('),w.indexOf('async function tdTrainingStatus('));
 const publish=body.indexOf('await env.MATCHIQ_CACHE.put(TD_MODEL_KEY,JSON.stringify(model));'),sync=body.indexOf('faSyncLineups(env).catch(');
 assert.ok(publish>0&&sync>publish);
 assert.match(body,/football_api_lineups_sync:footballLineups/);
});

// An archived club (Sportmonks 13258, Football-API 7008) whose stored Football-API games follow the archive.
function archive(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE sm_fixtures(id INTEGER PRIMARY KEY,league_id INTEGER,season_id INTEGER,stage TEXT,round TEXT,starting_at TEXT,state TEXT,
  home_id INTEGER,away_id INTEGER,home_score INTEGER,away_score INTEGER,ht_home INTEGER,ht_away INTEGER,result_info TEXT,venue_id INTEGER,
  home_formation TEXT,away_formation TEXT,leg TEXT,length INTEGER);
  CREATE TABLE sm_lineups(id INTEGER PRIMARY KEY,fixture_id INTEGER,team_id INTEGER,player_id INTEGER,player_name TEXT,jersey_number INTEGER,position_id INTEGER,
  role TEXT,formation_field TEXT,formation_position INTEGER);
  CREATE INDEX sm_fixtures_teams ON sm_fixtures(home_id,away_id);CREATE INDEX sm_lineups_fixture ON sm_lineups(fixture_id);`);
 return db;
}
const XI=[['Unai Simón',1,'1:1',24],['Yuri Berchiche',17,'2:1',25],['Aymeric Laporte',14,'2:2',25],['Dani Vivian',3,'2:3',25],['Jesús Areso',12,'2:4',25],
 ['Mikel Jauregizar',18,'3:1',26],['Oihan Sancet',8,'3:2',26],['Beñat Prados',6,'3:3',26],['Nico Williams',10,'4:1',27],['Maroan Sannadi',21,'4:2',27],['Iñaki Williams',9,'4:3',27]];
function club(){
 const sm=archive(),e=env();
 const fixture=sm.prepare("INSERT INTO sm_fixtures(id,starting_at,state,home_id,away_id,home_formation,away_formation) VALUES(?,?,'FT',?,?,?,?)");
 const player=sm.prepare("INSERT INTO sm_lineups(fixture_id,team_id,player_id,player_name,jersey_number,position_id,role,formation_field) VALUES(?,13258,?,?,?,?,?,?)");
 ['2026-10-04','2026-10-11','2026-10-18','2026-10-25'].forEach((day,i)=>{
  const id=900+i;i%2?fixture.run(id,day+' 16:00:00',1,13258,'4-4-2','4-3-3'):fixture.run(id,day+' 16:00:00',13258,1,'4-3-3','4-4-2');
  XI.forEach(([name,shirt,field,group],n)=>player.run(id,500+n,name,shirt,group,'lineup',field));
  player.run(id,600,'Álex Berenguer',7,27,'bench',null);
 });
 // Football-API spelling; a new striker "K. Newman" has replaced Iñaki Williams.
 const fa=XI.map(([name,shirt],n)=>({id:7000+n,name:n===10?'K. Newman':name[0]+'. '+name.split(' ').slice(1).join(' '),number:n===10?19:shirt}));
 const stored=e.tiki.prepare("INSERT INTO football_lineups VALUES(?,7008,?,'laliga',?,?,'t')");
 ['2026-11-01','2026-11-08','2026-11-22','2026-11-29','2026-12-06','2026-12-13'].forEach((day,i)=>stored.run(3000+i,day,JSON.stringify(fa),JSON.stringify([{id:7100,name:'A. Berenguer',number:7}])));
 return {sm,e};
}

test('stored Football-API games keep the probable XI current and join archived players for their positions',async()=>{
 const {sm,e}=club();
 const ev=await faRecentLineupEvidence(d1(sm),13258,'2026-12-20T15:00:00Z',{db:e.TIKI_DB,teamId:7008});
 assert.equal(ev.matches_observed,8);assert.equal(ev.football_api_matches,6);
 assert.equal(ev.formation,'4-3-3','two archived games are still among the eight newest');
 const names=ev.projected.map(p=>p.name);
 assert.ok(names.includes('K. Newman'),'the new regular starter is in');
 assert.ok(!names.includes('Iñaki Williams'),'the player he replaced is out');
 assert.equal(names.filter(n=>/Sannadi/.test(n)).length,1,'"M. Sannadi" and "Maroan Sannadi" are one player');
 assert.equal(ev.projected.find(p=>p.name==='Maroan Sannadi').position,'Επιθετικός');
 assert.equal(ev.projected.find(p=>p.name==='K. Newman').position,null,'no position is invented for a new player');
 assert.equal(ev.projected[0].position,'Τερματοφύλακας');
 assert.equal(ev.positionFor('M. Sannadi').position,'Επιθετικός');
 assert.equal(ev.positionFor('A. Berenguer',7).position,'Επιθετικός');
 assert.equal(ev.positionFor('K. Newman',19),null);
});

test('positions outlive the archive in the eight-game window; the formation does not',async()=>{
 const {sm,e}=club();
 const stored=e.tiki.prepare("INSERT INTO football_lineups SELECT ?,7008,?,league_key,starters_json,bench_json,observed_at FROM football_lineups WHERE fa_match_id=3000");
 stored.run(3010,'2027-01-10');stored.run(3011,'2027-01-17');
 const ev=await faRecentLineupEvidence(d1(sm),13258,'2027-01-24T15:00:00Z',{db:e.TIKI_DB,teamId:7008});
 assert.equal(ev.football_api_matches,8);assert.equal(ev.formation,null);
 assert.equal(ev.projected.length,11);
 assert.equal(ev.positionFor('M. Jauregizar').position,'Μέσος');
});

test('a club missing from the archive gets no invented XI from stored names alone',async()=>{
 const {e}=club();
 const ev=await faRecentLineupEvidence(null,null,'2026-12-20T15:00:00Z',{db:e.TIKI_DB,teamId:7008});
 assert.equal(ev.matches_observed,6);assert.equal(ev.projected,null,'no keeper can be identified without positions');
 assert.equal(ev.positionFor('M. Sannadi'),null);
});

test('archive lookups use the team-date indexes instead of scanning every fixture',async()=>{
 const sm=archive(),log=[];
 await faRecentLineupEvidence(d1(sm,log),13258,'2026-12-20T15:00:00Z');
 const query=log.find(q=>q.includes('FROM sm_fixtures'));
 assert.doesNotMatch(query,/ OR /);
 const plan=()=>sm.prepare('EXPLAIN QUERY PLAN '+query).all('2026-12-17 15:00:00','2025-07-01 00:00:00',13258).map(r=>r.detail).join(' | ');
 assert.match(plan(),/SCAN sm_fixtures/,'without the migration the away side reads the whole table');
 sm.exec(sql('20261030_sportmonks_archive_team_dates.sql'));
 assert.doesNotMatch(plan(),/SCAN sm_fixtures/);
 assert.match(plan(),/sm_fixtures_home_date/);assert.match(plan(),/sm_fixtures_away_date/);
});

test('before the lineup table exists, match pages still use the archive alone',async()=>{
 const {sm}=club(),bare=new DatabaseSync(':memory:');
 const ev=await faRecentLineupEvidence(d1(sm),13258,'2026-11-01T15:00:00Z',{db:d1(bare),teamId:7008});
 assert.equal(ev.matches_observed,4);assert.equal(ev.football_api_matches,0);assert.equal(ev.formation,'4-3-3');
});
