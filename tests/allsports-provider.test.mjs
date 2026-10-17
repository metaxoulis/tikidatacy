import test from 'node:test';
import assert from 'node:assert/strict';
import {asFixture,asNormalize,asLogo,asPublicResponse,asRequestFixtures} from '../frontend/allsports-provider.mjs';
const date=new Date().toISOString().slice(0,10);
const fixture={event_key:'59409',event_date:date,event_time:'20:30',event_home_team:'Lazio',event_away_team:'Torino',home_team_key:'93',away_team_key:'4973',event_status:'Finished',event_live:'0',event_final_result:'2 - 0',league_name:'Serie A',league_key:'207',home_team_logo:'https://apiv2.allsportsapi.com/logo/93_lazio.jpg',away_team_logo:'https://apiv2.allsportsapi.com/logo/4973_torino.jpg',league_logo:'https://apiv2.allsportsapi.com/logo/logo_leagues/207_serie-a.png'};
test('normalizes fixtures without mixing provider IDs',()=>{const row=asFixture(fixture);assert.equal(row.id,'allsports-59409');assert.equal(row.status,'FT');assert.equal(row.home_score,2);assert.equal(row.league_logo,fixture.league_logo);assert.equal(row.logos.home,fixture.home_team_logo);assert.equal(asNormalize({success:1,result:[fixture]}).length,1);});
test('invalid logos and incomplete data are not presented as real fixtures',()=>{assert.equal(asLogo('https://example.org/counterfeit.jpg'),null);assert.equal(asFixture({...fixture,event_key:'bad'}),null);assert.equal(asFixture({...fixture,event_time:'25:00'}),null);assert.equal(asNormalize({success:0,error:'unauthorized'}),null);});
test('upstream request uses POST body, no credential in URL',async()=>{const key='local-test-secret';const fake=async(url,opts)=>{assert.equal(opts.method,'POST');assert(!url.includes(key));assert(opts.body.includes('APIkey='+key));return new Response(JSON.stringify({success:1,result:[fixture]}),{status:200,headers:{'content-type':'application/json'}})};const r=await asRequestFixtures(key,date,fake);assert.equal(r.fixtures.length,1);});
test('unconfigured, invalid date and status routes do not call provider',async()=>{const s=await asPublicResponse(new Request('https://example.org/api/allsports/status'),{},null,new URL('https://example.org/api/allsports/status'));assert.equal((await s.json()).configured,false);const u=new URL('https://example.org/api/allsports/fixtures?date='+date);const r=await asPublicResponse(new Request(u),{},null,u);assert.equal(r.status,503);const bad=new URL('https://example.org/api/allsports/fixtures?date=1900-01-01');const b=await asPublicResponse(new Request(bad),{ALLSPORTS_API_KEY:'test'},null,bad);assert.equal(b.status,400);});

// Reproduces the busy-day failure: the upstream response is larger than 1.4 MiB
// even though the public fixture fields are compact.
test('handles large fixture-day payload without retaining arbitrary upstream fields',async()=>{
 const rows=Array.from({length:1000},(_,i)=>({...fixture,event_key:String(60000+i),provider_extra:'x'.repeat(1700)}));
 const payload=JSON.stringify({success:1,result:rows});
 assert(payload.length>1400000);
 const fake=async()=>new Response(payload,{status:200,headers:{'content-length':String(payload.length)}});
 const r=await asRequestFixtures('test',date,fake);
 assert.equal(r.fixtures?.length,1000);
 assert.equal('provider_extra' in r.fixtures[0],false);
 assert.equal(asNormalize({success:1,result:Array.from({length:1801},()=>fixture)}),null);
});
