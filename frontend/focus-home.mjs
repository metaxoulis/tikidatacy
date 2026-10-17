/* Tiki-Data focused homepage: real upcoming fixtures + licensed historical score-based research.
 * No raw commercial-provider payload persistence. Only CC0 OpenFootball final scores are used
 * for fitted parameters; predictions are explicitly unvalidated experimental estimates.
 */
// Time-order validation (2025-26, n=1723) selected these rates without seeing the 2026-27 holdout.
const FH_TRAINING={version:'tiki-home-venue-poisson-research-v2',decay_days:360,venue_prior:3,validated:false};
const FH_LEAGUES={
 epl:{name:'Premier League',rank:7,country:/^(england|eng|en|gb|united kingdom)$/},
 laliga:{name:'La Liga',rank:6,country:/^(spain|esp|es)$/},
 bundesliga:{name:'Bundesliga',rank:5,country:/^(germany|de|deu)$/},
 seriea:{name:'Serie A',rank:4,country:/^(italy|it|ita)$/},
 ligue1:{name:'Ligue 1',rank:3,country:/^(france|fr|fra)$/},
 greece:{name:'Ελληνική Super League',rank:8,country:/^(greece|gr|gre)$/},
 cyprus:{name:'Κυπριακή Α΄ Κατηγορία',rank:9,country:/^(cyprus|cy|cyp)$/}
};
const fhText=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
function fhLeague(name,country=''){
 const n=fhText(name).replace(/\s+/g,' '),c=fhText(country);
 let key=null;
 if(/^(premier league|english premier league|england premier league|premier league england|epl)$/.test(n))key='epl';
 else if(/^(la liga|laliga|primera division|spanish la liga|primera division de espana)$/.test(n))key='laliga';
 else if(/^(1\. bundesliga|bundesliga|german bundesliga)$/.test(n))key='bundesliga';
 else if(/^(serie a|italian serie a|serie a italy)$/.test(n))key='seriea';
 else if(/^(ligue 1|ligue 1 mcdonald.s|french ligue 1)$/.test(n))key='ligue1';
 else if(/^(super league|super league 1|greek super league|greece super league|super league greece|stoiximan super league)$/.test(n))key='greece';
 else if(/^(1st division|first division|cyprus 1st division|cyprus first division|cypriot first division|cyprus league|cyprus league by stoiximan|a. katigoria)$/.test(n))key='cyprus';
 if(!key)return null;
 if(c&&!FH_LEAGUES[key].country.test(c))return null;
 // When no country is supplied, exclude ambiguous league labels entirely.
 if(!c&&['epl','seriea','greece','cyprus','bundesliga'].includes(key)&&
    !/^(english premier league|england premier league|premier league england|italian serie a|serie a italy|german bundesliga|greek super league|greece super league|super league greece|cyprus 1st division|cyprus first division|cypriot first division|cyprus league|cyprus league by stoiximan)$/.test(n))return null;
 return key;
}
const fhName=x=>{
 let n=fhText(x).replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\b(fc|cf|afc|sc|ac|club|football|futbol)\b/g,'').replace(/\s+/g,' ').trim();
 const aliases={'man city':'manchester city','man utd':'manchester united','man united':'manchester united','tottenham':'tottenham hotspur','newcastle utd':'newcastle united','nottm forest':'nottingham forest','wolves':'wolverhampton wanderers','inter':'internazionale','inter milan':'internazionale','atletico madrid':'atletico de madrid','bayern munich':'bayern munchen','bayern munchen':'bayern munchen','psg':'paris saint germain','paris sg':'paris saint germain','olympiacos':'olympiakos','olympiacos piraeus':'olympiakos','olympiakos piraeus':'olympiakos'};
 return aliases[n]||n;
};
const fhClamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function fhTrain(rows,asOfDate=new Date()){
 const cutoff=Date.parse(new Date(asOfDate).toISOString().slice(0,10)+'T00:00:00Z')-3*86400000;
 const groups=new Map(),allow=new Set(['epl','laliga','bundesliga','seriea','ligue1','greece']);
 for(const r of rows){
  const league=String(r.dataset_slug||'').split('-').slice(0,-2).join('-');
  const date=Date.parse(String(r.match_date||'')+'T00:00:00Z');
  const gh=r.home_score,ga=r.away_score;
  if(!allow.has(league)||!Number.isFinite(date)||date>=cutoff||!Number.isInteger(gh)||!Number.isInteger(ga)||gh<0||ga<0||gh>15||ga>15)continue;
  if(!groups.has(league))groups.set(league,[]);
  groups.get(league).push({day:date,home:fhName(r.home_team),away:fhName(r.away_team),gh,ga});
 }
 const result={};
 for(const [league,list] of groups){
  if(list.length<80)continue;
  const tau=FH_TRAINING.decay_days,weights=list.map(x=>Math.exp(-(cutoff-x.day)/86400000/tau));
  const sum=weights.reduce((a,b)=>a+b,0);
  if(sum<=0)continue;
  const lh=fhClamp(list.reduce((v,x,i)=>v+weights[i]*x.gh,0)/sum,.55,2.7);
  const la=fhClamp(list.reduce((v,x,i)=>v+weights[i]*x.ga,0)/sum,.45,2.6);
  const teams=new Map();
  list.forEach((x,i)=>{
   for(const [key,venue,gf,ga] of [[x.home,'home',x.gh,x.ga],[x.away,'away',x.ga,x.gh]]){
    if(!teams.has(key))teams.set(key,{home:[],away:[]});
    teams.get(key)[venue].push({gf,ga,w:weights[i]});
   }
  });
  const profiles={};
  for(const [name,venues] of teams){
   const rec={};
   for(const venue of ['home','away']){
    const rows=venues[venue],mass=rows.reduce((a,x)=>a+x.w,0),prior=FH_TRAINING.venue_prior;
    const baseFor=venue==='home'?lh:la,baseAgainst=venue==='home'?la:lh;
    rec[venue]={for:(rows.reduce((a,x)=>a+x.w*x.gf,0)+prior*baseFor)/(mass+prior),
                 against:(rows.reduce((a,x)=>a+x.w*x.ga,0)+prior*baseAgainst)/(mass+prior),matches:rows.length};
   }
   profiles[name]=rec;
  }
  result[league]={league,trained_from:'OpenFootball CC0-1.0 historical finished scores',matches:list.length,last_result:new Date(Math.max(...list.map(x=>x.day))).toISOString().slice(0,10),hmean:lh,amean:la,teams:profiles};
 }
 return {model_version:FH_TRAINING.version,trained_at:new Date(asOfDate).toISOString(),cutoff:new Date(cutoff).toISOString().slice(0,10),decay_days:FH_TRAINING.decay_days,venue_prior:FH_TRAINING.venue_prior,status:'experimental_unvalidated',leagues:result};
}
function fhLikelyScore(lh,la){let top={score:'—',prob:0};let mass=0;const poisson=(lambda,n)=>Math.exp(-lambda)*Math.pow(lambda,n)/[1,1,2,6,24,120,720,5040][n];for(let i=0;i<=7;i++)for(let j=0;j<=7;j++){const p=poisson(lh,i)*poisson(la,j);mass+=p;if(p>top.prob)top={score:i+'-'+j,prob:p};}return{score:top.score,probability:top.prob/mass*100};}
function fhPoisson(h,a){
 const pmf=l=>{const p=[Math.exp(-l)];for(let i=1;i<=12;i++)p.push(p[i-1]*l/i);return p;};
 const x=pmf(h),y=pmf(a);let sum=0,one=0,draw=0,two=0,over=0,gg=0;
 for(let i=0;i<x.length;i++)for(let j=0;j<y.length;j++){const v=x[i]*y[j];sum+=v;if(i>j)one+=v;else if(i===j)draw+=v;else two+=v;if(i+j>2)over+=v;if(i>0&&j>0)gg+=v;}
 return{p1:100*one/sum,px:100*draw/sum,p2:100*two/sum,over25:100*over/sum,under25:100*(1-over/sum),btts:100*gg/sum,no_btts:100*(1-gg/sum),mu_home:h,mu_away:a};
}
function fhEstimate(fixture,model){
 const profile=model?.leagues?.[fixture.league_key];
 if(!profile)return{...fhPoisson(1.42,1.16),method:'generic_prior_no_licensed_history',confidence:'very_low',data_points:0,model_status:'not_trained_for_league',validated:false};
 const home=profile.teams[fhName(fixture.home)]?.home,away=profile.teams[fhName(fixture.away)]?.away;
 if(!home||!away||home.matches<3||away.matches<3)
  return {...fhPoisson(profile.hmean,profile.amean),method:'historical_league_baseline_no_verified_team_match',confidence:'very_low',data_points:profile.matches,model_status:'team_history_unmatched',validated:false,history_latest:profile.last_result};
 const lh=fhClamp(profile.hmean*(home.for/profile.hmean)*(away.against/profile.amean),.35,3.6);
 const la=fhClamp(profile.amean*(away.for/profile.amean)*(home.against/profile.hmean),.35,3.6);
 return {...fhPoisson(lh,la),method:'openfootball_cc0_fitted_venue_poisson',confidence:'experimental',data_points:profile.matches,team_samples:{home:home.matches,away:away.matches},model_status:'trained_historical_unvalidated',history_latest:profile.last_result,validated:false};
}
async function fhLoadModel(db,ctx){
 if(!db)return null;
 const key=FH_TRAINING.version;
 try{
  const row=await db.prepare('SELECT payload_json,expires_at FROM focus_model_snapshots WHERE model_key=?1').bind(key).first();
  if(row&&Number(row.expires_at)>Date.now()/1000)return JSON.parse(row.payload_json);
 }catch{}
 try{
  const result=await db.prepare("SELECT dataset_slug,match_date,home_team,away_team,home_score,away_score FROM openfootball_matches WHERE match_status='FINISHED' AND home_score IS NOT NULL AND away_score IS NOT NULL LIMIT 6500").all();
  if(!Array.isArray(result.results)||result.results.length<80)return null;
  const model=fhTrain(result.results);
  const task=db.prepare('INSERT INTO focus_model_snapshots(model_key,payload_json,expires_at,trained_at) VALUES(?1,?2,?3,?4) ON CONFLICT(model_key) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at,trained_at=excluded.trained_at').bind(key,JSON.stringify(model),Math.floor(Date.now()/1000)+21600,model.trained_at).run();
  if(ctx?.waitUntil)ctx.waitUntil(task.catch(()=>{}));else await task.catch(()=>{});
  return model;
 }catch{return null;}
}
const fhFuture=m=>m&&Number.isFinite(Date.parse(m.date))&&Date.parse(m.date)>Date.now()+60000&&!['FT','FINISHED','FULL_TIME','AET','PEN','LIVE','HT','1H','2H','ET','POSTPONED','CANCELLED'].includes(String(m.status||'').toUpperCase());
function fhSelect(fixtures,model,limit=7){
 const valid=fixtures.filter(fhFuture).filter(m=>m.league_key&&FH_LEAGUES[m.league_key]).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||FH_LEAGUES[b.league_key].rank-FH_LEAGUES[a.league_key].rank);
 const dedup=new Map();
 for(const m of valid){
  const k=m.league_key+'|'+String(m.date).slice(0,16)+'|'+fhName(m.home)+'|'+fhName(m.away);
  const prev=dedup.get(k);
  if(!prev||(prev.provider==='allsportsapi'&&m.provider==='sportapi.ai'))dedup.set(k,m);
 }
 // Only genuine matched historic home-and-away venue samples qualify.
 // No league-only priors or generic 43/26/31 scorelines are publicly published.
 const group=[...dedup.values()],vetted=[];
 for(const m of group){
  const estimate=fhEstimate(m,model);
  if(estimate.method!=='openfootball_cc0_fitted_venue_poisson'||!estimate.team_samples
   ||estimate.team_samples.home<3||estimate.team_samples.away<3)continue;
  vetted.push({...m,model:{...estimate,most_likely_score:fhLikelyScore(estimate.mu_home,estimate.mu_away)}});
 }
 const first=[],seen=new Set();
 for(const m of vetted){if(!seen.has(m.league_key)){first.push(m);seen.add(m.league_key);}}
 const next=[...first,...vetted.filter(m=>!first.includes(m))].slice(0,limit);
 return {featured:next[0]||null,upcoming:next.slice(1),matches:vetted,
  fixtures_available:vetted.length,real_fixtures_seen:group.length,
  leagues_available:[...new Set(vetted.map(m=>m.league_key))].map(k=>FH_LEAGUES[k].name)};
}
const fhJSON=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':status===200?'public,max-age=600':'no-store','X-Content-Type-Options':'nosniff'}});
/* Sportmonks live fixtures alone feed the UI. Training remains CC0 and separate. */
function fhSMLeague(name,country){
 const mapped=fhLeague(name,country);
 if(mapped)return mapped;
 if(fhText(country)==='cyprus'&&fhText(name).replace(/[.\s]+/g,' ').trim()==='1 division')return 'cyprus';
 return null;
}
function fhSMDisplay(fixtures,model){
 const now=Date.now(),eligible=fixtures.filter(fhFuture);
 const matches=eligible.map(m=>{
  const estimate=fhEstimate(m,model);
  const covered=estimate.method==='openfootball_cc0_fitted_venue_poisson'&&
    estimate.team_samples?.home>=3&&estimate.team_samples?.away>=3;
  return {...m,model:covered?{...estimate,most_likely_score:fhLikelyScore(estimate.mu_home,estimate.mu_away)}:null};
 }).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const featured=matches.find(m=>m.model)||matches[0]||null;
 return{matches,featured,upcoming:matches.filter(m=>m!==featured).slice(0,6),
   predictions_available:matches.filter(m=>!!m.model).length};
}
async function fhHomeResponse(req,env,ctx){
 if(req.method!=='GET')return fhJSON({error:'method_not_allowed'},405);
 if(!env?.SPORTMONKS_API_TOKEN)return fhJSON({error:'sportmonks_not_configured',message:'Η υπηρεσία αγώνων δεν έχει ρυθμιστεί.'},503);
 const cache=typeof caches!=='undefined'?caches.default:null;
 const cacheKey=new Request('https://tiki-cache.local/focus-home-v4');
 try{const hit=await cache?.match(cacheKey);if(hit)return hit;}catch{}
 try{if(env?.TIKI_DB){
  const r=await env.TIKI_DB.prepare("SELECT payload_json FROM sportapi_home_cache WHERE cache_key='focus_v4' AND expires_at>?1")
   .bind(Math.floor(Date.now()/1000)).first();
  if(r?.payload_json)return fhJSON(JSON.parse(r.payload_json));
 }}catch{}
 try{
  const today=new Date().toISOString().slice(0,10);
  const [week,model]=await Promise.all([
   smWeek(today,env.SPORTMONKS_API_TOKEN,fhSMLeague,fetch,7),
   fhLoadModel(env?.TIKI_DB,ctx)]);
  const selection=fhSMDisplay(week.fixtures,model);
  const shown=m=>({
   id:m.id,league:m.league,league_key:m.league_key,date:m.date,status:m.status,
   home:m.home,away:m.away,logos:m.logos,league_logo:m.league_logo,
   model:m.model||null,home_score:null,away_score:null,
   p1:m.model?.p1??null,px:m.model?.px??null,p2:m.model?.p2??null,
   over25:m.model?.over25??null,under25:m.model?.under25??null,
   btts:m.model?.btts??null,no_btts:m.model?.no_btts??null,
   mu_home:m.model?.mu_home??null,mu_away:m.model?.mu_away??null,
   most_likely_score:m.model?.most_likely_score??null,
   coverage:m.model?'verified_historical_inputs':'no_team_specific_evidence',
   method:m.model?.method??null,validated:false,
   history_latest:m.model?.history_latest??null,
   historical_sample:m.model?.team_samples??null});
  const result={
   source:'Sportmonks',updated_at:new Date().toISOString(),
   range:Array.from({length:7},(_,i)=>smAddDay(today,i)),
   coverage:{matches:selection.matches.length,competitions:new Set(selection.matches.map(m=>m.league_key)).size,
    predictions:selection.predictions_available},
   featured:selection.featured?shown(selection.featured):null,
   upcoming:selection.upcoming.map(shown),matches:selection.matches.map(shown),
   leagues_with_matches:[...new Set(selection.matches.map(m=>m.league_key))].map(k=>FH_LEAGUES[k]?.name||k),
   incomplete_week:week.partial,dates_successful:week.dates_successful,
   model:{name:'CC0 historical venue Poisson v2 (experimental)',training_parameters:{
    decay_days:model?.decay_days||null,venue_prior:model?.venue_prior||null},
    historical_matches:Object.values(model?.leagues||{}).reduce((n,l)=>n+(l.matches||0),0),
    trained_at:model?.trained_at||null,historical_cutoff:model?.cutoff||null,
    validated:false,note:'Πιθανότητες μόνο όταν υπάρχουν αντιστοιχισμένα τελικά αποτελέσματα των δύο ομάδων.'}
  };
  if(env?.TIKI_DB&&ctx?.waitUntil&&model){
   const eligible=selection.matches.filter(m=>m.model&&Date.parse(m.date)>Date.now()+2*3600000);
   if(eligible.length)ctx.waitUntil(Promise.allSettled(eligible.map(m=>
    env.TIKI_DB.prepare("INSERT OR IGNORE INTO prospective_forecast_log (fixture_key,created_at,model_version,data_cutoff,source_sync_at,ph,pd,pa) VALUES (?1,datetime('now'),?2,?3,?4,?5,?6,?7)")
    .bind('sportmonks:'+m.id+':'+m.date,model.model_version,model.cutoff,result.updated_at,
      m.model.p1/100,m.model.px/100,m.model.p2/100).run())));
  }
  const response=fhJSON(result,200);
  try{ctx?.waitUntil?.(cache?.put(cacheKey,response.clone()))}catch{}
  if(env?.TIKI_DB&&ctx?.waitUntil){
   ctx.waitUntil(env.TIKI_DB.prepare("INSERT INTO sportapi_home_cache(cache_key,payload_json,expires_at,saved_at) VALUES('focus_v4',?1,?2,?3) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at,saved_at=excluded.saved_at")
    .bind(JSON.stringify(result),Math.floor(Date.now()/1000)+300,new Date().toISOString()).run().catch(()=>{}));
  }
  return response;
 }catch(e){
  const reason=String(e?.message||'sportmonks_unavailable').slice(0,90);
  return fhJSON({error:'sportmonks_unavailable',reason,message:'Οι τρέχοντες αγώνες δεν είναι διαθέσιμοι.'},503);
 }
}
async function fhLiveResponse(req,env,ctx){
 if(req.method!=='GET')return fhJSON({error:'method_not_allowed'},405);
 if(!env?.SPORTMONKS_API_TOKEN)return fhJSON({error:'not_configured'},503);
 const key=new Request('https://tiki-cache.local/sportmonks-inplay-v1');
 const cache=typeof caches!=='undefined'?caches.default:null;
 try{const hit=await cache?.match(key);if(hit)return hit;}catch{}
 try{
  const list=await smInplay(env.SPORTMONKS_API_TOKEN,fhSMLeague);
  const response=new Response(JSON.stringify({updated_at:new Date().toISOString(),matches:list}),{
   status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public,max-age=20'}});
  try{ctx?.waitUntil?.(cache?.put(key,response.clone()))}catch{}
  return response;
 }catch{return fhJSON({error:'live_unavailable',matches:[]},503)}
}

export {fhLeague,fhName,fhTrain,fhEstimate,fhSelect,fhHomeResponse,fhLiveResponse,fhSMLeague,fhSMDisplay,FH_LEAGUES};
