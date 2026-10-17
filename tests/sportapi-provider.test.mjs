import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSportApiFixtures,fetchSportApiFixtures} from '../frontend/sportapi-provider.mjs';

const match = {id:1234,home_team:'Le Mans FC',away_team:'Toulouse FC',
  league_name:'French Ligue 1',datetime:'2026-10-16T18:45:00Z',
  home_score:0,away_score:3,status:'FT'};
test('scorecard is normalized without made-up bookmaker odds or model probabilities',()=>{
  const rows=normalizeSportApiFixtures({success:true,fixtures:[match]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'sportapi-1234');
  assert.equal(rows[0].league,'ligue1');
  assert.equal(rows[0].home_score,0);
  assert.equal(rows[0].away_score,3);
  for(const x of ['p1','px','p2','over25','under25','btts','no_btts','mu_home','mu_away'])
    assert.equal(rows[0][x],null);
});
test('reject invalid, ambiguous or untimed fixtures instead of inventing data',()=>{
  const missingTime={...match,datetime:null};
  const invalidScore={...match,home_score:-3};
  assert.deepEqual(normalizeSportApiFixtures({success:true,fixtures:[missingTime]}),[]);
  assert.equal(normalizeSportApiFixtures({success:true,fixtures:[invalidScore]})[0].home_score,null);
  assert.equal(normalizeSportApiFixtures({success:false,fixtures:[match]}),null);
  assert.deepEqual(normalizeSportApiFixtures({success:true,fixtures:[match,match]}).length,1);
  assert.equal(normalizeSportApiFixtures({success:true,fixtures:'oops'}),null);
});
test('no upstream request without injected server-side key',async()=>{
  let calls=0;
  const result=await fetchSportApiFixtures(null,'2026-10-16',()=>{calls++;throw Error('should not call')});
  assert.equal(result,null);assert.equal(calls,0);
});
test('uses X-Api-Key exclusively in HTTP headers; never in URL or returned JSON',async()=>{
  let called=false;
  const sampleKey='unit-test-synthetic-value';
  const result=await fetchSportApiFixtures(sampleKey,'2026-10-16',async(url,options)=>{
    called=true;assert.equal(url,'https://sportapi.ai/api/fixtures/date/2026-10-16');
    assert.equal(options.headers['X-Api-Key'],sampleKey);
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'manual');
    return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({success:true,fixtures:[match]})};
  });
  assert(called);assert.equal(result.source,'sportapi.ai');
  assert.equal(result.matches.length,1);
  assert.equal(result.matches[0].model_available,false);
  assert(!JSON.stringify(result).includes(sampleKey));
});
test('429 and authentication failures abort without retry or exposing credentials',async()=>{
  for(const status of [401,403,429,503]){
    let n=0;
    const result=await fetchSportApiFixtures('synthetic-secret','2026-10-16',async()=>{
      n++;return{ok:false,status};
    });
    assert.equal(result,null);assert.equal(n,1);
  }
});


test('live SportAPI response uses data array and kickoff_utc',()=>{
  const {datetime,...onlyKickoff}=match;
  const actual={...onlyKickoff,kickoff_utc:'2026-10-16T18:45:00Z',
    home_id:101,away_id:102,league_id:44,league_geo:'FR',updated_at:'2026-10-16T23:00:00Z'};
  const payload={success:true,date:'2026-10-16',data:[actual]};
  const normalized=normalizeSportApiFixtures(payload);
  assert.equal(normalized.length,1);
  assert.equal(normalized[0].date,'2026-10-16T18:45:00.000Z');
  assert.equal(normalized[0].home,'Le Mans FC');
  assert.equal(normalized[0].away,'Toulouse FC');
  assert.equal(normalized[0].status,'FINISHED');
  assert.equal(normalized[0].home_score,0);
  assert.equal(normalized[0].away_score,3);
});
test('provider may legitimately return [] or date without time, never invent kickoff',()=>{
  assert.deepEqual(normalizeSportApiFixtures({success:true,date:'2026-10-17',data:[]}),[]);
  const row={...match,datetime:null,kickoff_utc:null,date:'2026-10-17'};
  assert.deepEqual(normalizeSportApiFixtures({success:true,date:'2026-10-17',data:[row]}),[]);
});
test('real data[] fetch with 255 fixtures is accepted and protected from oversized responses',async()=>{
  const many=Array.from({length:255},(_,i)=>({...match,id:i+1}));
  const result=await fetchSportApiFixtures('synthetic-secret','2026-10-17',async()=>({
    ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({success:true,date:'2026-10-17',data:many})
  }));
  assert.equal(result?.matches?.length,255);
  assert.equal(result?.source,'sportapi.ai');
  assert(result.matches.every(x=>x.p1===null&&x.p2===null));
  assert.equal(normalizeSportApiFixtures({success:true,data:Array.from({length:601},(_,i)=>({...match,id:i+1}))}),null);
});

test('live SportAPI response uses data array and UTC datetime with a space',()=>{
 const data={success:true,date:'2026-10-16',data:[{id:99001,home_team:'Alpha',away_team:'Beta',league_name:'Premier League',date:'2026-10-16',datetime:'2026-10-16 11:00:00',kickoff_utc:'2026-10-16 11:00:00',status:'FT',home_score:1,away_score:0}]};
 const out=normalizeSportApiFixtures(data);
 assert.equal(out.length,1);
 assert.equal(out[0].date,'2026-10-16T11:00:00.000Z');
 assert.equal(out[0].status,'FINISHED');
 assert.equal(out[0].home_score,1);
 assert.equal(out[0].p1,null);
});
