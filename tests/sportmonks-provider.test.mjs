import test from 'node:test';
import assert from 'node:assert/strict';
import {smLogo,smNormalizeFixture,smWeek,smInplay,smHttp} from '../frontend/sportmonks-provider.mjs';
const info=new Map([[732,{key:'epl',name:'Premier League',country:'England',image_path:'https://cdn.sportmonks.com/images/soccer/leagues/732.png'}]]);
const fixture={id:123,sport_id:1,league_id:732,starting_at:'2099-10-18 14:45:00',placeholder:false,
 participants:[{id:1,name:'Arsenal',meta:{location:'home'},image_path:'https://cdn.sportmonks.com/images/soccer/teams/1.png'},{id:2,name:'Chelsea',meta:{location:'away'},image_path:'https://cdn.sportmonks.com/images/soccer/teams/2.png'}]};
test('never construct missing teams from freeform fixture name',()=>{assert.equal(smNormalizeFixture({...fixture,participants:[],name:'Arsenal vs Chelsea'},info),null)});
test('Sportmonks participant and logos map to fixture without provider history guesses',()=>{
 const f=smNormalizeFixture(fixture,info);
 assert.equal(f.home,'Arsenal');assert.equal(f.away,'Chelsea');assert.equal(f.date,'2099-10-18T14:45:00.000Z');
 assert.equal(f.logos.home,'https://cdn.sportmonks.com/images/soccer/teams/1.png');
 assert.equal(smLogo('http://cdn.sportmonks.com/images/soccer/teams/1.png'),null);
 assert.equal(smLogo('https://evil.com/images/soccer/teams/1.png'),null);
});
test('token only travels in private header, semicolon includes and subscription country validation',async()=>{
 const requests=[];
 const fetcher=async(url,opts)=>{
  requests.push({url,auth:opts.headers.Authorization});
  const isLeague=url.includes('/leagues/date/');
  const data=isLeague?[{id:732,name:'Premier League',country:{name:'England'}}]:[fixture];
  return new Response(JSON.stringify({data,pagination:{has_more:false}}),{status:200,headers:{'content-type':'application/json'}});
 };
 const classify=(n,c)=>n==='Premier League'&&c==='England'?'epl':null;
 const d=await smWeek('2099-10-18','top-secret',classify,fetcher,1);
 assert.equal(d.fixtures.length,1);assert.equal(d.partial,false);
 assert.equal(requests.length,2);for(const r of requests){assert.equal(r.auth,'top-secret');assert(!r.url.includes('top-secret'))}
 const live=await smInplay('top-secret',classify,fetcher,'2099-10-18');assert.equal(live.length,1);
});
test('reject unavailable authentication and malformed response, never fall back to old APIs',async()=>{
 await assert.rejects(smHttp('fixtures/date/2099-10-18?per_page=50','',async()=>{}),/not_configured/);
 await assert.rejects(smHttp('fixtures/date/2099-10-18?per_page=50','secret',async()=>new Response('{}',{status:403})),/subscription_restricted/);
});
