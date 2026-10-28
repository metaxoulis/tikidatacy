import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {auditVerdict,auditLocalDay} from '../frontend/transparency.mjs';
const source=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
function harness(){
 const context=vm.createContext({Response,Request,URL,URLSearchParams,Intl,Date,Map,Set,console,fetch:()=>{throw Error('unexpected network')},setTimeout,clearTimeout,Uint8Array,TextEncoder});
 vm.runInContext(source.replace('export default {async fetch(','const worker={async fetch(')+'\nglobalThis.audit=tdTransparency;',context);
 const store=new Map();let reads=0,calls=0;
 // One fixture per audited competition: the first is a stored 0-0 final, the rest are pending schedule rows.
 const fixtures=['epl','laliga','bundesliga','seriea','ligue1','greece','cyprus','ucl','uel','uecl'].map((league_key,i)=>({fixture_id:'football-api-fixture-'+(i+1),league_key,
  kickoff:'2026-10-20T18:00:00Z',home:'Home',away:'Away',home_logo:null,away_logo:null,status:i===0?'FT':'NS',home_score:i===0?0:null,away_score:i===0?0:null,final:i===0}));
 context.tdAuditFixtures=async()=>{calls++;return fixtures};
 const env={MATCHIQ_CACHE:{get:async k=>store.get(k)||null,put:async(k,v)=>store.set(k,JSON.parse(v))},TIKI_DB:{prepare:sql=>{assert.match(sql,/substr\(fixture_key,1,instr\(fixture_key,':'\)-1\) IN/);return{bind:()=>({all:async()=>{reads++;return{results:[{id:1,fixture_key:'football-api-fixture-1:2026-10-20T18:00:00Z',created_at:'2026-10-20 17:00:00',model_version:'test',ph:.2,pd:.6,pa:.2},{id:2,fixture_key:'football-api-fixture-1:2026-10-20T18:00:00Z',created_at:'2026-10-20 18:00:00',ph:.8,pd:.1,pa:.1}]}}})}}}};
 return {context,env,store,counts:()=>({reads,calls})};
}
test('all site leagues survive missing prediction and result; zero scores are final; warm cache avoids D1',async()=>{
 const h=harness(),req=new Request('https://example.com/api/transparency');
 const data=await(await h.context.audit(req,h.env,{})).json();
 assert.equal(data.matches.length,10);assert.equal(data.matches.filter(m=>m.league_key.startsWith('u')).length,3);
 assert.equal(data.matches[1].probabilities,null);assert.equal(auditVerdict(data.matches[1]).status,'pending');
 assert.equal(data.matches[0].log_id,1,'the forecast logged at kickoff is not used');assert.equal(auditVerdict(data.matches[0]).status,'hit');
 assert.equal(data.matches[0].league_logo,'/league-logos/epl.png');assert.equal(data.source,'stored_results');
 await h.context.audit(req,h.env,{});assert.deepEqual(h.counts(),{reads:1,calls:1});
});
test('D1 unavailable for forecasts never removes fixtures',async()=>{
 const h=harness();h.env.TIKI_DB.prepare=()=>{throw Error('quota')};
 const d=await(await h.context.audit(new Request('https://example.com/api/transparency'),h.env,{})).json();
 assert.equal(d.matches.length,10);assert.equal(d.partial,true);assert(d.matches.every(m=>m.probabilities===null));
});
test('18 October completed fixtures are included in the audit',async()=>{
 const h=harness();
 h.context.tdAuditFixtures=async()=>[{fixture_id:'sportmonks-18',league_key:'epl',kickoff:'2026-10-18T15:00:00Z',home:'Home',away:'Away',status:'FT',home_score:2,away_score:1,final:true}];
 const d=await(await h.context.audit(new Request('https://example.com/api/transparency?end=2026-10-20'),h.env,{})).json();
 assert.equal(d.start,'2026-10-18');assert.equal(d.matches.length,1);assert.equal(d.matches[0].final,true);assert.equal(d.matches[0].home_score,2);
});
test('bad dates rejected and storage failure does not report empty success',async()=>{
 const h=harness();assert.equal((await h.context.audit(new Request('https://example.com/api/transparency?start=2026-10-17'),h.env,{})).status,400);
 h.context.tdAuditFixtures=async()=>{throw Error('d1 unavailable')};
 assert.equal((await h.context.audit(new Request('https://example.com/api/transparency'),h.env,{})).status,503);
});
test('the audit makes no Sportmonks request',()=>{
 const body=source.slice(source.indexOf('async function tdAuditFixtures('),source.indexOf('/* football-trial:start */'));
 assert.doesNotMatch(body,/smPages|smHttp|SPORTMONKS_API_TOKEN/);
});
test('Cyprus midnight boundary and pending/tied/invalid forecasts',()=>{
 assert.equal(auditLocalDay('2026-10-18T21:00:00Z'),'2026-10-19');
 assert.equal(auditLocalDay('2026-10-18T20:59:59Z'),'2026-10-18');
 for(const probabilities of [null,[.5,.5,0],[NaN,0,1]])assert.equal(auditVerdict({probabilities,final:true,home_score:0,away_score:0}).status,'pending');
 assert.equal(auditVerdict({probabilities:[.7,.2,.1],final:false,home_score:1,away_score:0}).status,'pending');
});
