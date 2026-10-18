/* Optional historical context, based on verified finished Sportmonks fixtures.
 * European matches are included by team ID, never merged with similarly named clubs.
 * All coefficients are provisional; availability is explicit and no xG is fabricated.
 */
const cxClamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function tdTeamContext(rows,teamId,kickoff){
 const start=Date.parse(kickoff),id=Number(teamId),all=[];
 if(!Number.isFinite(start)||!Number.isSafeInteger(id)||id<1)return null;
 for(const r of Array.isArray(rows)?rows:[]){
  const date=Date.parse(String(r.starting_at||'').replace(' ','T')+'Z');
  if(!Number.isFinite(date)||date>=start-86400000||date<start-124*86400000)continue;
  if(!(r.state_id===5||['FT','FINISHED','FULL TIME'].includes(String(r.state?.short_name||'').toUpperCase())))continue;
  const ps=Array.isArray(r.participants)?r.participants:[];
  if(!ps.some(p=>Number(p?.id)===id))continue;
  const opponent=ps.find(p=>Number(p?.id)!==id&&Number.isSafeInteger(Number(p?.id)));
  if(!opponent)continue;
  const xg=[...(Array.isArray(r.expected)?r.expected:[]),...(Array.isArray(r.xgfixture)?r.xgfixture:[]),...(Array.isArray(r.xGFixture)?r.xGFixture:[])];
  const value=i=>{const a=xg.find(v=>Number(v.participant_id??v.team_id)===i&&(v.type_id===5304||v.type?.code==='expected-goals'));const n=a?.data?.value??a?.value;return n!=null&&Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=12?Number(n):null;};
  const xi=(Array.isArray(r.lineups)?r.lineups:[]).filter(p=>Number(p.team_id)===id&&Number(p.type_id)===11&&Number.isSafeInteger(Number(p.player_id))).map(p=>Number(p.player_id));
  all.push({date,europe:/uefa|champions league|europa league|conference league/i.test(String(r.league?.name||'')),
   xgf:value(id),xga:value(Number(opponent.id)),xi:xi.length>=10?xi.slice(0,11):[]});
 }
 all.sort((a,b)=>b.date-a.date);
 const latest=all.slice(0,12),observed=latest.filter(r=>r.xgf!==null&&r.xga!==null);
 const avg=k=>observed.length?observed.reduce((s,r)=>s+r[k],0)/observed.length:null;
 return {source:'sportmonks_finished_fixtures',latest_day:latest.length?new Date(latest[0].date).toISOString().slice(0,10):null,
  matches:latest.length,european_matches:latest.filter(r=>r.europe).length,observed_xg:observed.length,
  european_xg:observed.filter(r=>r.europe).length,avg_xgf:avg('xgf'),avg_xga:avg('xga'),
  recent_xi:latest.filter(r=>r.xi.length>=10).slice(0,4).map(r=>r.xi)};
}
function tdXIContinuity(xi,history){
 if(!Array.isArray(xi)||xi.length<10||!Array.isArray(history?.recent_xi)||history.recent_xi.length<2)return null;
 const playing=xi.map(p=>Number(p?.id)).filter(Number.isSafeInteger);
 if(playing.length<10)return null;
 const freq=new Map();for(const past of history.recent_xi)for(const id of new Set(past))freq.set(id,(freq.get(id)||0)+1);
 const common=[...freq].sort((a,b)=>b[1]-a[1]).slice(0,11).map(x=>x[0]);
 return common.length>=10?playing.filter(id=>common.includes(id)).length/11:null;
}
function tdContextForecast(base,home,away,poisson,homeXI=null,awayXI=null){
 if(!base||base.prediction_tier!=='team'||!(base.mu_home>0&&base.mu_away>0)||
  !home||!away||home.observed_xg<4||away.observed_xg<4)return null;
 if(![home.avg_xgf,home.avg_xga,away.avg_xgf,away.avg_xga].every(v=>Number.isFinite(v)&&v>=0))return null;
 const hx=tdXIContinuity(homeXI,home),ax=tdXIContinuity(awayXI,away);
 const homeShift=cxClamp(.1*((home.avg_xgf-1.4)+(away.avg_xga-1.4))/2+(hx===null?0:.035*(hx-.8)),-.075,.075);
 const awayShift=cxClamp(.1*((away.avg_xgf-1.2)+(home.avg_xga-1.2))/2+(ax===null?0:.035*(ax-.8)),-.075,.075);
 const result=poisson(cxClamp(base.mu_home*(1+homeShift),.35,3.6),cxClamp(base.mu_away*(1+awayShift),.35,3.6));
 if(![result.p1,result.px,result.p2].every(Number.isFinite))return null;
 return {...result,method:'experimental_observed_xg_xi_v1',prediction_tier:'team',validated:false,confidence:'experimental',
  context:{source:'sportmonks_completed_fixtures',observed_xg:{home:home.observed_xg,away:away.observed_xg},
   european_matches:{home:home.european_matches,away:away.european_matches},
   european_xg:{home:home.european_xg,away:away.european_xg},
   avg_xgf:{home:home.avg_xgf,away:away.avg_xgf},avg_xga:{home:home.avg_xga,away:away.avg_xga},
   confirmed_xi_continuity:{home:hx,away:ax},validated:false,
   note:'European games contribute only if verified historical fixture xG exists. XI continuity is a proxy, not calibrated causal player impact.'}};
}
export {tdTeamContext,tdXIContinuity,tdContextForecast};
