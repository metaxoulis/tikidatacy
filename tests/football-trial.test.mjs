import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {faTrialMatch,faTrialEvents,faTrialLineups,faTrialCached,faTrialRoute,faTrialSourceStale,FA_TRIAL_CAP} from '../frontend/football-trial.mjs';
const raw={id:99,fixture_id:8,home:{id:5,name:'Home'},away:{id:6,name:'Away'},competition:{id:9,name:'Cup'},country:{name:'Greece'},status:'IN PLAY',time:'63',scores:{score:'2 - 1'},last_changed:'2026-10-28 19:00:00',events:'https://api.football-api.com/x?key=private&secret=private'};
function env(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/20261028_football_trial.sql',import.meta.url),'utf8'));
 return {FOOTBALL_API_KEY:'private-key',FOOTBALL_API_KEY_SECRET:'private-secret',FOOTBALL_TRIAL_DB:{
  prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async run(){return sqlite.prepare(sql).run(...args)}}},
  async batch(stmts){const out=[];for(const s of stmts)out.push(await s.run());return out}
 },sqlite};
}
test('provider IDs and untrusted URLs cannot leak into normalized match identity',()=>{
 const m=faTrialMatch(raw);assert.equal(m.id,'football-api-99');assert.equal(m.fixture_id,8);assert.equal(m.home_score,2);assert.equal(m.provider_updated_at,'2026-10-28T19:00:00Z');
 assert.ok(!JSON.stringify(m).includes('private'));assert.equal(faTrialMatch({...raw,away:{id:5,name:'Other'}}),null);
 assert.equal(faTrialMatch({...raw,scores:{score:''}}).home_score,null);
 assert.equal(faTrialSourceStale(m,Date.parse('2026-10-28T19:02:00Z')),true);
 assert.equal(faTrialSourceStale({...m,status:'FINISHED'},Date.parse('2026-10-29T19:02:00Z')),false);
});
test('events retain chronology and side, and lineup roles preserve unknown data',()=>{
 const e=faTrialEvents({event:[{id:1,event:'GOAL',player:{name:'P'},time:55,is_home:true,sort:2},{id:2,event:'RED_CARD',time:40,is_away:true,sort:1}]});
 assert.equal(e[0].type,'RED_CARD');assert.equal(e[0].side,'away');assert.equal(e[1].minute,'55');
 const l=faTrialLineups({lineup:{home:{players:[{id:'1',name:'P',substitution:'1',shirt_number:'5'}]}}});
 assert.equal(l.home.players[0].substitute,true);assert.deepEqual(l.away.players,[]);
});
test('global cache lease shares concurrent visitors and never fetches during TTL',async()=>{
 const e=env();let calls=0;const get=async(url,options)=>{assert.equal(options.redirect,'manual');calls++;return Response.json({success:true,data:{match:[raw]}})};
 const normalize=d=>d.match.map(faTrialMatch),now=Date.parse('2026-10-28T19:00:00Z');
 await Promise.all(Array.from({length:20},()=>faTrialCached(e,'live','/matches/live.json',{},30000,normalize,get,now)));
 assert.equal(calls,1);const cached=await faTrialCached(e,'live','/matches/live.json',{},30000,normalize,get,now+1000);
 assert.equal(cached.data[0].home,'Home');assert.equal(calls,1);assert.equal(e.sqlite.prepare('SELECT used FROM football_trial_usage').get().used,1);
});
test('daily reservation is capped atomically, including concurrent resource requests',async()=>{
 const e=env(),now=Date.parse('2026-10-28T19:00:00Z');e.sqlite.prepare('INSERT INTO football_trial_usage VALUES(?,?)').run('2026-10-28',FA_TRIAL_CAP-1);
 let calls=0;const get=async()=>{calls++;return Response.json({success:true,data:[]})};
 const results=await Promise.all(Array.from({length:12},(_,i)=>faTrialCached(e,'events-'+i,'/matches/events.json',{match_id:i},120000,d=>d,get,now)));
 assert.equal(calls,1);assert.equal(e.sqlite.prepare('SELECT used FROM football_trial_usage').get().used,FA_TRIAL_CAP);
 assert.equal(results.filter(r=>r.error==='trial_daily_limit_reached').length,11);
});
test('provider denial counts usage, redacts errors and backs off without retries',async()=>{
 const e=env();let calls=0;const get=async()=>{calls++;return new Response('secret-key',{status:401})};
 const now=Date.parse('2026-10-28T19:00:00Z');const r=await faTrialCached(e,'live','/matches/live.json',{},30000,d=>d,get,now);
 assert.equal(r.error,'provider_access_denied');assert.equal(r.data,null);assert.ok(!JSON.stringify(r).includes('secret-key'));
 await faTrialCached(e,'live','/matches/live.json',{},30000,d=>d,get,now+60000);assert.equal(calls,1);
});
test('trial routes reject mutations and unknown match IDs without provider access',async()=>{
 const e=env();assert.equal((await faTrialRoute(new Request('https://test/api/football-trial/live',{method:'POST'}),e)).status,405);
 assert.equal((await faTrialRoute(new Request('https://test/api/football-trial/match/999'),e)).status,404);
 assert.equal(e.sqlite.prepare('SELECT COUNT(*) AS n FROM football_trial_usage').get().n,0);
});
