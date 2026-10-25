import test from 'node:test';
import assert from 'node:assert/strict';
import {liveOutlook,liveStatsFactors} from '../frontend/live-outlook.mjs';
const base={id:'sportmonks-1',home_score:1,away_score:0,minute:45};
const model={method:'licensed_historical_venue_poisson',team_samples:{home:7,away:8},mu_home:1.4,mu_away:1.1};
test('conditions live result on real score and minute, probabilities are normalized',()=>{
 const p=liveOutlook(base,model);
 assert.ok(p.p1>p.p2);assert.ok(Math.abs(p.p1+p.px+p.p2-100)<.03);
 assert.ok(Math.abs(p.next_goal.home+p.next_goal.away+p.next_goal.none-100)<.03);
 assert.equal(p.remaining_standard_minutes,45);assert.equal(p.source,'tiki_conditional_poisson_v2');
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

test('verified home pressure raises home 1X2 and changes goal-market outlook, with bounded factors',()=>{
 const stats=[
  {key:'on_target',home:7,away:1},{key:'shots',home:15,away:5},
  {key:'dangerous',home:56,away:18},{key:'possession',home:63,away:37},
  {key:'corners',home:7,away:2}
 ];
 const original=liveOutlook(base,model),adjusted=liveOutlook(base,model,stats);
 assert.equal(original.live_stats_applied,false);
 assert.equal(adjusted.live_stats_applied,true);
 assert.ok(adjusted.p1>original.p1);
 assert.ok(adjusted.p2<original.p2);
 assert.notEqual(adjusted.over25,original.over25);
 assert.ok(adjusted.live_stats_adjustment.metrics_used.includes('on_target'));
 assert.ok(!adjusted.live_stats_adjustment.metrics_used.includes('attacks'));
 assert.ok(adjusted.live_stats_adjustment.home<=Math.exp(.26));
 assert.ok(adjusted.live_stats_adjustment.away>=Math.exp(-.26));
 assert.ok(Math.abs(adjusted.p1+adjusted.px+adjusted.p2-100)<.03);
 assert.ok(Math.abs(adjusted.over25+adjusted.under25-100)<.03);
 assert.ok(adjusted.btts>=0&&adjusted.btts<=100);
});
test('away pressure and home red card shift away probability; even or invalid stats do not fabricate signal',()=>{
 const neutral=liveOutlook(base,model);
 const bad=[{key:'shots',home:-2,away:90000},{key:'possession',home:100,away:100}];
 assert.deepEqual(liveOutlook(base,model,bad).remaining_expected_goals,neutral.remaining_expected_goals);
 const equal=[{key:'on_target',home:2,away:2},{key:'possession',home:50,away:50}];
 assert.equal(liveOutlook(base,model,equal).live_stats_applied,false);
 const away=[{key:'on_target',home:0,away:6},{key:'red',home:1,away:0}];
 assert.ok(liveOutlook(base,model,away).p2>neutral.p2);
 assert.ok(liveOutlook(base,model,[{key:'possession',home:60,away:40}]).live_stats_adjustment.home<1.05);
 assert.equal(liveStatsFactors([],55).applied,false);
});
test('worker routes consume the stats used for the live Poisson and contain the same model implementation',async()=>{
 const {readFileSync}=await import('node:fs');
 const w=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
 assert.match(w,/liveOutlook\(m,fitted,liveStats\)/);
 assert.match(w,/liveOutlook\(m,last,liveStats\)/);
 assert.match(w,/live_stats:liveStats/);
 assert.match(w,/function liveStatsFactors\(stats,minute\)/);
});
