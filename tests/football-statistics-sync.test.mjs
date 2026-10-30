import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {faSyncStatistics,faSyncLineups} from '../frontend/football-primary.mjs';

const sql=f=>readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8');
function d1(sqlite){
 return {prepare(q){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(q).get(...args)||null},
  async all(){return {results:sqlite.prepare(q).all(...args)}},async run(){return sqlite.prepare(q).run(...args)}}},
  async batch(stmts){const out=[];for(const s of stmts)out.push(await s.run());return out}};
}
function env(){
 const tiki=new DatabaseSync(':memory:'),trial=new DatabaseSync(':memory:');
 for(const f of ['20261029_team_badges.sql','20261029_football_training_results.sql','20261030_football_lineups.sql','20261030_football_match_statistics.sql'])tiki.exec(sql(f));
 trial.exec(sql('20261028_football_trial.sql'));
 const result=tiki.prepare("INSERT INTO football_training_results VALUES(?,'epl-2026-27','epl',?,'Home','Away',18,14,1,0,17,19,'t')");
 result.run(101,'2026-11-01');result.run(102,'2026-11-02');result.run(103,'2026-11-03');
 return {tiki,trial,TIKI_DB:d1(tiki),FOOTBALL_TRIAL_DB:d1(trial),FOOTBALL_API_KEY:'private-key',FOOTBALL_API_KEY_SECRET:'private-secret'};
}
const reply=data=>Response.json({success:true,data});
const full=[{type:'possesion',label:'Possession',home:58,away:42},{type:'shots_on_target',label:'Shots on Target',home:6,away:2},
 {type:'corners',label:'Corners',home:7,away:3},{type:'expected_goals',label:'Expected Goals',home:'1.87',away:'0.64'},{type:'fauls',label:'Fouls',home:11,away:null}];
const NOW=Date.parse('2026-11-04T06:00:00Z');
const id=u=>Number(new URL(u).searchParams.get('match_id'));

test('stores the statistics and xG of finished matches, newest first, from one provider request each',async()=>{
 const e=env(),asked=[];
 e.tiki.exec("INSERT INTO football_training_results VALUES(50,'epl-2026-27','epl','2026-08-30','Home','Away',18,14,1,0,17,19,'t')");
 const get=async u=>{asked.push(id(u));return reply(id(u)===102?[]:id(u)===101?full.filter(s=>s.type!=='expected_goals'):full)};
 const r=await faSyncStatistics(e,NOW,get);
 assert.deepEqual(asked.sort(),[101,102,103],'a match older than 60 days is not worth a request');
 assert.deepEqual([r.status,r.stored,r.empty,r.pending],['ok',2,1,3]);
 const row=e.tiki.prepare('SELECT * FROM football_match_statistics WHERE fa_match_id=103').get();
 assert.deepEqual([row.match_date,row.league_key,row.fa_home_id,row.fa_away_id,row.home_xg,row.away_xg],['2026-11-03','epl',17,19,1.87,0.64]);
 assert.deepEqual(JSON.parse(row.stats_json),{possesion:[58,42],shots_on_target:[6,2],corners:[7,3],expected_goals:[1.87,0.64],fauls:[11,null]});
 const noXg=e.tiki.prepare('SELECT home_xg,away_xg FROM football_match_statistics WHERE fa_match_id=101').get();
 assert.deepEqual([noXg.home_xg,noXg.away_xg],[null,null],'a competition without xG keeps its other statistics');
 assert.equal(e.tiki.prepare('SELECT count(*) n FROM football_match_statistics WHERE fa_match_id=102').get().n,0);
 assert.deepEqual(e.tiki.prepare('SELECT fa_match_id,metrics,attempts FROM football_statistics_fetches ORDER BY fa_match_id').all().map(x=>[x.fa_match_id,x.metrics,x.attempts]),
  [[101,4],[102,0],[103,5]].map(([m,n])=>[m,n,1]));
 assert.ok(!JSON.stringify(e.tiki.prepare('SELECT * FROM football_match_statistics').all()).includes('private'),'credentials never reach storage');
});

test('empty answers are retried twelve hours apart, at most three times; stored matches never again',async()=>{
 const e=env();let calls=0;
 const get=async u=>{calls++;return reply(id(u)===102?[]:full)};
 await faSyncStatistics(e,NOW,get);assert.equal(calls,3);
 await faSyncStatistics(e,NOW+3600000,get);assert.equal(calls,3);
 await faSyncStatistics(e,NOW+13*3600000,get);assert.equal(calls,4);
 await faSyncStatistics(e,NOW+26*3600000,get);await faSyncStatistics(e,NOW+39*3600000,get);assert.equal(calls,5);
});

test('statistics cached by a match-page visit are reused, and the lineup sync keeps its own progress',async()=>{
 const e=env(),asked=[];
 e.trial.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)')
  .run('statistics-103',JSON.stringify([{type:'corners',home:4,away:4}]),Date.parse('2026-11-03T21:00:00Z'));
 await faSyncStatistics(e,NOW,async u=>{asked.push(id(u));return reply(full)});
 assert.deepEqual(asked.sort(),[101,102]);
 assert.equal(e.tiki.prepare('SELECT stats_json FROM football_match_statistics WHERE fa_match_id=103').get().stats_json,'{"corners":[4,4]}');
 const lineups=await faSyncLineups(e,NOW,async()=>reply({lineup:{home:{players:[]},away:{players:[]}}}));
 assert.equal(lineups.pending,3,'a stored statistics row does not count as a stored lineup');
});

test('runs are bounded, an exhausted budget leaves matches for later, and missing storage is reported',async()=>{
 const e=env(),asked=[];
 const r=await faSyncStatistics(e,NOW,async u=>{asked.push(id(u));return reply(full)},2);
 assert.deepEqual([asked.sort(),r.pending],[[102,103],2],'the newest matches go first');
 e.trial.exec("INSERT INTO football_trial_usage VALUES('2026-11-04',8500) ON CONFLICT(day_utc) DO UPDATE SET used=8500");
 assert.equal((await faSyncStatistics(e,NOW,async()=>reply(full))).status,'partial');
 assert.equal(e.tiki.prepare('SELECT count(*) n FROM football_statistics_fetches WHERE fa_match_id=101').get().n,0);
 assert.equal((await faSyncStatistics({},NOW)).status,'unavailable');
});

test('the scheduled training stores statistics alongside lineups, after publishing, without failing the run',()=>{
 const w=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
 const body=w.slice(w.indexOf('async function tdRunScheduledTraining('),w.indexOf('async function tdTrainingStatus('));
 const publish=body.indexOf('await env.MATCHIQ_CACHE.put(TD_MODEL_KEY,JSON.stringify(model));'),sync=body.indexOf('faSyncStatistics(env).catch(');
 assert.ok(publish>0&&sync>publish);
 assert.match(body,/football_api_statistics_sync:footballStatistics/);
 assert.match(w,/function faSyncStatistics\(/,'the bundle carries the module code');
});
