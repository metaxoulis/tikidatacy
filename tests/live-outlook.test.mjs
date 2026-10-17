import test from 'node:test';
import assert from 'node:assert/strict';
import {liveOutlook} from '../frontend/live-outlook.mjs';
const base={id:'sportmonks-1',home_score:1,away_score:0,minute:45};
const model={method:'licensed_historical_venue_poisson',team_samples:{home:7,away:8},mu_home:1.4,mu_away:1.1};
test('conditions live result on real score and minute, probabilities are normalized',()=>{
 const p=liveOutlook(base,model);
 assert.ok(p.p1>p.p2);assert.ok(Math.abs(p.p1+p.px+p.p2-100)<.03);
 assert.ok(Math.abs(p.next_goal.home+p.next_goal.away+p.next_goal.none-100)<.03);
 assert.equal(p.remaining_standard_minutes,45);assert.equal(p.source,'tiki_conditional_poisson_v1');
});
test('already achieved Over 2.5 and BTTS remain 100%',()=>{
 const p=liveOutlook({...base,minute:76,home_score:2,away_score:1},model);
 assert.equal(p.over25,100);assert.equal(p.btts,100);
});
test('never invent live predictions when timing or trained rate evidence is missing',()=>{
 assert.equal(liveOutlook({...base,minute:null},model),null);
 assert.equal(liveOutlook({...base,minute:92},model),null);
 assert.equal(liveOutlook(base,{...model,method:'generic_prior_no_licensed_history'}),null);
 assert.equal(liveOutlook(base,{...model,team_samples:{home:2,away:8}}),null);
});
