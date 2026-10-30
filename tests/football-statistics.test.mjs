import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {faTrialStatistics,faTrialRoute} from '../frontend/football-trial.mjs';
import {faDetailStatistics} from '../frontend/football-primary.mjs';

const stats=[{type:'possesion',label:'Possession',home:69,away:31},{type:'shots_on_target',label:'Shots on Target',home:9,away:5},
 {type:'attacks',label:'Attacks',home:0,away:0},{type:'red_cards',label:'Red Cards',home:0,away:2},{type:'corners',label:'Corners',home:null,away:null},
 {type:'attempts_on_goal',label:'Attempts on Goal',home:'21',away:12},{type:'Bad Type',label:'x',home:1,away:1},{type:'saves',label:'https://x?key=private',home:-1,away:4}];

test('statistics keep whitelisted fields, plain counts and rows with at least one value',()=>{
 const s=faTrialStatistics(stats);
 assert.deepEqual(s.map(x=>x.type),['possesion','shots_on_target','attacks','red_cards','attempts_on_goal','saves']);
 assert.equal(s.find(x=>x.type==='attempts_on_goal').home,21);
 assert.equal(s.find(x=>x.type==='saves').home,null,'negative values are rejected');
 assert.ok(s.every(x=>!('label' in x)),'provider labels are not passed on');assert.ok(!JSON.stringify(s).includes('private'));
 assert.deepEqual(faTrialStatistics([{type:'possesion',label:'Possession',home:140,away:31}]),[]);
 assert.deepEqual(faTrialStatistics(null),[]);
});
test('match page statistics: reading order, possession as %, untracked zero counters hidden, real 0s kept',()=>{
 const d=faDetailStatistics(faTrialStatistics(stats));
 assert.deepEqual([...new Set(d.map(x=>x.type))],['Κατοχή','Σουτ','Σουτ στην εστία','Αποκρούσεις','Κόκκινες κάρτες']);
 assert.deepEqual(d.slice(0,2),[{type:'Κατοχή',code:'possesion',side:'home',value:'69%'},{type:'Κατοχή',code:'possesion',side:'away',value:'31%'}]);
 assert.deepEqual(d.filter(x=>x.type==='Κόκκινες κάρτες').map(x=>x.value),[0,2]);
 assert.deepEqual(faDetailStatistics([{type:'mystery_metric',home:1,away:2}]),[],'unknown types are dropped');
 assert.deepEqual(faDetailStatistics(undefined),[]);
});
function env(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/20261028_football_trial.sql',import.meta.url),'utf8'));
 sqlite.prepare('INSERT INTO football_trial_matches VALUES(?,?,?,?)').run(743157,JSON.stringify({match_id:743157,status:'IN PLAY'}),'2026-10-29T18:00:00Z',0);
 const d1={prepare(q){let a=[];return {bind(...v){a=v;return this},async first(){return sqlite.prepare(q).get(...a)||null},async run(){return sqlite.prepare(q).run(...a)},async all(){return {results:sqlite.prepare(q).all(...a)}}}},
  async batch(s){const o=[];for(const x of s)o.push(await x.run());return o}};
 return {FOOTBALL_API_KEY:'private-key',FOOTBALL_API_KEY_SECRET:'private-secret',FOOTBALL_TRIAL_DB:d1};
}
test('the match route fetches statistics once per cache window and reports them; a refusal leaves events intact',async t=>{
 const real=globalThis.fetch;t.after(()=>{globalThis.fetch=real});
 const seen=[];let refuse=false;
 globalThis.fetch=async u=>{const url=new URL(u);seen.push(url.pathname);
  if(url.pathname==='/statistics/matches.json')return refuse?Response.json({success:false,error:'Your package does not support match statistics'}):Response.json({success:true,data:stats});
  if(url.pathname==='/matches/events.json')return Response.json({success:true,data:{event:[]}});
  return Response.json({success:true,data:{lineup:{}}})};
 const e=env(),req=new Request('https://example.com/api/football-trial/match/743157');
 const body=await(await faTrialRoute(req,e)).json();
 assert.equal(body.match_statistics_available,true);assert.equal(body.statistics.length,6);assert.ok(!JSON.stringify(body).includes('private'));
 await faTrialRoute(req,e);
 assert.equal(seen.filter(p=>p==='/statistics/matches.json').length,1,'cached for all visitors');
 refuse=true;const f=env();
 const denied=await(await faTrialRoute(req,f)).json();
 assert.equal(denied.match_statistics_available,false);assert.deepEqual(denied.statistics,[]);assert.ok(denied.errors.includes('provider_request_rejected'));
 assert.deepEqual(denied.events,[]);
});

test('every statistic label has an English translation in the site language table',()=>{
 const worker=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8'),table=worker.slice(worker.indexOf('LOCALE_JS='),worker.indexOf('LOCALE_JS=')+400000);
 const labels=[...new Set(faDetailStatistics(['possesion','attempts_on_goal','shots_on_target','shots_off_target','shots_blocked','corners','fauls','offsides','saves','yellow_cards','red_cards','penalties','dangerous_attacks','attacks','free_kicks','goal_kicks','throw_ins','substitutions','treatments'].map(type=>({type,home:1,away:2}))).map(x=>x.type))];
 assert.equal(labels.length,19);
 for(const l of labels)assert.ok(table.includes('\\"'+l+'\\":\\"'),'missing translation: '+l);
});
