import test from 'node:test';
import assert from 'node:assert/strict';
import {faPrimaryGame,faPrimaryFixture,faHistoricalIdentity,faLivePredictor} from '../frontend/football-primary.mjs';
import {faTrialMatch} from '../frontend/football-trial.mjs';
const raw={id:500,fixture_id:900,home:{id:649,name:'PAOK Thessaloniki FC'},away:{id:781,name:'AEK Athens'},competition:{id:171,name:'Cup'},country:{name:'Greece'},status:'IN PLAY',time:'65',scores:{score:'2 - 1'},added:'2026-10-28 18:15:00',scheduled:'18:30',last_changed:'2026-10-28 19:40:00'};

test('HT at 2–0 conditions the team prior on the score and 45 remaining minutes',()=>{
 const p=faLivePredictor({id:'fa-test',status:'HT',minute:null,home_score:2,away_score:0},null,{tier:'team',mu_home:1,mu_away:2});
 assert.equal(p.time_basis,'halftime_45');assert.equal(p.minute,null);assert.equal(p.calculation_minute,45);
 assert.equal(p.prior_basis,'team_history');assert.ok(p.p1>80);assert.ok(p.p2<10);assert.ok(Math.abs(p.p1+p.px+p.p2-100)<.02);
});
test('unknown teams receive labelled league, global or generic priors without invented history',()=>{
 const g={status:'2ND',minute:70,home_score:1,away_score:0,league_key:'epl'};
 const league=faLivePredictor(g,{leagues:{epl:{matches:100,hmean:1.5,amean:1.2}}});
 assert.equal(league.prior_basis,'league_average');assert.equal(faLivePredictor(g,{global:{matches:100,hmean:1.4,amean:1.1}}).prior_basis,'global_average');
 const generic=faLivePredictor(g,null);assert.equal(generic.prior_basis,'generic_assumption');assert.equal(generic.live_stats_applied,false);
 const later=faLivePredictor({...g,minute:85},null);assert.ok(later.p1>generic.p1);
 const equal=faLivePredictor({...g,away_score:1},null);assert.ok(equal.p1<generic.p1);
});
test('late play states the extra minute assumption; invalid scores and shootouts are withheld',()=>{
 const g={status:'2ND',minute:94,home_score:2,away_score:0};
 const late=faLivePredictor(g,null);assert.equal(late.remaining_standard_minutes,1);assert.equal(late.time_basis,'one_minute_remaining_assumption');
 assert.equal(faLivePredictor({...g,home_score:null},null),null);assert.equal(faLivePredictor({...g,status:'PEN_LIVE'},null),null);
 assert.equal(faLivePredictor({...g,status:'NS'},null),null);
 assert.equal(faLivePredictor({...g,status:'ET',minute:100},null).remaining_standard_minutes,20);
});
test('scheduled and live versions share a public fixture identity, never provider numeric IDs',()=>{
 const scheduled=faPrimaryFixture({...raw,id:900,date:'2026-10-28',time:'18:30:00'}),live=faPrimaryGame(faTrialMatch(raw));
 assert.equal(scheduled.id,live.id);assert.equal(live.match_id,500);assert.equal(scheduled.match_id,null);assert.equal(live.date,'2026-10-28T18:30Z');assert.equal(live.minute,65);assert.equal(live.status,'2ND');assert.equal(live.league_key,'fa171');assert.deepEqual(live.live_stats,[]);
});
test('provider numeric collisions cannot unlock historical forecasts without a unique alias',()=>{
 const model={team_identity:{aliases:{paok:'sportmonks:649',aek:'sportmonks:781'},ambiguous:[]}};
 const key=n=>({'PAOK':'paok','AEK Athens':'aek'})[n]||n.toLowerCase();
 const g=faPrimaryGame(faTrialMatch(raw)),matched=faHistoricalIdentity(g,model,key);
 assert.equal(matched.home_id,649);assert.equal(matched.away_id,781);
 assert.equal(faHistoricalIdentity({...g,home:'Unknown club'},model,key),null);
 assert.equal(faHistoricalIdentity(g,{team_identity:{...model.team_identity,ambiguous:['paok']}},key),null);
});
test('live fixture without fixture ID uses a distinct match namespace and validates kickoff',()=>{
 const g=faPrimaryGame(faTrialMatch({...raw,fixture_id:null}));assert.equal(g.id,'football-api-500');
 assert.equal(faPrimaryGame(faTrialMatch({...raw,added:null,scheduled:null})),null);
 assert.equal(faPrimaryGame(faTrialMatch({...raw,country:{name:'Brazil'},competition:{id:24,name:'Serie A'}})),null);
});
test('UTC midnight rollover and half time are retained without inventing a live minute',()=>{
 const m=faTrialMatch({...raw,scheduled:'00:05',added:'2026-10-28 23:50:00'});assert.equal(m.date,'2026-10-29T00:05:00.000Z');
 const ht=faPrimaryGame(faTrialMatch({...raw,status:'HALF TIME BREAK',time:'HT'}));assert.equal(ht.status,'HT');assert.equal(ht.minute,null);
});

test('added time, extra time and shoot-outs stay live (Saturday 2026-10-31 provider statuses)',()=>{
 const g=(status,time)=>faPrimaryGame(faTrialMatch({...raw,status,time}));
 assert.deepEqual([g('ADDED TIME','90+').status,g('ADDED TIME','90+').minute],['2ND',90]);
 assert.deepEqual([g('ADDED TIME','45+').status,g('ADDED TIME','45+').minute],['1ST',45]);
 assert.deepEqual([g('IN PLAY','90+').status,g('IN PLAY','90+').minute],['2ND',90]);
 assert.deepEqual([g('IN PLAY','45+2').status,g('IN PLAY','45+2').minute],['1ST',45]);
 assert.deepEqual([g('IN PLAY','99').status,g('IN PLAY','110').status],['ET','ET']);
 assert.deepEqual([g('IN PLAY','PS').status,g('IN PLAY','PS').minute],['PEN_LIVE',null]);
 assert.deepEqual([g('IN PLAY','62').status,g('HALF TIME BREAK','HT').status,g('FINISHED','FT').status,g('NOT STARTED','16:30').status],['2ND','HT','FT','NS']);
});
