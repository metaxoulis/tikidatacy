import test from 'node:test';
import assert from 'node:assert/strict';
import {tdStatisticsProfile,tdStatisticsGate,tdStatisticsAdjustment} from '../frontend/statistical-evidence.mjs';
const match=(id,date,league=190,shots=0)=>({id,date,league_id:league,home_id:1,away_id:2,stats:{1:{'shots-total':shots},2:{'shots-total':8}}});
test('all competitions enter history; duplicates, future and embargoed fixtures do not',()=>{
 const p=tdStatisticsProfile([match(1,'2026-10-01T12:00:00Z'),match(2,'2026-10-05T12:00:00Z',5),match(3,'2026-10-10T12:00:00Z',465),match(3,'2026-10-10T12:00:00Z',465),match(4,'2026-10-21T12:00:00Z'),match(5,'2026-10-19T12:00:00Z')],1,'2026-10-20T12:00:00Z');
 assert.equal(p.n,3);assert.equal(p.for['shots-total'],0);assert.equal(p.for['expected-goals'],undefined);assert.deepEqual(p.competitions,{190:1,5:1,465:1});
});
const calibration={active:true,status:'accepted_temporal_holdout',codes:['shots-total'],coefficients:[0,.01,0,0,0],means:[0,0,0,0],scales:[1,1,1,1],holdout:{n:50,candidate_brier:.45,baseline_brier:.5,candidate_logloss:.8,baseline_logloss:.9,paired_brier_difference_95pct:[-.1,-.01]}};
test('an active flag cannot bypass insignificant or inadequate evaluation',()=>{
 assert.equal(tdStatisticsGate(calibration),true);
 assert.equal(tdStatisticsGate({...calibration,holdout:{...calibration.holdout,paired_brier_difference_95pct:[-.1,.01]}}),false);
 assert.equal(tdStatisticsGate({...calibration,holdout:{...calibration.holdout,n:10}}),false);
 assert.equal(tdStatisticsGate({...calibration,holdout:{...calibration.holdout,candidate_brier:.499}}),false);
});
test('missing history or a rejected candidate leaves numerical forecasts unchanged',()=>{
 const profile={n:3,for:{'shots-total':10},against:{'shots-total':8},rest:7};let calls=0;
 const poisson=(h,a)=>{calls++;assert.ok(h>0&&a>0);return {p1:40,px:30,p2:30}};
 assert.equal(tdStatisticsAdjustment({mu_home:1.5,mu_away:1},profile,profile,{...calibration,active:false},poisson),null);
 assert.equal(tdStatisticsAdjustment({mu_home:1.5,mu_away:1},{...profile,n:1},profile,calibration,poisson),null);
 assert.equal(calls,0);assert.equal(tdStatisticsAdjustment({mu_home:1.5,mu_away:1},profile,profile,calibration,poisson).p1,40);assert.equal(calls,1);
});
