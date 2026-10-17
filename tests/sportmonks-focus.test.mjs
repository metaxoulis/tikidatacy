import test from 'node:test';
import assert from 'node:assert/strict';
import {smBuildFocus} from '../frontend/sportmonks-focus.mjs';
const example={id:'sportmonks-1',league_key:'epl',league:'Premier League',
 home:'Arsenal',away:'Chelsea',date:'2099-10-19T16:00:00.000Z',status:'NS',
 logos:{home:'https://cdn.sportmonks.com/images/soccer/teams/a.png',away:'https://cdn.sportmonks.com/images/soccer/teams/b.png'}};
const clock=Date.parse('2099-10-17T13:00:00.000Z');
test('all genuine fixtures remain listed even when no historic team evidence exists',()=>{
 const x=smBuildFocus([example],[],null,clock);
 assert.equal(x.matches.length,1);assert.equal(x.matches[0].p1,null);assert.equal(x.matches[0].btts,null);
 assert.equal(x.coverage.with_prediction,0);assert.equal(x.featured.id,example.id);
});
test('only matched home-away observations receive Poisson outputs; never publish generic fallback',()=>{
 const ok=(f,m)=>({method:'openfootball_cc0_fitted_venue_poisson',team_samples:{home:5,away:8},
  p1:42,px:27,p2:31,over25:53,under25:47,btts:57,no_btts:43,mu_home:1.4,mu_away:1.2});
 const out=smBuildFocus([example],[],{leagues:{}},clock,ok,()=>({score:'1-1',probability:11}));
 assert.equal(out.matches[0].p1,42);assert.equal(out.coverage.with_prediction,1);
 const bad=smBuildFocus([example],[],{},clock,()=>({...ok(),method:'generic_prior_no_licensed_history'}));
 assert.equal(bad.matches[0].p1,null);
});
test('live score is included and no pre-match Poisson is computed while in-play',()=>{
 const live={...example,status:'LIVE',home_score:1,away_score:0,logos:example.logos};
 const out=smBuildFocus([example],[live],{},clock,()=>{throw Error('should not compute')});
 assert.equal(out.matches.length,1);assert.equal(out.matches[0].home_score,1);
 assert.equal(out.matches[0].p1,null);assert.equal(out.coverage.live_matches,1);
});
test('finished and invalid fixtures are excluded; records remain chronologically sorted',()=>{
 const finished={...example,id:'done',status:'FT'};
 const later={...example,id:'later',date:'2099-10-20T16:00:00.000Z'};
 const out=smBuildFocus([later,finished,example],[],null,clock);
 assert.deepEqual(out.matches.map(x=>x.id),['sportmonks-1','later']);
});
