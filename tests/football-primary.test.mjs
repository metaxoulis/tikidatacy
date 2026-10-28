import test from 'node:test';
import assert from 'node:assert/strict';
import {faPrimaryGame,faPrimaryFixture,faHistoricalIdentity} from '../frontend/football-primary.mjs';
import {faTrialMatch} from '../frontend/football-trial.mjs';
const raw={id:500,fixture_id:900,home:{id:649,name:'PAOK Thessaloniki FC'},away:{id:781,name:'AEK Athens'},competition:{id:171,name:'Cup'},country:{name:'Greece'},status:'IN PLAY',time:'65',scores:{score:'2 - 1'},added:'2026-10-28 18:15:00',scheduled:'18:30',last_changed:'2026-10-28 19:40:00'};
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
