/* Tiki-Data in-play what-if engine: conditional independent Poisson, not a certified forecast. */
const FITTED=new Set(['openfootball_cc0_fitted_venue_poisson','licensed_historical_venue_poisson','form_based_live_poisson_v1']);
const percent=x=>Math.round(x*10000)/100;
const pmf=(lambda,max=11)=>{const p=[Math.exp(-lambda)];for(let k=1;k<=max;k++)p.push(p[k-1]*lambda/k);return p;};
/** Conservative, untrained in-play adjustment from verified, paired provider stats.
 * Distinct signal families limit correlation and caps stop noisy counters
 * overwhelming score, match minute and historical rates. Never synthesize stats.
 */
export function liveStatsFactors(stats,minute){
 const neutral={home:1,away:1,applied:false,metrics_used:[],log_pressure:0,method:'live_stats_shrinkage_v1'};
 if(!Array.isArray(stats)||!Number.isInteger(minute)||minute<0||minute>=90)return neutral;
 const limits={on_target:75,shots:150,dangerous:500,attacks:1000,possession:100,corners:80,red:5};
 const values=new Map();
 for(const row of stats){
  const key=row?.key;
  if(!Object.hasOwn(limits,key))continue;
  const h=row?.home,a=row?.away,max=limits[key];
  if(!Number.isFinite(h)||!Number.isFinite(a)||h<0||a<0||h>max||a>max)continue;
  values.set(key,{h,a});
 }
 const metrics=[],share=(key,weight,smoothing)=>{
  const pair=values.get(key);if(!pair)return 0;
  metrics.push(key);
  return weight*(pair.h-pair.a)/(pair.h+pair.a+smoothing);
 };
 let pressure=0;
 // Shots on target are strongest; total shots are secondary, not another full signal.
 if(values.has('on_target')){
  pressure+=share('on_target',.50,3);
  pressure+=share('shots',.10,9);
 }else pressure+=share('shots',.34,9);
 // Dangerous attacks replace attacks instead of being double-counted.
 if(values.has('dangerous'))pressure+=share('dangerous',.22,28);
 else pressure+=share('attacks',.10,65);
 pressure+=share('corners',.05,5);
 const possession=values.get('possession');
 if(possession&&possession.h+possession.a>=90&&possession.h+possession.a<=110){
  metrics.push('possession');pressure+=.07*(possession.h-possession.a)/100;
 }
 // A numerical red-card disadvantage is separate from correlated pressure stats.
 const red=values.get('red'),redPressure=red?.h!==red?.a
  ?.16*Math.max(-2,Math.min(2,red.a-red.h)):0;
 if(red)metrics.push('red');
 pressure=pressure*Math.min(1,minute/30)+redPressure;
 pressure=Math.max(-.26,Math.min(.26,pressure));
 if(!metrics.length||Math.abs(pressure)<1e-10)return {...neutral,metrics_used:metrics};
 return {home:Math.exp(pressure),away:Math.exp(-pressure),applied:true,
  metrics_used:metrics,log_pressure:Number(pressure.toFixed(4)),method:'live_stats_shrinkage_v1'};
}

export function liveOutlook(game,estimate,stats=game?.live_stats){
 const h=game?.home_score,a=game?.away_score,minute=game?.minute;
 if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h>15||a>15)return null;
 if(!Number.isInteger(minute)||minute<0||minute>=90)return null;
 if(!FITTED.has(estimate?.method)||estimate?.team_samples?.home<3||estimate?.team_samples?.away<3)return null;
 const lh=estimate.mu_home,la=estimate.mu_away;
 if(!Number.isFinite(lh)||!Number.isFinite(la)||lh<=0||la<=0||lh>5||la>5)return null;
 const adjustment=liveStatsFactors(stats,minute);
 const frac=(90-minute)/90,muH=lh*frac*adjustment.home,muA=la*frac*adjustment.away;
 const H=pmf(muH),A=pmf(muA);
 let total=0,one=0,draw=0,two=0,over=0,gg=0,top={p:-1,h,a};
 for(let i=0;i<H.length;i++)for(let j=0;j<A.length;j++){
  const w=H[i]*A[j],gh=h+i,ga=a+j;
  total+=w;
  if(gh>ga)one+=w;else if(gh===ga)draw+=w;else two+=w;
  if(gh+ga>=3)over+=w;
  if(gh>0&&ga>0)gg+=w;
  if(w>top.p)top={p:w,h:gh,a:ga};
 }
 if(total<.98||total>1.01)return null;
 const sum=muH+muA,noGoal=Math.exp(-sum),anyGoal=1-noGoal;
 return {source:'tiki_conditional_poisson_v2',experimental:true,validated:false,
  live_stats_applied:adjustment.applied,live_stats_adjustment:adjustment,
  based_on:(estimate.method==='form_based_live_poisson_v1'?'recent_verified_scores_and_actual_score_and_match_minute':'verified_team_fitted_prematch_rates_plus_actual_score_and_match_minute')+(adjustment.applied?'_plus_verified_live_stats':''),
  fixture_id:game.id,minute,observed_score:[h,a],remaining_standard_minutes:90-minute,
  remaining_expected_goals:{home:Number(muH.toFixed(3)),away:Number(muA.toFixed(3))},
  p1:percent(one/total),px:percent(draw/total),p2:percent(two/total),
  over25:percent(over/total),under25:percent(1-over/total),btts:percent(gg/total),
  next_goal:{home:percent(anyGoal*muH/sum),away:percent(anyGoal*muA/sum),none:percent(noGoal)},
  most_likely_final:{score:top.h+'-'+top.a,probability:percent(top.p/total)},
  warning:'Experimental uncalibrated Poisson with bounded live-stat shrinkage when provider statistics are present; other missing inputs remain unavailable. No independent proof of improved accuracy or extra-time projection.'};
}
