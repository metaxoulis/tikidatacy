import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {faLivePredictor,faLiveEvidence,faCachedLiveStats,faRefreshLiveStats} from '../frontend/football-primary.mjs';

const fitted={tier:'team',mu_home:1.5,mu_away:1.2};
// Nice – Rennes, 2026-10-30, 70th minute.
const game={id:'football-api-743470',match_id:743470,status:'2ND',minute:70,home_score:4,away_score:2};
const stats=[{type:'expected_goals',home:3.35,away:2.44},{type:'shots_on_target',home:7,away:6},{type:'red_cards',home:0,away:0}];

test('with xG, each team keeps its history but leans towards its in-match xG rate as time passes',()=>{
 const plain=faLivePredictor(game,null,fitted),live=faLivePredictor(game,null,fitted,stats);
 assert.equal(plain.live_stats_applied,false);assert.deepEqual(plain.scoring_rates.used,{home:1.5,away:1.2});
 assert.equal(live.live_stats_applied,true);assert.equal(live.live_evidence.method,'provider_xg_shrinkage');
 assert.ok(Math.abs(live.scoring_rates.used.home-(1.5*180+90*3.35)/250)<1e-12);
 assert.ok(Math.abs(live.scoring_rates.used.away-(1.2*180+90*2.44)/250)<1e-12);
 assert.ok(live.over25===100||live.remaining_expected_goals.home>plain.remaining_expected_goals.home,'an open match keeps more goals to come');
 const early=faLivePredictor({...game,minute:10,home_score:0,away_score:0},null,fitted,[{type:'expected_goals',home:1.2,away:0}]);
 assert.ok(Math.abs(early.scoring_rates.used.home-(1.5*180+90*1.2)/190)<1e-12,'after ten minutes the match weighs 10/190 of the rate');
 assert.ok(early.p1>faLivePredictor({...game,minute:10,home_score:0,away_score:0},null,fitted).p1);
 assert.equal(faLivePredictor(game,null,fitted,[]).live_stats_applied,false,'no statistics, no change');
 assert.deepEqual(faLivePredictor(game,null,fitted,null).p1,plain.p1);
});

test('without xG, shots and the rest move only the split between the teams, at most 30%',()=>{
 const g={...game,minute:60,home_score:0,away_score:0};
 const e=faLiveEvidence([{type:'shots_on_target',home:8,away:1},{type:'attempts_on_goal',home:15,away:4},{type:'corners',home:7,away:2},{type:'possesion',home:64,away:36}],60);
 assert.equal(e.method,'shot_share_shift');assert.ok(e.split>0&&e.split<=.26);
 assert.deepEqual(e.metrics,['shots_on_target','attempts_on_goal','corners','possesion']);
 const p=faLivePredictor(g,null,fitted,[{type:'shots_on_target',home:8,away:1},{type:'attempts_on_goal',home:15,away:4}]);
 const r=p.scoring_rates.used;assert.ok(r.home>1.5&&r.away<1.2);assert.ok(Math.abs(r.home*r.away-1.8)<1e-9,'total scoring stays as history says');
 const flood=faLiveEvidence([{type:'shots_on_target',home:40,away:0},{type:'attempts_on_goal',home:60,away:0},{type:'red_cards',home:0,away:2}],80);
 assert.equal(flood.split,.26);
 assert.equal(faLiveEvidence([{type:'shots_on_target',home:2,away:0}],5).split<faLiveEvidence([{type:'shots_on_target',home:2,away:0}],30).split,true,'ramped in over 30 minutes');
});

test('a red card moves the split towards the side with more players',()=>{
 const e=faLiveEvidence([{type:'expected_goals',home:.8,away:.7},{type:'red_cards',home:1,away:0}],40);
 assert.equal(e.method,'provider_xg_shrinkage');assert.ok(Math.abs(e.split+.16)<1e-12);assert.ok(e.metrics.includes('red_cards'));
 const p=faLivePredictor({...game,minute:40,home_score:0,away_score:0},null,fitted,[{type:'expected_goals',home:.8,away:.7},{type:'red_cards',home:1,away:0}]);
 const q=faLivePredictor({...game,minute:40,home_score:0,away_score:0},null,fitted,[{type:'expected_goals',home:.8,away:.7},{type:'red_cards',home:0,away:0}]);
 assert.ok(p.p2>q.p2&&p.p1<q.p1);
 assert.equal(faLiveEvidence([{type:'expected_goals',home:-1,away:2}],40),null,'implausible values are ignored');
});

const sql=f=>readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8');
function d1(sqlite){
 return {prepare(q){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(q).get(...args)||null},
  async all(){return {results:sqlite.prepare(q).all(...args)}},async run(){return sqlite.prepare(q).run(...args)}}}};
}
const NOW=Date.parse('2026-10-31T15:00:00Z');
function env(){
 const trial=new DatabaseSync(':memory:');trial.exec(sql('20261028_football_trial.sql'));
 const put=trial.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)');
 put.run('statistics-11',JSON.stringify(stats),NOW-60000);put.run('statistics-12',JSON.stringify(stats),NOW-600000);put.run('statistics-13',JSON.stringify(stats),NOW-60000);
 return {trial,FOOTBALL_TRIAL_DB:d1(trial),FOOTBALL_API_KEY:'k',FOOTBALL_API_KEY_SECRET:'s'};
}
const games=[{match_id:11,status:'1ST'},{match_id:12,status:'2ND'},{match_id:13,status:'NS'},{match_id:14,status:'HT'},{match_id:null,status:'2ND'}];

test('live forecasts read only recent statistics of live matches from the shared cache',async()=>{
 const m=await faCachedLiveStats(env(),games,NOW);
 assert.deepEqual([...m.keys()],[11],'8-minute-old data at most, never for a match not yet started');
 assert.equal(m.get(11).stats[0].type,'expected_goals');
 assert.equal((await faCachedLiveStats({},games,NOW)).size,0);
});

test('live matches nobody has open are refreshed in the background every five minutes, a few at a time',async()=>{
 const e=env(),asked=[];
 const cached=await faCachedLiveStats(e,games,NOW);
 await faRefreshLiveStats(e,games,cached,NOW,async u=>{asked.push(new URL(u).pathname+'?'+new URL(u).searchParams.get('match_id'));return Response.json({success:true,data:stats})});
 assert.deepEqual(asked.sort(),['/statistics/matches.json?12','/statistics/matches.json?14']);
 const many=Array.from({length:20},(_,i)=>({match_id:100+i,status:'2ND'}));let n=0;
 await faRefreshLiveStats(e,many,new Map(),NOW,async()=>{n++;return Response.json({success:true,data:stats})});
 assert.equal(n,8);
});
