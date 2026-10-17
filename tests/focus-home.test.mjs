import test from 'node:test';
import assert from 'node:assert/strict';
import {fhLeague,fhTrain,fhEstimate,fhSelect} from '../frontend/focus-home.mjs';
test('classifies exactly top five plus Greece/Cyprus, guards ambiguous cross-country names',()=>{
 assert.equal(fhLeague('Serie A','Brazil'),null);
 assert.equal(fhLeague('Serie A','Italy'),'seriea');
 assert.equal(fhLeague('Premier League','England'),'epl');
 assert.equal(fhLeague('Premier League','Egypt'),null);
 assert.equal(fhLeague('Bundesliga','Austria'),null);
 assert.equal(fhLeague('1st Division','Cyprus'),'cyprus');
 assert.equal(fhLeague('Super League 1','Greece'),'greece');
 assert.equal(fhLeague('Serie B','Italy'),null);
 assert.equal(fhLeague('Champions League','Europe'),null);
 assert.equal(fhLeague('Cypriot First Division',''),'cyprus');
});
test('train real historical final-score parameters without future leakage and abstain on unknown teams',()=>{
 const rows=[];
 const base=new Date('2025-05-01T00:00:00Z');
 for(let i=0;i<100;i++)rows.push({dataset_slug:'epl-2024-25',match_date:new Date(+base+i*86400000).toISOString().slice(0,10),home_team:i%2?'Arsenal':'Chelsea',away_team:i%2?'Chelsea':'Arsenal',home_score:i%2?3:1,away_score:i%2?0:2});
 rows.push({dataset_slug:'epl-2026-27',match_date:'2099-01-01',home_team:'Arsenal',away_team:'Chelsea',home_score:15,away_score:15});
 const mod=fhTrain(rows,new Date('2026-10-17T10:00:00Z'));
 assert.equal(mod.leagues.epl.matches,100);
 const f={league_key:'epl',home:'Arsenal',away:'Chelsea'};
 const p=fhEstimate(f,mod);
 assert.equal(p.method,'openfootball_cc0_fitted_venue_poisson');assert.equal(p.validated,false);
 assert(Math.abs(p.p1+p.px+p.p2-100)<1e-6);
 const unknown=fhEstimate({...f,home:'Unknown FC'},mod);
 assert.equal(unknown.confidence,'very_low');
 const cyprus=fhEstimate({...f,league_key:'cyprus'},mod);
 assert.equal(cyprus.method,'generic_prior_no_licensed_history');
});
test('homepage never renders empty league or finished games, selects actual future fixtures',()=>{
 const future='2099-02-14T16:00:00Z',past='2022-02-14T16:00:00Z';
 const rows=[
  {id:'1',league_key:'epl',date:future,home:'Arsenal',away:'Chelsea',provider:'sportapi.ai',status:'NS'},
  {id:'2',league_key:'cyprus',date:future,home:'Apoel',away:'Omonia',provider:'allsportsapi',status:'NS'},
  {id:'3',league_key:'laliga',date:past,home:'X',away:'Y',provider:'sportapi.ai',status:'FT'}
 ];
 const selected=fhSelect(rows,null);
 assert.equal(selected.fixtures_available,2);
 assert.equal(selected.upcoming.length,1);
 assert.deepEqual(new Set(selected.leagues_available),new Set(['Premier League','Κυπριακή Α΄ Κατηγορία']));
 assert.equal(fhSelect([],null).featured,null);
});
