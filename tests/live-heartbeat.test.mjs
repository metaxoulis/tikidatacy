import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {faLiveHeartbeat} from '../frontend/football-primary.mjs';
import {faTrialLive,faTrialMatch} from '../frontend/football-trial.mjs';

// Worker helper the module relies on inside the bundle.
globalThis.smAddDay??=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);

const sql=f=>readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8');
function d1(sqlite){
 return {prepare(q){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(q).get(...args)||null},
  async all(){return {results:sqlite.prepare(q).all(...args)}},async run(){return sqlite.prepare(q).run(...args)}}},
  async batch(stmts){for(const s of stmts)await s.run()}};
}
const T0=Date.parse('2026-10-31T16:30:00Z');
const stamp=t=>new Date(t).toISOString().slice(0,19).replace('T',' ');
// Provider rows as /matches/live.json sends them: Premier League (covered), Scottish Championship (not covered).
const row=(id,competition,status,time,changed)=>({id,fixture_id:id+1000,home:{id:id*2,name:'Home '+id},away:{id:id*2+1,name:'Away '+id},
 competition:{id:competition,name:competition===2?'Premier League':'Championship'},country:{name:competition===2?'England':'Scotland'},
 status,time,scores:{score:'1 - 0'},added:'2026-10-31 14:50:00',scheduled:'15:00',last_changed:stamp(changed),location:''});
function setup({live=[],fixtures=[]}={}){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql('20261028_football_trial.sql'));
 const env={FOOTBALL_TRIAL_DB:d1(sqlite),FOOTBALL_API_KEY:'k',FOOTBALL_API_KEY_SECRET:'s'},calls=[];
 let t=T0;const clock=()=>t,sleep=async ms=>{t+=ms};
 const fetcher=async u=>{const url=new URL(u);calls.push(url.pathname);t+=2000;
  if(url.pathname==='/fixtures/list.json')return Response.json({success:true,data:{fixtures:url.searchParams.get('competition_id')==='2'?fixtures:[]}});
  if(url.pathname==='/matches/live.json')return Response.json({success:true,data:{match:live}});
  return Response.json({success:true,data:[{type:'expected_goals',home:1.1,away:.4}]});
 };
 return {env,sqlite,calls,fetcher,clock,sleep,advance:ms=>{t+=ms}};
}

test('while covered matches are on, the heartbeat refreshes the feed twice a minute and their statistics once',async()=>{
 const live=[row(1,2,'IN PLAY','62',T0-60000),row(2,2,'ADDED TIME','90+',T0-120000),row(3,40,'IN PLAY','70',T0-30000),row(4,2,'IN PLAY','30',T0-600000)];
 const s=setup({live});
 s.sqlite.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)').run('live-primary-v2',JSON.stringify(live.map(faTrialMatch)),T0-60000);
 const r=await faLiveHeartbeat(s.env,s.fetcher,s.clock,s.sleep);
 assert.equal(r.status,'ok');assert.equal(r.live_refreshes,2);
 assert.equal(s.calls.filter(p=>p==='/matches/live.json').length,2,'at the start and half way through the minute');
 assert.deepEqual(s.calls.filter(p=>p==='/statistics/matches.json').length,2,'covered, not frozen: matches 1 and 2 only');
 assert.equal(r.live_matches,2);assert.equal(r.statistics_refreshed,2);assert.deepEqual(r.errors,[]);
 const again=setup({live:[row(1,2,'IN PLAY','62',T0-60000)]});
 again.sqlite.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)').run('live-primary-v2',JSON.stringify([row(1,2,'IN PLAY','62',T0-60000)].map(faTrialMatch)),T0-60000);
 again.sqlite.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)').run('statistics-1','[]',T0-60000);
 await faLiveHeartbeat(again.env,again.fetcher,again.clock,again.sleep);
 assert.equal(again.calls.filter(p=>p==='/statistics/matches.json').length,0,'statistics younger than three minutes are kept');
});

test('with nothing on and no kick-off within 15 minutes, the heartbeat makes no live request',async()=>{
 const s=setup({live:[row(3,40,'IN PLAY','70',T0-30000)],fixtures:[{id:900,date:'2026-10-31',time:'17:30:00',home:{id:10,name:'Arsenal'},away:{id:11,name:'Chelsea'},competition:{id:2,name:'Premier League'},country:{name:'England'}}]});
 s.sqlite.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)').run('live-primary-v2','[]',T0-60000);
 const r=await faLiveHeartbeat(s.env,s.fetcher,s.clock,s.sleep);
 assert.equal(r.status,'idle');assert.equal(s.calls.includes('/matches/live.json'),false);
 assert.ok(s.calls.includes('/fixtures/list.json'),'the schedule is kept warm');
 const soon=setup({fixtures:[{id:900,date:'2026-10-31',time:'16:40:00',home:{id:10,name:'Arsenal'},away:{id:11,name:'Chelsea'},competition:{id:2,name:'Premier League'},country:{name:'England'}}]});
 soon.sqlite.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)').run('live-primary-v2','[]',T0-60000);
 assert.equal((await faLiveHeartbeat(soon.env,soon.fetcher,soon.clock,soon.sleep)).status,'ok','ten minutes before kick-off it starts');
});

test('a slow or failed provider keeps the last known live matches; a copy over 15 minutes old hides them',async()=>{
 const s=setup();
 const m={id:1,home:'Home',away:'Away',status:'IN PLAY',provider_updated_at:new Date(T0-120000).toISOString()};
 s.sqlite.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at,retry_after) VALUES(?,?,?,?)').run('live-primary-v2',JSON.stringify([m]),T0,T0+999999);
 const ten=(await faTrialLive(s.env,90000,{},s.fetcher,T0+600000)).matches;
 assert.equal(ten[0].source_stale,false,'judged at the time the feed was fetched, not now');
 assert.equal((await faTrialLive(s.env,90000,{},s.fetcher,T0+960000)).matches[0].source_stale,true);
});

test('the deployed scheduler minute call and a direct call both reach the heartbeat',()=>{
 const w=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
 assert.match(w,/pathname==='\/api\/internal\/live-refresh'\)\{if\(req\.method!=='POST'\|\|!await tdTrainingAuthorized\(req,env\)\)/);
 assert.match(w,/pathname==='\/api\/internal\/sportmonks-archive'\)\{if\(!await tdTrainingAuthorized\(req,env\)\)return new Response\('Not Found',\{status:404\}\);\/\*[^*]*\*\/await faLiveHeartbeat\(env\)/);
 const scheduler=readFileSync(new URL('../workers/history-scheduler.js',import.meta.url),'utf8');
 assert.match(scheduler,/event\.cron==='\* \* \* \* \*'\?runLiveHeartbeat\(env\)/);
});

test('the live feed is requested for the covered competitions only, never the whole world',async()=>{
 const live=[row(1,2,'IN PLAY','62',T0-60000)],s=setup({live}),asked=[];
 s.sqlite.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)').run('live-primary-v2',JSON.stringify(live.map(faTrialMatch)),T0-60000);
 await faLiveHeartbeat(s.env,async u=>{const url=new URL(u);if(url.pathname==='/matches/live.json')asked.push(url.searchParams.get('competition_id'));return s.fetcher(u)},s.clock,s.sleep);
 assert.equal(asked.length,2);
 assert.deepEqual(asked[0].split(',').map(Number).sort((a,b)=>a-b),[1,2,3,4,5,9,44,150,167,171,244,245,334,446],'leagues, UEFA and the known domestic cups (334 is the Copa del Rey)');
});
