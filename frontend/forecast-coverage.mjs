/* Tiki-Data forecast coverage v28.
 * Numbers are MODEL ESTIMATES, never provider data, never bookmaker odds.
 * When genuine pre-kickoff team observations are absent, the identical league-neutral
 * Poisson prior is explicitly marked as a non-personalized, very-low-confidence baseline.
 * This must NEVER be used to claim verified accuracy, team strength, live probabilities,
 * or historical pre-match forecasts for already-started fixtures.
 */
const CV_FINISHED=new Set(['FT','FINISHED','FULL_TIME','AET','PEN']);
const cvNum=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const cvBound=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const cvKey=m=>String(m?.provider||'sportapi')+':'+String(m?.league_id||m?.league||'');
const cvTeamKey=(m,side)=>cvKey(m)+'|'+String(m?.[side+'_id']||'name:'+String(m?.[side]||'').trim().toLowerCase());
function cvPoisson(homeGoals,awayGoals){
 const h=cvBound(homeGoals,0.25,4),a=cvBound(awayGoals,0.25,4);
 const poisson=x=>{const out=[Math.exp(-x)];for(let i=1;i<=13;i++)out.push(out[i-1]*x/i);return out;};
 const x=poisson(h),y=poisson(a);let mass=0,p1=0,px=0,p2=0,over=0,gg=0;
 for(let i=0;i<x.length;i++)for(let j=0;j<y.length;j++){const p=x[i]*y[j];mass+=p;if(i>j)p1+=p;else if(i===j)px+=p;else p2+=p;if(i+j>=3)over+=p;if(i>0&&j>0)gg+=p;}
 const convert=n=>n/mass*100;
 return {p1:convert(p1),px:convert(px),p2:convert(p2),over25:convert(over),under25:100-convert(over),btts:convert(gg),no_btts:100-convert(gg),mu_home:h,mu_away:a};
}
function cvValid(model){
 return model&&['p1','px','p2','over25','under25','btts','no_btts'].every(k=>cvNum(model[k])!==null&&model[k]>=0&&model[k]<=100)
  &&Math.abs(model.p1+model.px+model.p2-100)<1&&Math.abs(model.over25+model.under25-100)<1&&Math.abs(model.btts+model.no_btts-100)<1;
}
function cvBuildHistory(fixtures){
 const teams=new Map();
 for(const m of fixtures){
  if(!m||!CV_FINISHED.has(String(m.status||'').toUpperCase())||cvNum(m.home_score)===null||cvNum(m.away_score)===null)continue;
  if(!Number.isFinite(Date.parse(m.date))||m.home_score<0||m.home_score>15||m.away_score<0||m.away_score>15)continue;
  const h=cvTeamKey(m,'home'),a=cvTeamKey(m,'away');
  for(const [key,gf,ga] of [[h,m.home_score,m.away_score],[a,m.away_score,m.home_score]]){
   if(!teams.has(key))teams.set(key,[]);
   teams.get(key).push({date:m.date,gf,ga,match_id:String(m.id)});
  }
 }
 for(const list of teams.values())list.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 return teams;
}
function cvRecentRates(history,fixture,side){
 const key=cvTeamKey(fixture,side),rows=history.get(key)||[],cutoff=Date.parse(fixture.date);
 if(!Number.isFinite(cutoff))return null;
 const matches=rows.filter(r=>Date.parse(r.date)<cutoff&&r.match_id!==String(fixture.id)).slice(0,12);
 if(matches.length<3)return null;
 const k=6,prior=1.35;
 const gf=matches.reduce((v,m)=>v+m.gf,0),ga=matches.reduce((v,m)=>v+m.ga,0);
 return {attack:(gf+prior*k)/(matches.length+k),defense:(ga+prior*k)/(matches.length+k),n:matches.length};
}
function cvForecast(fixture,history,validatedInput=null){
 const started=Date.parse(fixture.date)<=Date.now()||CV_FINISHED.has(String(fixture.status||'').toUpperCase())||['LIVE','HT','1H','2H','ET'].includes(String(fixture.status||'').toUpperCase());
 if(cvValid(validatedInput)){
   return {...validatedInput,mu_home:cvNum(validatedInput.mu_home)??cvNum(validatedInput.expected_home_goals),mu_away:cvNum(validatedInput.mu_away)??cvNum(validatedInput.expected_away_goals),confidence:'experimental',coverage:'team_standings',validated:false,retrospective:started};
 }
 const h=cvRecentRates(history,fixture,'home'),a=cvRecentRates(history,fixture,'away');
 if(h&&a){
  const home=cvBound(1.42*(h.attack/1.35)*(a.defense/1.35),.35,3.6),away=cvBound(1.16*(a.attack/1.35)*(h.defense/1.35),.35,3.6);
  return {...cvPoisson(home,away),method:'provisional_poisson_prior_with_observed_results',confidence:'low',coverage:'recent_finished_fixtures',sample_size:{home:h.n,away:a.n},validated:false,retrospective:started};
 }
 return {...cvPoisson(1.42,1.16),method:'generic_poisson_prior_no_team_data',confidence:'very_low',coverage:'no_team_specific_evidence',sample_size:0,validated:false,retrospective:started};
}
function cvForecastAll(fixtures,modeled=new Map()){
 const history=cvBuildHistory(fixtures);
 return fixtures.map(m=>({fixture:m,model:cvForecast(m,history,modeled.get(String(m.id))||null)}));
}
export {cvPoisson,cvForecast,cvForecastAll,cvBuildHistory,cvRecentRates,cvValid};
