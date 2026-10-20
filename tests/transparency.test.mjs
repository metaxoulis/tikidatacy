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
 const raw=[8,564,82,384,301,325,253,2,5,2286].map((league_id,i)=>({id:i+1,sport_id:1,league_id,starting_at:'2026-10-20 18:00:00',state:{short_name:i===0?'FT':'NS'},participants:[{id:100+i,name:'Home',meta:{location:'home'}},{id:200+i,name:'Away',meta:{location:'away'}}],scores:i===0?[{description:'CURRENT',score:{participant:'home',goals:0}},{description:'CURRENT',score:{participant:'away',goals:0}}]:[]}));
 context.smPages=async()=>{calls++;return [...raw,raw[0]]};
 const env={SPORTMONKS_API_TOKEN:'test',MATCHIQ_CACHE:{get:async k=>store.get(k)||null,put:async(k,v)=>store.set(k,JSON.parse(v))},TIKI_DB:{prepare:sql=>{assert.match(sql,/WHERE fixture_key IN/);return{bind:()=>({all:async()=>{reads++;return{results:[{id:1,fixture_key:'sportmonks-1:2026-10-20T18:00:00.000Z',created_at:'2026-10-20 17:00:00',model_version:'test',ph:.2,pd:.6,pa:.2},{id:2,fixture_key:'sportmonks-1:2026-10-20T18:00:00.000Z',created_at:'2026-10-20 18:00:00',ph:.8,pd:.1,pa:.1}]}}})}}}};
 return {context,env,store,counts:()=>({reads,calls})};
}
test('all site leagues survive missing prediction and result; zero scores are final; warm cache avoids D1',async()=>{
 const h=harness(),req=new Request('https://example.com/api/transparency');
 const data=await(await h.context.audit(req,h.env,{})).json();
 assert.equal(data.matches.length,10);assert.equal(data.matches.filter(m=>m.league_key.startsWith('u')).length,3);
 assert.equal(data.matches[1].probabilities,null);assert.equal(auditVerdict(data.matches[1]).status,'pending');
 assert.equal(data.matches[0].log_id,1);assert.equal(auditVerdict(data.matches[0]).status,'hit');
 await h.context.audit(req,h.env,{});assert.deepEqual(h.counts(),{reads:1,calls:1});
});
test('D1 unavailable never removes fixtures',async()=>{
 const h=harness();h.env.TIKI_DB.prepare=()=>{throw Error('quota')};
 const d=await(await h.context.audit(new Request('https://example.com/api/transparency'),h.env,{})).json();
 assert.equal(d.matches.length,10);assert.equal(d.partial,true);assert(d.matches.every(m=>m.probabilities===null));
});
test('bad dates rejected and provider failure does not report empty success',async()=>{
 const h=harness();assert.equal((await h.context.audit(new Request('https://example.com/api/transparency?start=2026-10-18'),h.env,{})).status,400);
 h.context.smPages=async()=>{throw Error('pagination incomplete')};
 assert.equal((await h.context.audit(new Request('https://example.com/api/transparency'),h.env,{})).status,503);
});
test('Cyprus midnight boundary and pending/tied/invalid forecasts',()=>{
 assert.equal(auditLocalDay('2026-10-18T21:00:00Z'),'2026-10-19');
 assert.equal(auditLocalDay('2026-10-18T20:59:59Z'),'2026-10-18');
 for(const probabilities of [null,[.5,.5,0],[NaN,0,1]])assert.equal(auditVerdict({probabilities,final:true,home_score:0,away_score:0}).status,'pending');
 assert.equal(auditVerdict({probabilities:[.7,.2,.1],final:false,home_score:1,away_score:0}).status,'pending');
});
