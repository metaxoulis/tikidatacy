import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {archivedTeamMatch} from '../frontend/sportmonks-assets.mjs';
const source=()=>readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
function harness(){
 const c=vm.createContext({Response,Request,URL,URLSearchParams,Intl,Date,Map,Set,console,setTimeout,clearTimeout,Uint8Array,TextEncoder});
 vm.runInContext(source().replace('export default {async fetch(','const worker={async fetch('),c);
 return c;
}
const venue={matches:20,attack:1.2,defence:.9,competitions:{epl:20}};
const model=()=>({model_version:'tiki-identity-balanced-poisson-v11',trained_at:new Date().toISOString(),cutoff:'2026-10-26',
 global:{matches:1000,hmean:1.5,amean:1.2},leagues:{epl:{matches:100,hmean:1.6,amean:1.1}},
 all_teams:{'sportmonks:101':{home:venue,away:venue},'sportmonks:102':{home:venue,away:venue}},team_identity:{aliases:{},ambiguous:[]}});
const game={id:'football-api-fixture-1',home:'New home spelling',away:'New away spelling',home_id:10,away_id:20,status:'NS',league_key:'epl',date:'2026-11-01T18:00:00Z'};
test('verified provider identity mapping unlocks team history despite new spellings',()=>{
 const c=harness();vm.runInContext('faBadgeCache.identities=new Map([[10,101],[20,102]])',c);
 const g=c.faPrimaryForecast(game,model(),new Set([10,20]));
 assert.equal(g.model.tier,'team');assert.equal(g.historical_identity.home,'sportmonks:101');assert.equal(g.home_id,10);
 assert.equal(g.logos.home,'/badges/10.png');assert.ok(Math.abs(g.p1+g.px+g.p2-100)<.1);
});
test('unknown teams get labelled stored league or pooled priors without invented team evidence',()=>{
 const c=harness();
 for(const key of ['epl','fa999']){
  const g=c.faPrimaryForecast({...game,league_key:key},model(),new Set());
  assert.ok(g.model);assert.equal(g.model.tier,key==='epl'?'league':'cross_league');assert.equal(g.model.limited_evidence,true);
  assert.equal(g.historical_sample.home,0);assert.equal(g.historical_identity.home,null);assert.equal(g.model.validated,false);
  assert.ok(Math.abs(g.p1+g.px+g.p2-100)<.1);
 }
});
test('UEFA forecasts remain explicitly experimental and do not fabricate validation approval',()=>{
 const c=harness();vm.runInContext('faBadgeCache.identities=new Map([[10,101],[20,102]])',c);
 const g=c.faPrimaryForecast({...game,league_key:'ucl'},model(),new Set());
 assert.ok(g.model);assert.equal(g.forecast_review.status,'withheld');assert.ok(g.experimental_preview);
 assert.equal(g.model.validated,false);assert.equal(g.model.experimental,true);
});
test('stored model survives a KV outage by loading the saved D1 snapshot, without a provider',async()=>{
 const c=harness(),m=model();
 const env={MATCHIQ_CACHE:{get:async()=>{throw Error('KV unavailable')}},TIKI_DB:{prepare:()=>({bind:()=>({first:async()=>({payload_json:JSON.stringify(m)})})})}};
 const stored=await c.tdPublishedModel(env);assert.equal(stored.model_version,m.model_version);assert.equal(stored.global.matches,1000);
});
test('archived team matching uses country and refuses ambiguous club names',()=>{
 const key=s=>s.toLowerCase(),rows=[{id:1,name:'Olympiakos',country:'Greece'},{id:2,name:'Olympiakos',country:'Cyprus'}];
 assert.equal(archivedTeamMatch({id:10,name:'Olympiakos',country:'Cyprus'},rows,new Map(),key).id,2);
 assert.equal(archivedTeamMatch({id:10,name:'Olympiakos',country:''},rows,new Map(),key),null);
 assert.equal(archivedTeamMatch({id:10,name:'Provider spelling',country:''},rows,new Map([[10,1]]),key).id,1);
});
