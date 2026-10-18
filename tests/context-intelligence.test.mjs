import test from 'node:test';import assert from 'node:assert/strict';
import {tdTeamContext,tdContextForecast,tdXIContinuity} from '../frontend/context-intelligence.mjs';
const match=(date,id=7,uefa=true)=>({id,starting_at:date,state_id:5,league:{name:uefa?'UEFA Europa League':'Premier League'},
 participants:[{id:1},{id:2}],expected:[{type_id:5304,participant_id:1,data:{value:1.9}},{type_id:5304,participant_id:2,data:{value:.8}}]});
test('UEFA fixtures count towards real historical xG, never future data',()=>{
 const rows=[match('2026-10-10 12:00:00'),match('2026-10-18 18:00:00',8)];
 const x=tdTeamContext(rows,1,'2026-10-18T18:00:00.000Z');
 assert.equal(x.european_matches,1);assert.equal(x.observed_xg,1);assert.equal(x.avg_xgf,1.9);
});
test('distinct team IDs and missing xG are never silently joined',()=>{
 const x=tdTeamContext([match('2026-10-10 12:00:00')],29,'2026-10-18T18:00:00Z');
 assert.equal(x.matches,0);assert.equal(x.avg_xgf,null);
});
test('lineup xG adjustments use only sufficient evidence and are capped',()=>{
 const h={observed_xg:5,avg_xgf:2,avg_xga:.6,european_matches:2},a={observed_xg:4,avg_xgf:1,avg_xga:1.2,european_matches:0};
 const base={prediction_tier:'team',mu_home:1.5,mu_away:1};
 const p=(x,y)=>({p1:x,px:100-x-y,p2:y,mu_home:x,mu_away:y});
 const out=tdContextForecast(base,h,a,p);
 assert.ok(out);assert.equal(out.context.european_matches.home,2);
 assert.ok(out.mu_home>=1.5*.925&&out.mu_home<=1.5*1.075);
 assert.equal(out.validated,false);
 assert.equal(tdContextForecast(base,{...h,observed_xg:2},a,p),null);
});
