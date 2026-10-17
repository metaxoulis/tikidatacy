import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalTier,validHistoricalTier} from '../frontend/historical-tier.mjs';
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const poisson=(h,a)=>({p1:45,px:29,p2:26,over25:50,btts:50,mu_home:h,mu_away:a});
const canonical=x=>String(x).toLowerCase();
const helpers={canonical,poisson,clamp};
const team=(m=22)=>({home:{matches:m,for:2.3,against:1.1},away:{matches:m,for:1.4,against:1.3}});
const profile={hmean:1.5,amean:1.1,matches:600,last_result:'2026-09-20',source_counts:{openfootball_cc0:600,sportmonks:0},
 teams:{arsenal:team(),chelsea:team()}};
const model={leagues:{epl:profile},global:{matches:600,hmean:1.5,amean:1.1,last_result:'2026-09-20'}};
test('two matched teams retain verified team tier',()=>{
 const p=historicalTier({league_key:'epl',home:'Arsenal',away:'Chelsea'},model,helpers);
 assert.equal(p.tier,'team');assert.equal(p.method,'openfootball_cc0_fitted_venue_poisson');assert.equal(p.confidence,'experimental');
 assert.equal(validHistoricalTier(p),true);assert.ok(p.mu_home>profile.hmean);
});
test('partial team carries evidence without pretending to have both teams',()=>{
 const p=historicalTier({league_key:'epl',home:'Arsenal',away:'New Team'},model,helpers);
 assert.equal(p.tier,'partial_team');assert.equal(p.confidence,'low');assert.deepEqual(p.team_samples,{home:22,away:0});
 assert.ok(p.mu_home>profile.hmean);
});
test('two unknown teams use historically fitted league means',()=>{
 const p=historicalTier({league_key:'epl',home:'New A',away:'New B'},model,helpers);
 assert.equal(p.tier,'league');assert.equal(p.mu_home,1.5);assert.equal(p.mu_away,1.1);
 assert.equal(p.evidence_source,'licensed_results_from_fixture_league');
});
test('league without a historical sample uses pooled empirical rates and discloses weakness',()=>{
 const p=historicalTier({league_key:'cyprus',home:'AEL',away:'APOEL'},model,helpers);
 assert.equal(p.tier,'cross_league');assert.equal(p.confidence,'very_low');assert.equal(p.data_points,600);
 assert.match(p.model_note,/NOT a team-specific/);
});
test('never create percentages with no historical training support',()=>{
 assert.equal(historicalTier({league_key:'cyprus',home:'AEL',away:'APOEL'},{leagues:{}},helpers),null);
 assert.equal(historicalTier({league_key:'epl',home:'A',away:'B'},{leagues:{epl:{...profile,matches:25}}},helpers),null);
});
