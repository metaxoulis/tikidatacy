import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {POSTMATCH_PILOT,postmatchHistory,postmatchStatistics,postmatchPage} from '../frontend/postmatch-statistics.mjs';
const p=POSTMATCH_PILOT[0];
const final={id:p.id,status:'FINISHED',date:p.day,scheduled:'19:45',competition:{id:p.competition},home:{id:p.team,name:p.home},away:{id:p.awayTeam,name:p.away},scores:{score:'3 - 1'}};
test('history must prove the exact finished match, date, competition and both team IDs',()=>{
 assert.equal(postmatchHistory({match:[final]},p).home_score,3);
 for(const patch of [{id:1},{status:'IN PLAY'},{date:'2026-10-28'},{competition:{id:1}},{away:{id:7,name:'Other'}}])
  assert.throws(()=>postmatchHistory({match:[{...final,...patch}]},p),/final_result_unavailable/);
});
function env(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/20261028_football_trial.sql',import.meta.url),'utf8'));
 // Existing live snapshot must never satisfy the postmatch request.
 sqlite.prepare('INSERT INTO football_trial_cache(cache_key,payload_json,fetched_at) VALUES(?,?,?)').run('statistics-'+p.id,JSON.stringify([{type:'corners',home:999,away:999}]),Date.now());
 const db={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async run(){return sqlite.prepare(sql).run(...args)}}}};
 return {FOOTBALL_API_KEY:'test-key',FOOTBALL_API_KEY_SECRET:'test-secret',FOOTBALL_TRIAL_DB:db};
}
test('only final history unlocks a fresh stats snapshot; repeat visitors share it; unknown IDs make no calls',async t=>{
 const saved=globalThis.fetch;t.after(()=>globalThis.fetch=saved);const calls=[];
 globalThis.fetch=async u=>{const url=new URL(u);calls.push(url.pathname);return Response.json({success:true,data:url.pathname.includes('/history')?{match:[final]}:[{type:'corners',home:0,away:null},{type:'possesion',home:44,away:56}]})};
 const e=env(),req=new Request('https://example.test/api/transparency/statistics/'+p.id);
 const d=await(await postmatchStatistics(req,e,p.id)).json();
 assert.equal(d.capture_phase,'postmatch');assert.equal(d.match.status,'FINISHED');
 assert.deepEqual(d.statistics.find(s=>s.type==='corners'),{type:'corners',label:'Κόρνερ',home:0,away:null,unit:''});
 assert(!JSON.stringify(d).includes('test-secret'));assert(!JSON.stringify(d).includes('999'));
 await postmatchStatistics(req,e,p.id);assert.equal(calls.length,2);
 assert.equal((await postmatchStatistics(req,e,999)).status,404);assert.equal(calls.length,2);
});
test('unfinished or missing result never fetches or displays final statistics',async t=>{
 const saved=globalThis.fetch;t.after(()=>globalThis.fetch=saved);let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({success:true,data:{match:[{...final,status:'IN PLAY'}]}})};
 const response=await postmatchStatistics(new Request('https://example.test'),env(),p.id);
 assert.equal(response.status,503);assert.equal(calls,1);
});
test('public pages whitelist the three matches and render statistics without forecasts',async()=>{
 assert.equal(postmatchPage(999).status,404);
 const html=await postmatchPage(p.id).text();assert.match(html,/Στατιστικά αγώνα/);assert.doesNotMatch(html,/prediction|probabilit|Πρόβλεψη|1Χ2/i);
 const ui=readFileSync(new URL('../frontend-v13/mobile-ui.js',import.meta.url),'utf8');
 assert.match(ui,/target="_blank" rel="noopener noreferrer"/);
});

test('pilot section renders in both languages and has exactly three new-tab links',()=>{
 const ui=readFileSync(new URL('../frontend-v13/mobile-ui.js',import.meta.url),'utf8');
 const fn=ui.slice(ui.indexOf('function auditStatisticsPilot(){'),ui.indexOf('function transparency(){'));
 for(const locale of ['el','en']){
  const html=vm.runInNewContext(fn+';auditStatisticsPilot()',{window:{__tdLocale:locale},E:String});
  assert.equal((html.match(/target="_blank"/g)||[]).length,3);
  assert.match(html,locale==='el'?/Στατιστικά μετά τον αγώνα/:/Post-match statistics/);
 }
});
