import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
function harness(){
 const c=vm.createContext({Response,Request,URL,URLSearchParams,Date,Intl,Map,Set,console,fetch:()=>{throw Error('unexpected network')},setTimeout,clearTimeout,TextEncoder,Uint8Array});
 vm.runInContext(worker.replace('export default {async fetch(','const worker={async fetch(')+'\nglobalThis.details=tdMatchDetails;globalThis.historyFor=tdMatchHistory;',c);
 const storage=new Map(),edge=new Map();let reads=0,provider=0;
 const m={id:'sportmonks-100',home:'Home',away:'Away',home_id:10,away_id:20,date:'2026-10-24T15:00:00Z'};
 const env={SPORTMONKS_API_TOKEN:'test',TIKI_DB:{prepare:()=>{reads++;throw Error('no D1 scans allowed')}},MATCHIQ_CACHE:{get:async k=>storage.get(k)||null,put:async(k,v)=>storage.set(k,JSON.parse(v))}};
 c.caches={default:{match:async key=>edge.get(key.url)?.clone(),put:async(key,r)=>edge.set(key.url,r)}};
 c.tdProviderFocus=async()=>new Response(JSON.stringify({matches:[m]}));
 c.tdFixtureRaw=async()=>{provider++;return{id:100,sport_id:1,metadata:[],participants:[]}};
 c.tdAttachStatisticalEvidence=async()=>{};c.tdFixtureNews=async()=>[];c.tdSeason2627Form=async()=>null;c.tdContextPair=async()=>[null,null];c.tdContextForecast=()=>null;
 return {c,env,m,counts:()=>({reads,provider})};
}
test('current public fixtures authorize details without retired D1 schedule; unknown IDs stay blocked',async()=>{
 const h=harness();h.c.tdMatchHistory=async()=>({home:[],away:[],head_to_head:[]});
 const waits=[],ctx={waitUntil:p=>waits.push(p)},req=new Request('https://example.com/api/match/sportmonks-100');
 const response=await h.c.details(req,h.env,ctx,100);assert.equal(response.status,200);assert.equal((await response.json()).lineup_status,'unavailable');await Promise.all(waits);
 assert.equal((await h.c.details(req,h.env,ctx,100)).status,200);assert.deepEqual(h.counts(),{reads:0,provider:1});
 assert.equal((await h.c.details(req,h.env,ctx,999)).status,404);assert.equal(h.counts().provider,1);
});
test('recent team history uses bounded provider requests and KV; future, unrelated and unfinished games excluded',async()=>{
 const h=harness();let calls=0;
 const make=(id,day,hi=10,status='FT')=>({id,sport_id:1,league_id:8,league:{name:'Premier League'},starting_at:day+' 12:00:00',state:{short_name:status},participants:[{id:hi,name:'Home',meta:{location:'home'}},{id:20,name:'Away',meta:{location:'away'}}],scores:[{description:'CURRENT',score:{participant:'home',goals:2}},{description:'CURRENT',score:{participant:'away',goals:1}}]});
 h.c.smPages=async(path,token,fetcher,options)=>{calls++;assert.match(path,/fixtures\/between\/.*\/(10|20)$/);assert.equal(options.maxPages,2);return[make(1,'2026-10-20'),make(2,'2026-10-25'),make(3,'2026-10-19',30,'NS')]};
 const d=await h.c.historyFor(h.env.TIKI_DB,h.m,h.env);assert.equal(d.home.length,1);assert.equal(d.away.length,1);assert.equal(d.head_to_head.length,1);assert.equal(d.home[0].result,'W');assert.equal(d.away[0].result,'L');
 await h.c.historyFor(h.env.TIKI_DB,h.m,h.env);assert.equal(calls,2);assert.equal(h.counts().reads,0);
});
test('pre-match hero never turns supplied zero placeholders into a played score',()=>{
 const ui=readFileSync(new URL('../frontend-v13/mobile-ui.js',import.meta.url),'utf8');
 const helper=ui.slice(ui.indexOf('function matchCenterForm('),ui.indexOf('function details(){'));
 const c=vm.createContext({Intl,Date,Number,window:{__tdLocale:'el'},E:x=>String(x??''),source:()=> 'Ιστορικό ομάδων',badge:()=>'',logoH:()=>null,logoA:()=>null,stageLabel:()=>null,valid123:p=>p&&[p.p1,p.px,p.p2].every(Number.isFinite),pct:p=>p+'%'});
 vm.runInContext(helper+'\nglobalThis.hero=matchCenterHero;',c);
 const m={home:'Home',away:'Away',league:'League',date:'2026-10-24T15:00:00Z',status:'NS',home_score:0,away_score:0};
 const html=c.hero(m,null,null,false);assert.match(html,/>VS</);assert(!html.includes('0 : 0'));assert(!/120Hz|Brier Loss|Squad Value|Optical Verified/.test(html));assert.match(html,/Δεν υπάρχουν διαθέσιμες πιθανότητες/);
 const final=c.hero({...m,status:'FT'},null,{p1:20,px:30,p2:50},false);assert.match(final,/>0 : 0</);assert.match(final,/width:50%/);
});
