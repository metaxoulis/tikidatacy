import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeFinishedScores,evaluateWalkForward,modeledProbs} from '../frontend/model-backtest.mjs';
const record=(d,n,h=1,a=0,league='epl')=>({match_key:league+'|'+d+'|'+n,
 dataset_slug:league+'-2025-26',match_date:d,home_team:'Arsenal',away_team:'Chelsea',
 home_score:h,away_score:a,match_status:'FINISHED'});
const now=Date.parse('2026-06-18T12:00:00Z');
test('reject invalid, duplicate, future and unfinished results',()=>{
 const rows=[record('2026-06-01',1),record('2026-06-01',1),
 {...record('2026-06-02',2),match_status:'NS'},record('2026-06-18',3),record('2026-06-03',4,-1,2)];
 assert.equal(sanitizeFinishedScores(rows,now).length,1);
});
test('monthly time-split strictly blocks test and three-day embargo from training',()=>{
 const rows=[];
 for(let m=1;m<=3;m++)for(let day=1;day<=27;day++){
  const d='2026-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  for(let k=0;k<2;k++)rows.push(record(d,m*100+day*2+k,day%3,k));
 }
 let checked=0;
 const train=(input,asOf)=>{
  checked++;const cutoff=asOf.getTime()-3*86400000;
  assert.ok(input.every(r=>Date.parse(r.match_date+'T00:00:00Z')<cutoff));
  return {leagues:{epl:{hmean:1.4,amean:1.1}}};
 };
 const estimate=()=>({method:'openfootball_cc0_fitted_venue_poisson',team_samples:{home:9,away:9},p1:48,px:26,p2:26,over25:51,btts:55});
 const poisson=()=>({p1:42,px:28,p2:30,over25:53,btts:50});
 const out=evaluateWalkForward(rows,{train,estimate,poisson},{start:'2026-03-01',end:'2026-03-27',now});
 assert.equal(checked,1);assert.ok(out.metrics.eligible>0);
 assert.ok(out.metrics.brier_1x2!==null&&out.metrics.brier_1x2_baseline!==null);
 assert.equal(out.embargo_days,3);
});
test('missing fitted team history correctly abstains from scoring',()=>{
 const x=modeledProbs({method:'historical_league_baseline_no_verified_team_match',team_samples:{home:20,away:20},p1:30,px:40,p2:30,over25:55,btts:44});
 assert.equal(x,null);
});
