import {test} from 'node:test';import assert from 'node:assert/strict';
import {fit,metrics,probabilities,prepare,trainCalibration} from '../workers/ml-calibration.mjs';
test('learns overconfidence and maintains probability simplex',()=>{
 const rows=Array.from({length:90},(_,i)=>({p:[.9,.05,.05],y:i%3}));const w=fit(rows,.01);
 assert.ok(metrics(rows,w).log_loss<metrics(rows).log_loss);
 const p=probabilities([.9,.05,.05],w);assert.ok(p.every(v=>v>=0&&v<=1));assert.ok(Math.abs(p.reduce((a,b)=>a+b)-1)<1e-12);
});
test('rejects post-kickoff labels and missing outcomes',()=>{
 const r={fixture_key:'sportmonks-1:2026-10-20T18:00:00Z',created_at:'2026-10-20 17:00:00',ph:.4,pd:.3,pa:.3,outcome:'H'};
 assert.equal(prepare([r]).length,1);assert.equal(prepare([{...r,created_at:'2026-10-20 18:00:00'}]).length,0);assert.equal(prepare([{...r,outcome:null}]).length,0);
});
test('cannot promote from other model versions or a tiny sample',()=>{
 const r=trainCalibration([{model_version:'other'}],'v11');assert.equal(r.status,'BLOCKED');assert.equal(r.n,0);
});
