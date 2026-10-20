/* Completed observations only. Extra metrics affect 1X2 only after the
 * independent temporal holdout gate passes; missing values are never zero. */
const TD_STATS_MODEL='tiki:statistics-calibration:v1',TD_STATS_SNAPSHOT='tiki:statistics-snapshot:v1';
const TD_STATS_TEAM='tiki:statistics-team:v1:',TD_STATS_CURSOR='tiki:statistics-cursor:v1';
function tdStatsNumber(v){return typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e6?v:null}
function tdNormalizeStatistics(rows){
 const out=[];
 for(const r of Array.isArray(rows)?rows:[]){
  if(r.state_id!==5)continue;
  const ps=Array.isArray(r.participants)?r.participants:[],h=ps.find(p=>p.meta?.location==='home'),a=ps.find(p=>p.meta?.location==='away');
  if(!h||!a||!Number.isSafeInteger(h.id)||!Number.isSafeInteger(a.id))continue;
  const goals=id=>(r.scores||[]).find(s=>s.participant_id===id&&s.description==='CURRENT')?.score?.goals;
  const hg=goals(h.id),ag=goals(a.id);if(!Number.isInteger(hg)||!Number.isInteger(ag)||hg<0||ag<0||hg>15||ag>15)continue;
  const date=String(r.starting_at||'').replace(' ','T').replace(/Z?$/,'Z');if(!Number.isFinite(Date.parse(date)))continue;
  const stats={[h.id]:{},[a.id]:{}},xi={[h.id]:[],[a.id]:[]};
  for(const s of Array.isArray(r.statistics)?r.statistics:[]){
   const code=s.type?.code||'type-'+s.type_id,value=tdStatsNumber(s.data?.value);
   if(Object.hasOwn(stats,s.participant_id)&&value!==null)stats[s.participant_id][code]=value;
  }
  for(const s of [...(r.xgfixture||[]),...(r.xGFixture||[]),...(r.expected||[])]){
   const id=s.participant_id??s.team_id,value=tdStatsNumber(s.data?.value??s.value);
   if(s.type_id===5304&&Object.hasOwn(stats,id)&&value!==null)stats[id]['expected-goals']=value;
  }
  for(const p of Array.isArray(r.lineups)?r.lineups:[])if(p.type_id===11&&Object.hasOwn(xi,p.team_id)&&Number.isSafeInteger(p.player_id))xi[p.team_id].push(p.player_id);
  out.push({id:r.id,date,league_id:r.league_id,league:r.league?.name||'',home_id:h.id,away_id:a.id,home:h.name,away:a.name,home_score:hg,away_score:ag,stats,xi});
 }
 return out;
}
function tdStatisticsProfile(rows,teamId,kickoff){
 const start=Date.parse(kickoff),id=String(teamId),seen=new Set();
 const eligible=(Array.isArray(rows)?rows:[]).filter(r=>{
  const date=Date.parse(r.date);if(seen.has(r.id)||!Number.isFinite(date)||date>=start-3*86400000||date<start-120*86400000||![r.home_id,r.away_id].includes(Number(teamId)))return false;
  seen.add(r.id);return true;
 }).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,12);
 const out={n:eligible.length,for:{},against:{},coverage:{},competitions:{},rest:eligible.length?Math.min(21,(start-Date.parse(eligible[0].date))/86400000):null,latest:eligible[0]?.date||null};
 for(const r of eligible)out.competitions[r.league_id]=(out.competitions[r.league_id]||0)+1;
 for(const side of ['for','against']){
  const observations=eligible.map(r=>({data:r.stats?.[side==='for'?id:String(r.home_id===Number(teamId)?r.away_id:r.home_id)]||{},weight:Math.exp(-(start-Date.parse(r.date))/(45*86400000))}));
  for(const code of new Set(observations.flatMap(o=>Object.keys(o.data)))){
   const available=observations.filter(o=>tdStatsNumber(o.data[code])!==null);out.coverage[side+':'+code]=available.length;
   if(available.length>=3)out[side][code]=available.reduce((v,o)=>v+o.data[code]*o.weight,0)/available.reduce((v,o)=>v+o.weight,0);
  }
 }
 return out;
}
function tdStatisticsGate(model){
 const h=model?.holdout,c=model?.codes;
 return !!(model?.active===true&&model.status==='accepted_temporal_holdout'&&h?.n>=40&&h.candidate_brier<h.baseline_brier*.98&&h.candidate_logloss<h.baseline_logloss&&h.paired_brier_difference_95pct?.[1]<0&&Array.isArray(c)&&model.coefficients?.length===c.length*2+3&&model.means?.length===c.length*2+2&&model.scales?.length===model.means.length);
}
function tdStatisticsAdjustment(base,home,away,calibration,poisson){
 if(!tdStatisticsGate(calibration)||Math.min(home?.n||0,away?.n||0)<3||!(base?.mu_home>0&&base?.mu_away>0))return null;
 const rate=(attack,defence,mu)=>{
  const raw=[...calibration.codes.map(k=>attack.for[k]),...calibration.codes.map(k=>defence.against[k]),attack.rest,defence.rest];let v=calibration.coefficients[0];
  for(let i=0;i<raw.length;i++){const x=tdStatsNumber(raw[i]);if(x!==null)v+=calibration.coefficients[i+1]*Math.max(-4,Math.min(4,(x-calibration.means[i])/calibration.scales[i]));}
  return mu*Math.exp(Math.max(-.35,Math.min(.35,v)));
 };
 const p=poisson(rate(home,away,base.mu_home),rate(away,home,base.mu_away));
 return [p.p1,p.px,p.p2].every(Number.isFinite)&&Math.abs(p.p1+p.px+p.p2-100)<.01?{...p,method:'temporally_evaluated_multistat_poisson',validated:false,confidence:'experimental',forecast_source:'multistat_model_temporal_gate'}:null;
}
async function tdStatisticsStatus(env){
 const [model,snapshot]=await Promise.all([env.MATCHIQ_CACHE?.get(TD_STATS_MODEL,'json'),env.MATCHIQ_CACHE?.get(TD_STATS_SNAPSHOT,'json')]);
 if(!model)return {status:'not_evaluated',active:false};
 const {coefficients,means,scales,...safe}=model;
 return {...safe,active:tdStatisticsGate(model),snapshot_at:snapshot?.generated_at||null,uefa_matches_covered:Object.keys(snapshot?.matches||{}).length,live_accuracy_verified:false};
}
async function tdAttachStatisticalEvidence(env,selected){
 if(!env.MATCHIQ_CACHE||!Array.isArray(selected?.matches))return;
 const [cal,snapshot]=await Promise.all([env.MATCHIQ_CACHE.get(TD_STATS_MODEL,'json').catch(()=>null),env.MATCHIQ_CACHE.get(TD_STATS_SNAPSHOT,'json').catch(()=>null)]);
 if(!cal||!snapshot)return;
 for(const m of selected.matches){
  if(!['ucl','uel','uecl'].includes(m.league_key))continue;
  const e=snapshot.matches?.[m.id];if(!e||e.home_id!==m.home_id||e.away_id!==m.away_id||e.date!==m.date)continue;
  const fresh=Date.now()-Date.parse(e.fetched_at||snapshot.generated_at)<48*3600000;
  m.statistical_evidence={...e,calibration_status:cal.status,applied_to_probabilities:false,additional_statistics_stale:!fresh,metrics_considered:cal.codes.length,holdout:cal.holdout,source:'sportmonks_all_competitions_completed_fixtures'};
  const p=fresh?tdStatisticsAdjustment(m,e.home,e.away,cal,fhPoisson):null;
  if(p){Object.assign(m,p);m.model={...m.model,...p};m.statistical_evidence.applied_to_probabilities=true;}
 }
}
async function tdRefreshStatistics(env){
 if(!env.MATCHIQ_CACHE||!env.SPORTMONKS_API_TOKEN)return;
 const now=new Date().toISOString(),start=now.slice(0,10),end=smAddDay(start,6);
 const fixtures=await smPages('fixtures/between/'+start+'/'+end,env.SPORTMONKS_API_TOKEN,fetch,{params:{include:'participants;league;state;scores',filters:'fixtureLeagues:2,5,2286'},maxPages:4});
 const games=[];
 for(const r of fixtures){
  if(![2,5,2286].includes(r.league_id))continue;
  const m=smNormalizeFixture(r,new Map([[r.league_id,{key:{2:'ucl',5:'uel',2286:'uecl'}[r.league_id],name:r.league?.name||'',country:'Europe'}]]));
  if(m&&Date.parse(m.date)>Date.now())games.push(m);
 }
 games.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));const ids=[...new Set(games.flatMap(m=>[m.home_id,m.away_id]))];if(!ids.length)return;
 const cursor=Number(await env.MATCHIQ_CACHE.get(TD_STATS_CURSOR)||0)%ids.length,chosen=Array.from({length:Math.min(12,ids.length)},(_,i)=>ids[(cursor+i)%ids.length]);
 for(let i=0;i<chosen.length;i+=3)await Promise.allSettled(chosen.slice(i,i+3).map(async id=>{
  const from=smAddDay(start,-120),to=smAddDay(start,-1);let raw;
  try{raw=await smPages('fixtures/between/'+from+'/'+to+'/'+id,env.SPORTMONKS_API_TOKEN,fetch,{params:{include:'participants;league;state;scores;statistics.type;lineups;xGFixture',order:'desc'},maxPages:3})}
  catch{raw=await smPages('fixtures/between/'+from+'/'+to+'/'+id,env.SPORTMONKS_API_TOKEN,fetch,{params:{include:'participants;league;state;scores;statistics.type',order:'desc'},maxPages:3})}
  await env.MATCHIQ_CACHE.put(TD_STATS_TEAM+id,JSON.stringify({fetched_at:now,rows:tdNormalizeStatistics(raw)}));
 }));
 await env.MATCHIQ_CACHE.put(TD_STATS_CURSOR,String((cursor+chosen.length)%ids.length));
 const teamRows=new Map(await Promise.all(ids.map(async id=>[id,await env.MATCHIQ_CACHE.get(TD_STATS_TEAM+id,'json').catch(()=>null)])));
 const matches={};
 for(const m of games){const h=teamRows.get(m.home_id),a=teamRows.get(m.away_id);if(!h||!a)continue;
  matches[m.id]={home_id:m.home_id,away_id:m.away_id,date:m.date,home:tdStatisticsProfile(h.rows,m.home_id,m.date),away:tdStatisticsProfile(a.rows,m.away_id,m.date),fetched_at:h.fetched_at<a.fetched_at?h.fetched_at:a.fetched_at};
 }
 await env.MATCHIQ_CACHE.put(TD_STATS_SNAPSHOT,JSON.stringify({generated_at:now,scope:'upcoming_uefa_only',matches}));
}

export {tdNormalizeStatistics,tdStatisticsProfile,tdStatisticsGate,tdStatisticsAdjustment};
