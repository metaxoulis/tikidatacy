import test from 'node:test';
import assert from 'node:assert/strict';
import {faEdgeCached} from '../frontend/football-primary.mjs';

function fakeCache(){
 const store=new Map();
 return {store,async match(req){const x=store.get(req.url);return x?new Response(x.body,{status:x.status,headers:x.headers}):undefined},
  async put(req,res){store.set(req.url,{body:await res.arrayBuffer(),status:res.status,headers:[...res.headers]})}};
}
const ctx=()=>{const jobs=[];return {jobs,waitUntil(p){jobs.push(p)}}};
const json=(n,status=200)=>new Response(JSON.stringify({n}),{status,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=30'}});

test('a cold cache builds once; a fresh copy is served without building',async()=>{
 globalThis.caches={default:fakeCache()};let builds=0,t=1000;const clock=()=>t;
 const build=async()=>json(++builds);
 const first=await faEdgeCached('focus',ctx(),20000,build,clock);
 assert.deepEqual(await first.json(),{n:1});assert.equal(first.headers.get('Cache-Control'),'no-store');assert.equal(first.headers.get('X-Tiki-Built-At'),null);
 t+=15000;assert.deepEqual(await (await faEdgeCached('focus',ctx(),20000,build,clock)).json(),{n:1});assert.equal(builds,1);
});

test('an older copy is returned at once while one background rebuild refreshes it',async()=>{
 globalThis.caches={default:fakeCache()};let builds=0,t=1000;const clock=()=>t;
 let release;const gate=new Promise(r=>release=r);
 const build=async()=>{builds++;if(builds>1)await gate;return json(builds)};
 await faEdgeCached('live',ctx(),10000,build,clock);
 t+=30000;const c1=ctx(),c2=ctx();
 assert.deepEqual(await (await faEdgeCached('live',c1,10000,build,clock)).json(),{n:1},'the visitor gets the previous copy immediately');
 assert.deepEqual(await (await faEdgeCached('live',c2,10000,build,clock)).json(),{n:1});
 assert.equal(c1.jobs.length,1);assert.equal(c2.jobs.length,0,'one rebuild at a time per isolate');
 release();await Promise.all(c1.jobs);
 assert.deepEqual(await (await faEdgeCached('live',ctx(),10000,build,clock)).json(),{n:2});assert.equal(builds,2);
});

test('without a background context or past ten minutes the request rebuilds; errors are never cached',async()=>{
 globalThis.caches={default:fakeCache()};let builds=0,t=1000;const clock=()=>t;
 const build=async()=>json(++builds);
 await faEdgeCached('match-1',ctx(),20000,build,clock);
 t+=60000;assert.deepEqual(await (await faEdgeCached('match-1',null,20000,build,clock)).json(),{n:2});
 t+=700000;assert.deepEqual(await (await faEdgeCached('match-1',ctx(),20000,build,clock)).json(),{n:3});
 const failing=async()=>json(0,503);
 assert.equal((await faEdgeCached('match-2',ctx(),20000,failing,clock)).status,503);
 assert.equal(globalThis.caches.default.store.has('https://tiki-cache.local/fa-edge-v1/match-2'),false);
 delete globalThis.caches;
 assert.deepEqual(await (await faEdgeCached('match-3',ctx(),20000,build,clock)).json(),{n:4},'works without a Cache API');
});
