import test from 'node:test';import assert from 'node:assert/strict';
import {liveStatSummary,historicalFormIndex,recentTeamForm,formBasedRates} from '../frontend/live-intelligence.mjs';
import {liveOutlook} from '../frontend/live-outlook.mjs';
test('statistics are assigned to the correct team, missing metrics remain absent',()=>{
 const rows=[{participant_id:31,type:'SHOTS_TOTAL',value:8},{participant_id:42,type:'SHOTS_TOTAL',value:3},
 {participant_id:31,type:'CORNERS',value:1},{participant_id:42,type:'CORNERS',value:2},
 {participant_id:31,type:'GOALS',value:2},{participant_id:42,type:'GOALS',value:0}];
 const metrics=liveStatSummary(rows,31,42);
 assert.deepEqual(metrics.map(x=>x.key),['shots','corners']);assert.deepEqual(metrics.map(x=>[x.home,x.away]),[[8,3],[1,2]]);
});
test('recent form uses previous finished score records and goal averages, no fake live shots',()=>{
 const records=[];for(let i=1;i<=6;i++)records.push({match_date:'2026-10-'+String(i).padStart(2,'0'),
 home_team:'Arsenal F.C.',away_team:'Chelsea',home_score:2,away_score:1,league_key:'epl'});
 const index=historicalFormIndex(records,'2026-10-10');
 const home=recentTeamForm(index,'Arsenal F.C.'),away=recentTeamForm(index,'Chelsea');
 assert.equal(home.matches,6);assert.equal(home.goals_per_match,2);assert.equal(away.goals_per_match,1);
 const m=formBasedRates(home,away);assert.ok(m&&m.mu_home>0&&m.mu_away>0);assert.equal(m.validated,false);
 const outlook=liveOutlook({id:'sportmonks-100',home_score:2,away_score:1,minute:70},m);
 assert.ok(outlook&&outlook.p1>0);assert.match(outlook.based_on,/recent_verified_scores/);
 assert.equal(formBasedRates({...home,matches:2},away),null);
});
test('avoid future results and fake stats',()=>{const idx=historicalFormIndex([{match_date:'2026-10-30',home_team:'A',away_team:'B',home_score:1,away_score:0}], '2026-10-18');assert.equal(recentTeamForm(idx,'A').matches,0);assert.deepEqual(liveStatSummary([{type:'GOALS',participant_id:1,value:3}],1,2),[])});
