/* Numeric publication requires evidence, independently of a club's reputation. */
export function forecastIntegrity(fixture,model,teamKey){
 const home=model?.all_teams?.[teamKey(fixture.home,fixture.home_id,model?.team_identity)]?.home;
 const away=model?.all_teams?.[teamKey(fixture.away,fixture.away_id,model?.team_identity)]?.away;
 const domestic=v=>Object.entries(v?.competitions||{}).filter(([k])=>!['ucl','uel','uecl'].includes(k)).reduce((n,[,count])=>n+count,0);
 const report={status:'eligible',reasons:[],team_samples:{home:home?.matches||0,away:away?.matches||0},domestic_samples:{home:domestic(home),away:domestic(away)}};
 if(['ucl','uel','uecl'].includes(fixture.league_key)){
  if(Math.min(report.domestic_samples.home,report.domestic_samples.away)<6)report.reasons.push('insufficient_domestic_venue_history');
  const v=model?.cross_competition_validation;
  if(!(v?.accepted===true&&v?.independent===true&&v?.n>=80&&v?.candidate_brier<v?.baseline_brier&&v?.candidate_logloss<v?.baseline_logloss&&v?.paired_brier_difference_95pct?.[1]<0))report.reasons.push('cross_competition_calibration_not_established');
 }
 if(report.reasons.length)report.status='withheld';
 return report;
}

/* Cache rows have already passed the provider's finished-state normalizer.
 * Still validate IDs, dates and scores before they can enter training. */
export function normalizedCachedHistory(rows,classify,now=Date.now()){
 const seen=new Set(),out=[];
 for(const r of Array.isArray(rows)?rows:[]){
  if(!Number.isSafeInteger(r.id)||r.id<1||seen.has(r.id)||!Number.isSafeInteger(r.home_id)||!Number.isSafeInteger(r.away_id)||r.home_id<1||r.away_id<1||r.home_id===r.away_id)continue;
  if(typeof r.home!=='string'||!r.home.trim()||typeof r.away!=='string'||!r.away.trim()||!Number.isFinite(Date.parse(r.date))||Date.parse(r.date)>=now-3*86400000)continue;
  if(![r.home_score,r.away_score].every(x=>Number.isInteger(x)&&x>=0&&x<=15)||!Number.isSafeInteger(r.league_id)||r.league_id<1)continue;
  const key=classify(r.league,r.country||'',r.league_id)||'sm'+r.league_id,day=r.date.slice(0,10);
  const year=Number(day.slice(0,4))-(Number(day.slice(5,7))<7?1:0);
  out.push({fixture_id:r.id,league_key:key,dataset_slug:key+'-'+year+'-'+String((year+1)%100).padStart(2,'0'),match_date:day,home_team:r.home,away_team:r.away,home_team_id:r.home_id,away_team_id:r.away_id,home_score:r.home_score,away_score:r.away_score});
  seen.add(r.id);
 }
 return out;
}
