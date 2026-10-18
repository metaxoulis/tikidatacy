import test from 'node:test';
import assert from 'node:assert/strict';
import {smRetainLiveEstimates,smValidLiveEstimate} from '../frontend/live-retention.mjs';
const t='2026-10-18T11:05:00.000Z';
const match=(extra={})=>({id:'sportmonks-123',home_id:1,away_id:2,home:'A',away:'B',date:'2026-10-18T10:00:00.000Z',status:'1ST',minute:25,home_score:0,away_score:0,...extra});
const snapshot=(matches,updated_at=t)=>({updated_at,matches});
const p=(a,b,c)=>({p1:a,px:b,p2:c,source:'sportmonks_live'});
test('keeps old live percentages with original update timestamp when provider temporarily omits them',()=>{
 const old=snapshot([match({live_prediction:p(60,25,15),live_probability_updated_at:t,live_probability_score:[0,0]})]);
 const next=snapshot([match({minute:28})],'2026-10-18T11:06:00.000Z');
 const out=smRetainLiveEstimates(next,old).matches[0];
 assert.deepEqual([out.live_prediction.p1,out.live_prediction.px,out.live_prediction.p2],[60,25,15]);
 assert.equal(out.live_probability_stale,true);
 assert.equal(out.live_probability_updated_at,t);
 assert.equal(out.minute,28);
});
test('new completed probabilities replace previous estimates',()=>{
 const old=snapshot([match({live_prediction:p(60,25,15)})]);
 const fresh=snapshot([match({live_prediction:p(45,30,25),minute:31})],'2026-10-18T11:07:00.000Z');
 const out=smRetainLiveEstimates(fresh,old).matches[0];
 assert.equal(out.live_prediction.p1,45);
 assert.equal(out.live_probability_stale,false);
 assert.equal(out.live_probability_updated_at,fresh.updated_at);
});
test('never reuses estimates for a different team, fixture or a finished match',()=>{
 const old=snapshot([match({live_prediction:p(60,25,15)})]);
 assert.equal(smRetainLiveEstimates(snapshot([match({away_id:99})]),old).matches[0].live_prediction,undefined);
 assert.equal(smRetainLiveEstimates(snapshot([]),old).matches.length,0);
 assert.equal(smRetainLiveEstimates(snapshot([match({id:'sportmonks-999'})]),old).matches[0].live_prediction,undefined);
});
test('no invented, malformed or invalid probabilities are retained',()=>{
 assert.equal(smValidLiveEstimate(p(100,40,-40)),false);
 assert.equal(smValidLiveEstimate(p(10,20,30)),false);
 assert.equal(smRetainLiveEstimates(snapshot([match()]),snapshot([match({live_prediction:p(30,20,30)})])).matches[0].live_prediction,undefined);
});
test('previous calculation context survives another refresh and score change',()=>{
 const old=snapshot([match({live_outlook:p(30,35,35),live_probability_updated_at:t,live_probability_score:[0,0]})]);
 const mid=smRetainLiveEstimates(snapshot([match({home_score:1,minute:40})],'2026-10-18T11:08:00.000Z'),old);
 const later=smRetainLiveEstimates(snapshot([match({home_score:1,minute:45})],'2026-10-18T11:09:00.000Z'),mid);
 assert.equal(later.matches[0].live_outlook.p1,30);
 assert.equal(later.matches[0].live_probability_updated_at,t);
 assert.deepEqual(later.matches[0].live_probability_score,[0,0]);
});
