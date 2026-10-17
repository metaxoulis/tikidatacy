import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {sportPublicResponse,sportISO,sportStats,sportLineups,sportRange,sportStandings} from '../frontend/sportapi-public.mjs';

globalThis.crypto ??= webcrypto;
const day=()=>new Date().toISOString().slice(0,10);
const example={
  success:true,date:day(),data:[{
    id:123456,home_id:25,away_id:72,league_id:9,
    league_name:'Premier League',home_team:'Alpha',away_team:'Beta',
    datetime:day()+' 11:00:00',kickoff_utc:day()+' 11:00:00',
    home_score:2,away_score:1,status:'FT',stage:'Regular Season'
  }]
};
test('normalizes actual SportAPI date/time, missing coverage and source validation',()=>{
 assert.equal(sportISO({datetime:'2026-10-16 11:00:00'}),'2026-10-16T11:00:00.000Z');
 assert.equal(sportISO({datetime:'bad'}),null);
 assert(sportRange(day()));
 assert(!sportRange('2001-01-01'));
 assert.deepEqual(sportStats({success:true,data:{home:{shots:10},away:{shots:4}}}),{home:{shots:10},away:{shots:4}});
 assert.equal(sportStats({success:true,data:{home:{shots:null},away:{shots:null}}}),null);
 assert.equal(sportLineups({success:true,available:false}),null);
 assert.deepEqual(sportStandings({data:{standings:[]}}),[]);
});
test('no secret or invalid request never calls provider',async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('No provider call should occur');};
 try {
  const url='https://tiki-data.pages.dev/api/sport/fixtures?date='+day();
  const unavailable=await sportPublicResponse(new URL(url),{},{});assert.equal(unavailable.status,503);
  const rejected=await sportPublicResponse(new URL('https://tiki-data.pages.dev/api/sport/match?id=123456&date='+day()+'&section=stats&token=abc&home=25&away=72'),{SPORTAPI_AI_KEY:'test-only'},{});assert.equal(rejected.status,403);
  const stale=await sportPublicResponse(new URL('https://tiki-data.pages.dev/api/sport/fixtures?date=2025-01-01'),{SPORTAPI_AI_KEY:'test-only'},{});assert.equal(stale.status,400);
 }finally{globalThis.fetch=old;}
});
test('signs fixture references, securely validates on-demand match detail and strips credentials',async()=>{
 const old=globalThis.fetch,oldCache=globalThis.caches;const calls=[];
 globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
 globalThis.fetch=async (url,opts)=>{
   calls.push({url,hasKey:!!opts.headers['X-Api-Key']});
   const isStats=url.endsWith('/fixtures/123456/stats');
   const body=isStats?{success:true,available:true,data:{home:{shots:12,shots_on_target:6,pass_accuracy:84},away:{shots:5,shots_on_target:2}}}:example;
   return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const secret='fake-local-test-only-do-not-use';
 try{
  const ctx={waitUntil(p){p.catch(()=>{});}};
  const url=new URL('https://tiki-data.pages.dev/api/sport/fixtures?date='+day());
  const r=await sportPublicResponse(url,{SPORTAPI_AI_KEY:secret},ctx);
  assert.equal(r.status,200);
  const output=await r.json();
  assert.equal(output.data.count,1);
  const item=output.data.fixtures[0];assert.equal(item.id,'123456');
  assert.equal(item.date,day()+'T11:00:00.000Z');
  assert.equal(item.home_score,2);assert.equal(item.away_score,1);
  assert.equal(item.home_token?.length,64);assert.equal(item.token?.length,64);
  assert(!JSON.stringify(output).includes(secret));
  const detail=new URL('https://tiki-data.pages.dev/api/sport/match');
  for(const [k,v] of Object.entries({date:day(),id:item.id,token:item.token,home:item.home_id,away:item.away_id,section:'stats'}))detail.searchParams.set(k,v);
  const dr=await sportPublicResponse(detail,{SPORTAPI_AI_KEY:secret},ctx);
  assert.equal(dr.status,200);const stats=await dr.json();
  assert.deepEqual(stats.data,{home:{shots:12,shots_on_target:6,pass_accuracy:84},away:{shots:5,shots_on_target:2}});
  detail.searchParams.set('token','0'.repeat(64));
  const forb=await sportPublicResponse(detail,{SPORTAPI_AI_KEY:secret},ctx);assert.equal(forb.status,403);
  assert.equal(calls.length,2);
  assert(calls.every(x=>x.hasKey&&x.url.startsWith('https://sportapi.ai/api/')));
 }finally{globalThis.fetch=old;globalThis.caches=oldCache;}
});
test('rejects provider HTTP 429 without retries',async()=>{
 const old=globalThis.fetch,oldCache=globalThis.caches;let calls=0;
 globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({error:'limit'}),{status:429});};
 try{
   const r=await sportPublicResponse(new URL('https://tiki-data.pages.dev/api/sport/fixtures?date='+day()),{SPORTAPI_AI_KEY:'test-only'},{});assert.equal(r.status,429);
   assert.equal((await r.json()).error,'quota_exceeded');assert.equal(calls,1);
 }finally{globalThis.fetch=old;globalThis.caches=oldCache;}
});
