import test from 'node:test';
import assert from 'node:assert/strict';
import {tdFixture,tdPriority,tdModelFromStandings,tdModelFromRecent,tdRecentRates,tdProbabilities} from '../frontend/sportapi-home.mjs';
import {tdSignedLogo} from '../frontend/sportapi-logo.mjs';
import {webcrypto} from 'node:crypto';
globalThis.crypto??=webcrypto;
const rows=[];
for(let i=0;i<20;i++)rows.push({team_name:'Team '+i,played:12,goals_for:12+i%7,goals_against:11+(i+2)%5});
const fixture={home:'Team 1',away:'Team 2',league:'Premier League',league_id:'10'};
test('normalizes real SportAPI provider fixtures and live status',()=>{
 const r=tdFixture({id:12,home_id:20,away_id:21,league_id:10,home_team:'Team 1',away_team:'Team 2',league_name:'Premier League',kickoff_utc:'2026-10-17 19:00:00',status:'NS',home_score:null,away_score:null});
 assert.equal(r.date,'2026-10-17T19:00:00.000Z');assert.equal(r.home_id,'20');assert(r.priority>=80);
 assert.equal(tdFixture({id:12,home_team:'X',away_team:'X',league_name:'Premier League',datetime:'2026-10-17T19:00:00Z'}),null);
});
test('model only when sufficient SportAPI league standings',()=>{
 const model=tdModelFromStandings({success:true,data:{standings:rows}},fixture);
 assert(model);assert.equal(model.method,'provisional_poisson_standings');
 for(const k of ['p1','px','p2','over25','btts'])assert(model[k]>=0&&model[k]<=100);
 assert(Math.abs(model.p1+model.px+model.p2-100)<1e-8);
 assert.equal(tdModelFromStandings({success:true,data:{standings:rows.slice(0,3)}},fixture),null);
 const fewer=rows.map(x=>({...x,played:2}));
 assert.equal(tdModelFromStandings({data:{standings:fewer}},fixture),null);
 assert.equal(tdModelFromStandings({data:{standings:rows}},{home:'Unknown',away:'Team 1'}),null);
});
test('1x2 totals and over/under complement and BTTS',()=>{
 const result=tdProbabilities(1.45,1.15);
 assert(Math.abs(result.p1+result.px+result.p2-100)<1e-9);
 assert(Math.abs(result.over25+result.under25-100)<1e-9);
 assert(Math.abs(result.btts+result.no_btts-100)<1e-9);
});
test('signed logo never leaks provider key in publicly visible asset URLs',async()=>{
 const key='synthetic-local-only-secret';
 const path=await tdSignedLogo(key,'123456');
 assert.match(path,/^\/api\/logo\/team\/123456\?sig=[0-9a-f]{64}$/);
 assert(!path.includes(key));assert.equal(await tdSignedLogo(key,'1/2'),null);
});

test('SportAPI finished-match fallback never includes future scores and abstains with little history',()=>{
 const base='2026-10-25';
 const make=(team,opponent,home)=>Array.from({length:10},(_,i)=>({date:'2026-10-'+String(i+1).padStart(2,'0'),home_team:home?team:opponent,away_team:home?opponent:team,home_score:i%3,away_score:i%2}));
 const h={matches:make('Everton','Club X',true).concat([{date:'2026-11-02',home_team:'Everton',away_team:'Club X',home_score:20,away_score:0}])};
 const a={matches:make('Chelsea','Club Y',false)};
 const m=tdModelFromRecent(h,a,{home:'Everton',away:'Chelsea',date:base+'T16:00:00Z'});
 assert(m);assert.equal(m.matches_sampled.home,10);assert.equal(m.matches_sampled.away,10);
 assert.equal(m.method,'provisional_poisson_recent_results');
 assert(Math.abs(m.p1+m.px+m.p2-100)<1e-8);
 const modified={matches:h.matches.filter(x=>x.date<base)};
 assert.deepEqual(tdModelFromRecent(h,a,{home:'Everton',away:'Chelsea',date:base+'T16:00:00Z'}),
                  tdModelFromRecent(modified,a,{home:'Everton',away:'Chelsea',date:base+'T16:00:00Z'}));
 assert.equal(tdRecentRates({matches:h.matches.slice(0,3)},'Everton',base),null);
});
