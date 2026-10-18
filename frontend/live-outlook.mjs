/* Tiki-Data in-play what-if engine: conditional independent Poisson, not a certified forecast. */
const FITTED=new Set(['openfootball_cc0_fitted_venue_poisson','licensed_historical_venue_poisson','form_based_live_poisson_v1']);
const percent=x=>Math.round(x*10000)/100;
const pmf=(lambda,max=11)=>{const p=[Math.exp(-lambda)];for(let k=1;k<=max;k++)p.push(p[k-1]*lambda/k);return p;};
export function liveOutlook(game,estimate){
 const h=game?.home_score,a=game?.away_score,minute=game?.minute;
 if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h>15||a>15)return null;
 if(!Number.isInteger(minute)||minute<0||minute>=90)return null;
 if(!FITTED.has(estimate?.method)||estimate?.team_samples?.home<3||estimate?.team_samples?.away<3)return null;
 const lh=estimate.mu_home,la=estimate.mu_away;
 if(!Number.isFinite(lh)||!Number.isFinite(la)||lh<=0||la<=0||lh>5||la>5)return null;
 const frac=(90-minute)/90,muH=lh*frac,muA=la*frac;
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
 return {source:'tiki_conditional_poisson_v1',experimental:true,validated:false,
  based_on:estimate.method==='form_based_live_poisson_v1'?'recent_verified_scores_and_actual_score_and_match_minute':'verified_team_fitted_prematch_rates_plus_actual_score_and_match_minute',
  fixture_id:game.id,minute,observed_score:[h,a],remaining_standard_minutes:90-minute,
  remaining_expected_goals:{home:Number(muH.toFixed(3)),away:Number(muA.toFixed(3))},
  p1:percent(one/total),px:percent(draw/total),p2:percent(two/total),
  over25:percent(over/total),under25:percent(1-over/total),btts:percent(gg/total),
  next_goal:{home:percent(anyGoal*muH/sum),away:percent(anyGoal*muA/sum),none:percent(noGoal)},
  most_likely_final:{score:top.h+'-'+top.a,probability:percent(top.p/total)},
  warning:'Unvalidated simplified independent Poisson. Recent-form fallback uses verified final scores only, not observed live shots or xG; no injuries, substitutions, red-card adjustments or extra time.'};
}
