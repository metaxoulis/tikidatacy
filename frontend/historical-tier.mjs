/* Tiki-Data: historical-evidence tiers, no arbitrary 1X2 defaults.
 * Fully fitted team rates remain the top tier. Missing teams use empirically
 * trained league rates; leagues with no scores use a pooled, transparent prior.
 */
const FINITE=x=>typeof x==='number'&&Number.isFinite(x);
const methods=new Set(['openfootball_cc0_fitted_venue_poisson','licensed_historical_venue_poisson','partial_team_hierarchical_poisson','league_historical_prior_poisson','cross_league_historical_prior_poisson']);
export function historicalTier(fixture,model,helpers={}){
 const {canonical,poisson,clamp}=helpers;
 if(typeof canonical!=='function'||typeof poisson!=='function'||typeof clamp!=='function')throw Error('missing_tier_dependencies');
 const profile=model?.leagues?.[fixture?.league_key];
 const gh=profile?.hmean??model?.global?.hmean,ga=profile?.amean??model?.global?.amean;
 const n=profile?.matches??model?.global?.matches??0;
 if(!FINITE(gh)||!FINITE(ga)||gh<=0||ga<=0||n<80)return null;
 const home=profile?.teams?.[canonical(fixture.home)]?.home,away=profile?.teams?.[canonical(fixture.away)]?.away;
 const hc=home?.matches??0,ac=away?.matches??0,hs=hc>=3,as=ac>=3;
 const matched=Number(hs)+Number(as);
 const low=.35,high=3.6;
 const factor=(v,mean)=>clamp(FINITE(v)&&v>0?v/mean:1,.45,1.8);
 const muHome=profile?clamp(gh*(hs?factor(home.for,gh):1)*(as?factor(away.against,gh):1),low,high):gh;
 const muAway=profile?clamp(ga*(as?factor(away.for,ga):1)*(hs?factor(home.against,ga):1),low,high):ga;
 const tier=profile?(matched===2?'team':matched===1?'partial_team':'league'):'cross_league';
 const method=tier==='team'?(profile.source_counts?.sportmonks?'licensed_historical_venue_poisson':'openfootball_cc0_fitted_venue_poisson'):
   tier==='partial_team'?'partial_team_hierarchical_poisson':tier==='league'?'league_historical_prior_poisson':'cross_league_historical_prior_poisson';
 return {...poisson(muHome,muAway),method,tier,model_status:tier==='team'?'trained_historical_unvalidated':'historical_prior_unvalidated',
  confidence:tier==='team'?'experimental':tier==='partial_team'?'low':'very_low',
  validated:false,team_samples:{home:hc,away:ac},data_points:n,
  history_latest:profile?.last_result??model?.global?.last_result??null,
  evidence_source:profile?'licensed_results_from_fixture_league':'pooled_other_leagues_only',
  model_note:tier==='cross_league'?'No eligible historical results from this league. This is a cross-league baseline, NOT a team-specific forecast.':
   tier==='league'?'League-level home and away goal rates; no reliable team-specific history.':
   tier==='partial_team'?'One team has verified venue history; the other uses league-average rates.':
   'Both teams have verified home/away historical results.'};
}
export function validHistoricalTier(value){
 return !!value&&methods.has(value.method)&&['team','partial_team','league','cross_league'].includes(value.tier)
  &&[value.p1,value.px,value.p2,value.over25,value.btts,value.mu_home,value.mu_away].every(FINITE)
  &&value.p1>=0&&value.px>=0&&value.p2>=0&&Math.abs(value.p1+value.px+value.p2-100)<1;
}
