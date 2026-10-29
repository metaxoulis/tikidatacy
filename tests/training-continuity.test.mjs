import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
function harness(){
 const context=vm.createContext({Response,Request,URL,URLSearchParams,Intl,Date,Map,Set,console:{error(){}},setTimeout,clearTimeout,Uint8Array,TextEncoder});
 vm.runInContext(source.replace('export default {async fetch(','const worker={async fetch('),context);
 const retained={model_version:'old',all_teams:{old:{}},trained_at:'2026-10-28'};
 const store=new Map([['tiki:published-model:v11',retained]]);
 const env={TIKI_DB:{},MATCHIQ_CACHE:{get:async k=>store.get(k)||null,put:async(k,v)=>store.set(k,JSON.parse(v))}};
 context.tdTrainingAuthorized=async()=>true;
 context.tdPublishedModel=async()=>retained;
 context.faSyncResults=async()=>({status:'ok',stored:2});
 let trained=0;
 context.fhLoadModel=async()=>{trained++;return {all_teams:Object.fromEntries(Array.from({length:10},(_,i)=>[i,{}])),leagues:{epl:{matches:102}},trained_at:'2026-10-29',cutoff:'2026-10-26'}};
 return {context,env,store,retained,trained:()=>trained};
}
test('failed or partial new-provider sync preserves the published model and does not train',async()=>{
 for(const status of ['failed','partial','unavailable']){
  const h=harness();h.context.faSyncResults=async()=>({status});
  const response=await h.context.tdRunScheduledTraining(new Request('https://example.com/api/internal/train',{method:'POST'}),h.env);
  assert.equal(response.status,503);assert.equal(h.trained(),0);
  assert.equal(h.store.get('tiki:published-model:v11'),h.retained);
  assert.equal(h.store.get('tiki:published-model:v11:previous').trained_at,h.retained.trained_at);
 }
});
test('complete sync publishes the refreshed model and retains the previous model',async()=>{
 const h=harness();
 const response=await h.context.tdRunScheduledTraining(new Request('https://example.com/api/internal/train',{method:'POST'}),h.env);
 const result=await response.json();
 assert.equal(result.status,'success');assert.equal(result.football_api_results_sync.stored,2);
 assert.equal(h.trained(),1);assert.equal(h.store.get('tiki:published-model:v11').trained_at,'2026-10-29');
 assert.equal(h.store.get('tiki:published-model:v11:previous').trained_at,h.retained.trained_at);
});
test('training requires both historical stores and a successful snapshot write',async()=>{
 for(const fail of ['sportmonks_training_results','football_training_results','INSERT INTO focus_model_snapshots']){
  const h=harness();
  // Use the real loader, with database failures isolated to each required source/write.
  vm.runInContext(source.slice(source.indexOf('async function fhLoadModel('),source.indexOf('const fhFuture=')),h.context);
  let trained=0;h.context.fhTrain=()=>{trained++;return {trained_at:'now'}};
  const db={prepare(sql){return {bind(){return this},async first(){return null},async all(){if(sql.includes(fail))throw Error('database failure');return {results:Array.from({length:80},()=>({}))}},async run(){if(sql.includes(fail))throw Error('database failure')}}}};
  assert.equal(await h.context.fhLoadModel(db,null,true),null);
  assert.equal(trained,fail.startsWith('INSERT')?1:0);
 }
});
