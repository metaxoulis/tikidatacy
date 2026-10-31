import {faTrialMatch,faTrialCached,faTrialRoute,faTrialLineups,faTrialStatistics} from './football-trial.mjs';
import {faRecentLineupEvidence,faEnrichProviderLineups} from './recent-lineup-evidence.mjs';
import {faMatchKits} from './team-kits.mjs';
/* Main provider adapter. Football-API and legacy Sportmonks IDs never share a namespace. */
/* Covered: top-5 leagues, Greek and Cypriot top flights, UEFA, and the domestic cups of those seven countries.
   Cups with a known Football-API ID also have their schedule fetched; other cups are accepted by exact name
   when they appear live, so lower divisions (National League, Coppa Italia Serie C...) stay out. */
export const FA_COMPETITIONS={1:'bundesliga',2:'epl',3:'laliga',4:'seriea',5:'ligue1',9:'greece',44:'cyprus',244:'ucl',245:'uel',446:'uecl',150:'fa150',167:'fa167',171:'fa171'};
const FA_CUPS={
 England:/^(?:FA Cup|EFL Cup|League Cup|Community Shield)$/i,
 Spain:/^(?:Copa del Rey|Super ?Cup|Supercopa(?: de Espa(?:n|ñ)a)?)$/i,
 Germany:/^(?:DFB Cup|DFB[ -]Pokal|Super ?Cup|DFL[ -]Supercup)$/i,
 Italy:/^(?:Coppa Italia|Super ?Cup|Supercoppa(?: Italiana)?)$/i,
 France:/^(?:Coupe de France|Super ?Cup|Troph(?:e|é)e des Champions)$/i,
 Greece:/^(?:Cup|Greek Cup|Super ?Cup)$/i,
 Cyprus:/^(?:Cup|Cyprus Cup|Super ?Cup)$/i};
export const faCoveredCompetition=row=>FA_COMPETITIONS[row?.competition_id]||
 (row?.competition_id&&FA_CUPS[row.country]?.test(String(row.league||''))?'fa'+row.competition_id:null);
const faPrimaryLiveStatus=new Set(['LIVE','1ST','2ND','HT','ET','BREAK','PEN_LIVE']);
export function faPrimaryGame(row){
 if(!row?.date||!Number.isFinite(Date.parse(row.date)))return null;
 const key=faCoveredCompetition(row);
 if(!key)return null;
 // The clock reads "64", "45+" or "90+" in added time, and "PS" during a penalty shoot-out. "ADDED TIME" is play too;
 // a numeric minute past 90 under "IN PLAY" is extra time (regular added time shows as "90+").
 const clock=String(row.minute||''),min=/^(\d{1,3})(?:\+\d{0,2})?$/.exec(clock),at=min?Number(min[1]):null;
 const playing=row.status==='IN PLAY'||row.status==='ADDED TIME';
 const status=row.status==='FINISHED'?'FT':row.status==='HALF TIME BREAK'?'HT':row.status==='EXTRA TIME'?'ET':
  row.status==='PENALTY SHOOTOUT'||playing&&clock==='PS'?'PEN_LIVE':playing?(at!==null&&at<=45?'1ST':at!==null&&at>90?'ET':'2ND'):'NS';
 return {...row,id:row.fixture_id?'football-api-fixture-'+row.fixture_id:'football-api-'+row.match_id,
  league_key:key,league:['ucl','uel','uecl'].includes(key)?'UEFA '+row.league:row.country&&/^Cup$/i.test(row.league)?row.country+' Cup':row.league,
  status,minute:status==='NS'?null:min?Number(min[1]):null,logos:{home:null,away:null},events:[],lineups:[],statistics:[],live_stats:[],match_statistics_available:false};
}
export function faPrimaryFixture(raw){
 const row=faTrialMatch({...raw,scheduled:raw.time,status:'NS',fixture_id:raw.id});
 if(!row)return null;const game=faPrimaryGame(row);return game?{...game,match_id:null}:null;
}
export function faLegacyTeamId(name,model,nameKey){
 const aliases={'paok thessaloniki fc':'PAOK','aris thessaloniki fc':'Aris','ofi crete':'OFI','apoel nicosia':'APOEL'};
 const canonical=aliases[String(name).toLowerCase()]||name,n=nameKey(canonical);
 if(model?.team_identity?.ambiguous?.includes(n))return null;
 const value=model?.team_identity?.aliases?.[n];return /^sportmonks:[1-9]\d*$/.test(value||'')?Number(value.split(':')[1]):null;
}
export function faForecastIdentity(game,model,nameKey,identities=null){
 const resolve=(id,name)=>{const mapped=identities?.get(id);return Number.isSafeInteger(mapped)&&mapped>0?mapped:faLegacyTeamId(name,model,nameKey)};
 const h=resolve(game.home_id,game.home),a=resolve(game.away_id,game.away);
 return {...game,home_id:h&&h!==a?h:null,away_id:a&&h!==a?a:null};
}
export function faHistoricalIdentity(game,model,nameKey,identities=null){
 const g=faForecastIdentity(game,model,nameKey,identities);
 return g.home_id&&g.away_id?g:null;
}
/* Badges stored in D1 (team_badges, keyed by Football-API team ID) are served from /badges/<id>.png.
   Each side is resolved on its own; the archived Sportmonks CDN image is only a fallback. */
export function faTeamLogos(game,model,badges,nameKey){
 const legacy=name=>{const id=model?faLegacyTeamId(name,model,nameKey):null;return id?'/archived-badges/'+id+'.png':null};
 const pick=(id,name)=>badges?.has(id)?'/badges/'+id+'.png':legacy(name);
 return {home:pick(game.home_id,game.home),away:pick(game.away_id,game.away)};
}
/* Competition logos (league_logos) are served from /league-logos/<key>.png; cups whose Football-API ID is
   unknown are keyed by name, e.g. name-england-fa-cup. */
export const faLeagueLogoKey=game=>'name-'+String((game.country||'')+' '+(game.league||'')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function faLeagueLogo(game,leagues){
 const key=leagues?.has(game.league_key)?game.league_key:leagues?.has(faLeagueLogoKey(game))?faLeagueLogoKey(game):null;
 return key?'/league-logos/'+key+'.png':null;
}
let faBadgeCache={at:0,ids:new Set(),leagues:new Set(),identities:new Map()};
async function faBadgeIds(env,now=Date.now()){
 if(now-faBadgeCache.at<600000)return faBadgeCache.ids;
 try{const [t,l,identity]=await Promise.all([env.TIKI_DB.prepare('SELECT fa_team_id FROM team_badges').all(),env.TIKI_DB.prepare('SELECT league_key FROM league_logos').all().catch(()=>({results:[]})),env.TIKI_DB.prepare('SELECT fa_team_id,sportmonks_team_id FROM fa_team_identity').all().catch(()=>({results:[]}))]);
  faBadgeCache={at:now,ids:new Set((t.results||[]).map(x=>x.fa_team_id)),leagues:new Set((l.results||[]).map(x=>x.league_key)),identities:new Map((identity.results||[]).map(x=>[x.fa_team_id,x.sportmonks_team_id]))}}
 catch{faBadgeCache={at:now,ids:new Set(),leagues:new Set(),identities:new Map()}}
 return faBadgeCache.ids;
}
const FA_BADGE_TYPES=new Set(['image/png','image/jpeg','image/webp']);
export async function faLeagueLogoRoute(env,key){
 const missing=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'public, max-age=300'}});
 if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(key))||!env.TIKI_DB)return missing();
 try{const row=await env.TIKI_DB.prepare('SELECT image,content_type,image_sha256 FROM league_logos WHERE league_key=?1').bind(key).first();
  if(!row?.image||!FA_BADGE_TYPES.has(row.content_type))return missing();
  return new Response(new Uint8Array(row.image),{headers:{'Content-Type':row.content_type,'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800',
   'ETag':'"'+row.image_sha256+'"','X-Content-Type-Options':'nosniff'}});
 }catch{return missing()}
}
export async function faBadgeRoute(env,id){
 const missing=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'public, max-age=300'}});
 if(!/^[1-9]\d{0,9}$/.test(String(id))||!env.TIKI_DB)return missing();
 try{const row=await env.TIKI_DB.prepare('SELECT image,content_type,image_sha256 FROM team_badges WHERE fa_team_id=?1').bind(Number(id)).first();
  if(!row?.image||!FA_BADGE_TYPES.has(row.content_type))return missing();
  return new Response(new Uint8Array(row.image),{headers:{'Content-Type':row.content_type,'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800',
   'ETag':'"'+row.image_sha256+'"','X-Content-Type-Options':'nosniff'}});
 }catch{return missing()}
}
async function faPrimaryScheduled(env){
 const start=new Date().toISOString().slice(0,10),end=smAddDay(start,6),games=[],failures=[];
 const ids=Object.keys(FA_COMPETITIONS);let cursor=0;
 await Promise.all(Array.from({length:3},async()=>{while(cursor<ids.length){const competition=ids[cursor++];
  for(let page=1;page<=3;page++){
   const key='fixtures-primary-'+competition+'-'+start+'-'+page;
   const r=await faTrialCached(env,key,'/fixtures/list.json',{competition_id:competition,page},1800000,d=>{
    if(!Array.isArray(d?.fixtures))throw Error('provider_invalid_response');
    return {games:d.fixtures.map(faPrimaryFixture).filter(Boolean),next:!!d.next_page};
   });
   if(r.error||r.stale)failures.push(competition);
   if(!r.data)break;
   games.push(...r.data.games.filter(g=>g.date.slice(0,10)>=start&&g.date.slice(0,10)<=end));
   const last=r.data.games.at(-1);
   if(!r.data.next||last&&last.date.slice(0,10)>end)break;
   if(page===3)failures.push(competition);
  }
 }}));
 return {games,partial:failures.length>0};
}
/* In-play evidence from the provider's match statistics. With xG, each team's remaining scoring rate is its
   historical rate shrunk towards its xG rate in this match; the history counts as two matches of play, so the match
   weighs 5% after ten minutes and a third at full time, and one early penalty cannot redefine a team. Without xG, shots on target, shots, corners and possession shift only the split between the
   teams, as the earlier Sportmonks live model did: ramped in over 30 minutes, at most x1.30 either way. A red-card
   difference shifts the split in both cases. */
export function faLiveEvidence(stats,minute){
 const v=new Map();
 for(const s of Array.isArray(stats)?stats:[])if([s?.home,s?.away].every(n=>Number.isFinite(n)&&n>=0&&n<=200))v.set(s.type,{h:s.home,a:s.away});
 const played=Math.max(1,Math.min(Number(minute)||0,120)),xg=v.get('expected_goals'),red=v.get('red_cards'),metrics=[];
 const redShift=red&&red.h!==red.a&&red.h<=4&&red.a<=4?.16*Math.max(-2,Math.min(2,red.a-red.h)):0;
 if(redShift)metrics.push('red_cards');
 if(xg&&xg.h<=10&&xg.a<=10)return {method:'provider_xg_shrinkage',xg:{home:xg.h,away:xg.a},minutes_played:played,prior_minutes:180,split:redShift,metrics:['expected_goals',...metrics]};
 const share=(k,w,smooth)=>{const p=v.get(k);if(!p)return 0;metrics.push(k);return w*(p.h-p.a)/(p.h+p.a+smooth)};
 let pressure=v.has('shots_on_target')?share('shots_on_target',.5,3)+share('attempts_on_goal',.1,9):share('attempts_on_goal',.34,9);
 pressure+=share('corners',.05,5);
 const pos=v.get('possesion');if(pos&&pos.h+pos.a>=90&&pos.h+pos.a<=110){metrics.push('possesion');pressure+=.07*(pos.h-pos.a)/100}
 pressure=Math.max(-.26,Math.min(.26,pressure*Math.min(1,played/30)+redShift));
 return Math.abs(pressure)>1e-9?{method:'shot_share_shift',minutes_played:played,split:pressure,metrics}:null;
}
export function faLivePredictor(game,model,fitted=null,stats=null){
 if(!faPrimaryLiveStatus.has(game.status)||![game.home_score,game.away_score].every(n=>Number.isInteger(n)&&n>=0&&n<=30)||game.status==='PEN_LIVE')return null;
 const minute=game.status==='HT'?45:game.minute;
 if(!Number.isInteger(minute)||minute<0||minute>130)return null;
 const league=model?.leagues?.[game.league_key],global=model?.global;
 const valid=r=>r&&[r.hmean,r.amean].every(n=>Number.isFinite(n)&&n>0&&n<=5)&&r.matches>=80;
 const team=fitted?.tier==='team'&&[fitted.mu_home,fitted.mu_away].every(n=>Number.isFinite(n)&&n>0&&n<=5);
 const prior=valid(league)?league:valid(global)?global:{hmean:1.45,amean:1.15};
 const basis=team?'team_history':valid(league)?'league_average':valid(global)?'global_average':'generic_assumption';
 const duration=game.status==='ET'?120:90,remaining=Math.max(1,duration-minute);
 const base={home:team?fitted.mu_home:prior.hmean,away:team?fitted.mu_away:prior.amean},evidence=stats?faLiveEvidence(stats,minute):null;
 let rh=base.home,ra=base.away;
 if(evidence?.xg){const k=evidence.prior_minutes,t=evidence.minutes_played;rh=(rh*k+90*evidence.xg.home)/(k+t);ra=(ra*k+90*evidence.xg.away)/(k+t)}
 if(evidence?.split){rh*=Math.exp(evidence.split);ra*=Math.exp(-evidence.split)}
 rh=Math.min(6,rh);ra=Math.min(6,ra);
 const mh=rh*remaining/90,ma=ra*remaining/90;
 const pmf=x=>{const a=[Math.exp(-x)];for(let i=1;i<=18;i++)a.push(a[i-1]*x/i);return a};
 const H=pmf(mh),A=pmf(ma);let total=0,one=0,draw=0,two=0,over=0,btts=0,best={p:-1,h:0,a:0};
 for(let i=0;i<H.length;i++)for(let j=0;j<A.length;j++){
  const w=H[i]*A[j],h=game.home_score+i,a=game.away_score+j;total+=w;
  if(h>a)one+=w;else if(h===a)draw+=w;else two+=w;
  if(h+a>2)over+=w;if(h>0&&a>0)btts+=w;if(w>best.p)best={p:w,h,a};
 }
 const pct=n=>Math.round(n/total*10000)/100,any=1-Math.exp(-mh-ma);
 return {source:'football_api_conditional_poisson',experimental:true,validated:false,prior_basis:basis,
  fixture_id:game.id,minute:game.minute,calculation_minute:minute,phase:game.status,observed_score:[game.home_score,game.away_score],
  time_basis:game.status==='HT'?'halftime_45':minute>=duration?'one_minute_remaining_assumption':'reported_match_minute',
  remaining_standard_minutes:remaining,live_stats_applied:!!evidence,live_evidence:evidence,
  scoring_rates:{historical:base,used:{home:rh,away:ra}},
  p1:pct(one),px:pct(draw),p2:pct(two),over25:pct(over),under25:pct(total-over),btts:pct(btts),
  remaining_expected_goals:{home:mh,away:ma},next_goal:{home:any*mh/(mh+ma)*100,away:any*ma/(mh+ma)*100,none:(1-any)*100},
  most_likely_final:{score:best.h+'-'+best.a,probability:pct(best.p)},
  warning:'Experimental conditional Poisson. Average-rate priors are not team-strength forecasts. HT uses 45 minutes; late play assumes at least one remaining minute. '+
   (evidence?'Live statistics adjust the historical scoring rates; the blend weights are not yet validated.':'No live statistics were available.')+' No penalty-shootout forecast.'};
}
function faPrimaryForecast(game,model,badges,stats=null){
 game={...game,logos:faTeamLogos(game,model,badges,fhName),league_logo:faLeagueLogo(game,faBadgeCache.leagues)};
 const legacy=faForecastIdentity(game,model,fhName,faBadgeCache.identities);
 const review=forecastIntegrity(legacy,model,fhTeamKey);
 const fitted=fhEstimate(legacy,model,{allowHistoricalPriors:true});
 if(!fitted)return {...game,p1:null,px:null,p2:null,model:null,coverage:'stored_model_unavailable',forecast_review:review,live_outlook:null};
 const live=faPrimaryLiveStatus.has(game.status),outlook=live?faLivePredictor(game,model,fitted,stats):null;
 const p={...fitted,prediction_tier:fitted.tier,most_likely_score:fhLikelyScore(fitted.mu_home,fitted.mu_away),
  experimental:true,validated:false,limited_evidence:fitted.tier!=='team'};
 const display=live&&outlook?outlook:p;
 return {...game,...display,model:p,experimental_preview:!live&&review.status==='withheld'?p:null,
  prematch_prediction:live?{...p,source:'tiki_prematch_experimental_reference'}:null,
  live_outlook:outlook?{...outlook,model_version:model.model_version,historical_cutoff:model.cutoff}:null,
  forecast_review:review,historical_sample:fitted.team_samples,model_coverage:fitted.team_samples,
  coverage:fitted.tier==='team'?'verified_historical_inputs':'limited_historical_inputs',forecast_source:'published_trained_model',forecast_calculated_at:model.trained_at,
  historical_identity:{home:legacy.home_id?'sportmonks:'+legacy.home_id:null,away:legacy.away_id?'sportmonks:'+legacy.away_id:null,method:'verified_id_map_or_unique_archived_alias'},
  analysis_provenance:outlook?.live_stats_applied?'historical_score_minute_live_statistics':'historical_score_minute_no_live_statistics',live_stats:[],statistics:[]};
}
async function faPrimarySnapshot(req,env){
 const r=await faTrialRoute(new Request(new URL('/api/football-trial/live',req.url)),env);const data=await r.json();
 return {...data,matches:(data.matches||[]).map(faPrimaryGame).filter(Boolean)};
}
/* Feed and match-page responses are served from the data centre's Cache API, stale-while-revalidate: a copy
   younger than `fresh` is returned as is; an older one (up to ten minutes) is returned at once while a rebuild runs in
   the background, so a visitor never waits for the provider or the model. Only a cold cache builds in the request,
   and an isolate rebuilds a key once at a time. */
const faEdgeBuilding=new Set();
export async function faEdgeCached(key,ctx,fresh,build,now=Date.now){
 const cache=globalThis.caches?.default,id=new Request('https://tiki-cache.local/fa-edge-v1/'+key);
 const serve=r=>{const h=new Headers(r.headers);h.set('Cache-Control','no-store');h.delete('X-Tiki-Built-At');return new Response(r.body,{status:r.status,headers:h})};
 const store=async r=>{
  if(!cache||r.status!==200)return r;
  const h=new Headers(r.headers);h.set('Cache-Control','public, max-age=600');h.set('X-Tiki-Built-At',String(now()));
  const body=await r.arrayBuffer();await cache.put(id,new Response(body,{status:200,headers:h})).catch(()=>{});
  return new Response(body,{status:200,headers:r.headers});
 };
 const hit=cache?await cache.match(id).catch(()=>null):null;
 const age=hit?now()-Number(hit.headers.get('X-Tiki-Built-At')||0):Infinity;
 if(hit&&age<fresh)return serve(hit);
 if(hit&&age<600000&&ctx?.waitUntil){
  if(!faEdgeBuilding.has(key)){faEdgeBuilding.add(key);ctx.waitUntil(Promise.resolve().then(build).then(store).catch(()=>{}).finally(()=>faEdgeBuilding.delete(key)))}
  return serve(hit);
 }
 return serve(await store(await build()));
}
/* Live statistics for the live predictor. Read from the shared provider cache (match pages refresh it every two
   minutes); a live match nobody has open is refreshed in the background every five minutes, so every live
   forecast can use its statistics for about 25 provider requests per match. */
const FA_LIVE_STATS_TTL=300000,FA_LIVE_STATS_MAX_AGE=480000;
export async function faCachedLiveStats(env,games,now=Date.now()){
 const ids=games.filter(g=>faPrimaryLiveStatus.has(g.status)&&Number.isSafeInteger(g.match_id)).slice(0,90).map(g=>'statistics-'+g.match_id);
 if(!ids.length||!env?.FOOTBALL_TRIAL_DB)return new Map();
 const rows=(await env.FOOTBALL_TRIAL_DB.prepare('SELECT cache_key,payload_json,fetched_at FROM football_trial_cache WHERE cache_key IN ('+ids.map((_,i)=>'?'+(i+1)).join(',')+')')
  .bind(...ids).all().catch(()=>({results:[]}))).results||[];
 return new Map(rows.filter(r=>r.payload_json&&now-r.fetched_at<=FA_LIVE_STATS_MAX_AGE).map(r=>[Number(r.cache_key.slice(11)),{stats:JSON.parse(r.payload_json),fetched_at:r.fetched_at}]));
}
export function faRefreshLiveStats(env,games,cached,now=Date.now(),fetcher=fetch){
 const due=games.filter(g=>faPrimaryLiveStatus.has(g.status)&&g.status!=='PEN_LIVE'&&Number.isSafeInteger(g.match_id)&&!(now-(cached.get(g.match_id)?.fetched_at||0)<FA_LIVE_STATS_TTL)).slice(0,8);
 return Promise.allSettled(due.map(g=>faTrialCached(env,'statistics-'+g.match_id,'/statistics/matches.json',{match_id:g.match_id},FA_LIVE_STATS_TTL,faTrialStatistics,fetcher,now)));
}
export function faPrimaryLive(req,env,ctx){return faEdgeCached('live',ctx,10000,()=>faPrimaryLiveBuild(req,env,ctx))}
async function faPrimaryLiveBuild(req,env,ctx){
 try{const [snapshot,model,badges]=await Promise.all([faPrimarySnapshot(req,env),tdPublishedModel(env),faBadgeIds(env)]);
  const playing=snapshot.matches.filter(g=>faPrimaryLiveStatus.has(g.status)&&!g.source_stale&&Number.isInteger(g.home_score)&&Number.isInteger(g.away_score)&&(Number.isInteger(g.minute)||['HT','PEN_LIVE'].includes(g.status)));
  const cached=await faCachedLiveStats(env,playing);
  if(ctx?.waitUntil)ctx.waitUntil(faRefreshLiveStats(env,playing,cached));
  const matches=playing.map(g=>faPrimaryForecast(g,model,badges,cached.get(g.match_id)?.stats||null));
  return smResponse({...snapshot,mode:'primary',source:'football-api.com',processing:'football_api_score_minute_historical_model',matches,model_unavailable:!model,pending:!snapshot.updated_at,refreshing:false,match_statistics_available:false},snapshot.updated_at?200:503,15);
 }catch{return smResponse({source:'football-api.com',error:'football_api_live_unavailable',matches:[],stale:true,pending:true},503)}
}
/* Prospective audit log, as before the migration: each published pre-match forecast more than two hours
   before kickoff, once per model version and data cutoff (the table's UNIQUE key). */
const faLogged=new Set();
export function faForecastLogWrites(env,matches,model,now=Date.now()){
 if(!env?.TIKI_DB||!model)return [];
 if(faLogged.size>5000)faLogged.clear();
 const stamp=new Date(now).toISOString();
 return matches.filter(g=>g.status==='NS'&&g.model&&[g.p1,g.px,g.p2].every(Number.isFinite)&&Date.parse(g.date)>now+2*3600000&&!faLogged.has(g.id+'|'+model.cutoff)).slice(0,20)
  .map(g=>{faLogged.add(g.id+'|'+model.cutoff);
   return env.TIKI_DB.prepare("INSERT OR IGNORE INTO prospective_forecast_log (fixture_key,created_at,model_version,data_cutoff,source_sync_at,ph,pd,pa) VALUES (?1,datetime('now'),?2,?3,?4,?5,?6,?7)")
    .bind(g.id+':'+g.date,model.model_version,model.cutoff,stamp,g.p1/100,g.px/100,g.p2/100)});
}
export function faPrimaryFocus(req,env,ctx){return faEdgeCached('focus',ctx,20000,()=>faPrimaryFocusBuild(req,env,ctx))}
async function faPrimaryFocusBuild(req,env,ctx){
 try{const [schedule,snapshot,model,badges]=await Promise.all([faPrimaryScheduled(env),faPrimarySnapshot(req,env),tdPublishedModel(env),faBadgeIds(env)]);
  const map=new Map(schedule.games.map(g=>[g.id,g]));
  for(const game of snapshot.matches)map.set(game.id,game);
  const shown=[...map.values()].filter(g=>g.status==='NS'?Date.parse(g.date)>Date.now()-60000:faPrimaryLiveStatus.has(g.status)&&!g.source_stale),cached=await faCachedLiveStats(env,shown);
  const matches=shown.map(g=>faPrimaryForecast(g,model,badges,cached.get(g.match_id)?.stats||null)).sort((a,b)=>a.date.localeCompare(b.date));
  const future=matches.filter(g=>g.status==='NS'),featured=future.find(g=>g.model)||future[0]||matches[0]||null;
  const available=matches.filter(g=>g.model).length;
  const logs=faForecastLogWrites(env,matches,model);
  if(logs.length&&ctx?.waitUntil)ctx.waitUntil(env.TIKI_DB.batch(logs).catch(()=>{}));
  return smResponse({source:'football-api.com',processing:'football_api_primary',updated_at:new Date().toISOString(),matches,featured,upcoming:future.filter(g=>g!==featured).slice(0,6),
   range:Array.from({length:7},(_,i)=>smAddDay(new Date().toISOString().slice(0,10),i)),stale:false,partial:schedule.partial,
   coverage:{matches:matches.length,competitions:new Set(matches.map(g=>g.league_key)).size,with_prediction:available,without_prediction:matches.length-available,live_matches:snapshot.matches.filter(g=>faPrimaryLiveStatus.has(g.status)).length},
   model:{name:'Tiki-Data historical Poisson',trained_at:model?.trained_at||null,historical_cutoff:model?.cutoff||null,validated:false},model_unavailable:!model,model_predictions_available:available,usage:snapshot.usage,match_statistics_available:false},200,30);
 }catch{return smResponse({source:'football-api.com',error:'football_api_schedule_unavailable',matches:[],stale:true},503)}
}
/* Finished results for match-page panels, keyed by the model's Sportmonks team identities: the Sportmonks archive
   table, then results synced from Football-API. Small indexed lookups in one batch per table (never a scan), and a
   match present in both sources (26-28 Oct overlap) is counted once. */
const FA_RESULT_SOURCES=[['sportmonks_training_results','fixture_id','archived-sportmonks-'],['football_training_results','fa_match_id','football-api-']];
export async function faTeamResults(db,a,b,before){
 const rows=new Map(),h2h=new Map();
 for(const [table,idCol,prefix] of FA_RESULT_SOURCES){
  const cols=idCol+' AS id,dataset_slug,match_date,home_team,away_team,home_team_id,away_team_id,home_score,away_score,league_key';
  const stmts=[
   db.prepare('SELECT '+cols+' FROM '+table+' WHERE home_team_id IN (?1,?2) AND match_date<?3 ORDER BY match_date DESC LIMIT 60').bind(a,b,before),
   db.prepare('SELECT '+cols+' FROM '+table+' WHERE away_team_id IN (?1,?2) AND match_date<?3 ORDER BY match_date DESC LIMIT 60').bind(a,b,before),
   db.prepare('SELECT '+cols+' FROM '+table+' WHERE ((home_team_id=?1 AND away_team_id=?2) OR (home_team_id=?2 AND away_team_id=?1)) AND match_date<?3 ORDER BY match_date DESC LIMIT 5').bind(a,b,before)];
  let out;try{out=db.batch?await db.batch(stmts):await Promise.all(stmts.map(x=>x.all()))}catch{continue}
  out.forEach((r,i)=>{for(const x of r?.results||[]){const key=x.match_date+'|'+x.home_team_id+'|'+x.away_team_id,row={...x,id:prefix+x.id};
   if(!rows.has(key))rows.set(key,row);if(i===2&&!h2h.has(key))h2h.set(key,row)}});
 }
 const newest=(x,y)=>y.match_date.localeCompare(x.match_date);
 return {rows:[...rows.values()].sort(newest),h2h:[...h2h.values()].sort(newest)};
}
export async function faPrimaryHistory(env,legacy,fixture,found=null){
 const empty={home:[],away:[],head_to_head:[],source:'archived_and_synced_results'};if(!legacy||!env.TIKI_DB)return empty;
 try{const {rows:all,h2h}=found||await faTeamResults(env.TIKI_DB,legacy.home_id,legacy.away_id,fixture.date.slice(0,10));
  const row=r=>({id:r.id,date:r.match_date,home:r.home_team,away:r.away_team,home_id:r.home_team_id,away_id:r.away_team_id,home_score:r.home_score,away_score:r.away_score,league:r.league_key});
  const recent=id=>all.filter(r=>r.home_team_id===id||r.away_team_id===id).slice(0,8).map(r=>{const h=r.home_team_id===id?r.home_score:r.away_score,a=r.home_team_id===id?r.away_score:r.home_score;return {...row(r),result:h>a?'W':h===a?'D':'L'}});
  return {...empty,home:recent(legacy.home_id),away:recent(legacy.away_id),head_to_head:h2h.slice(0,5).map(row)};
 }catch{return empty}
}
/* 2026-27 home record of the home club and away record of the away club, from the same lookups, with the training
   embargo (results older than three days). Same shape as the former td_2026_27_team_form view. */
export function faSeasonForm(found,legacy,now=Date.now()){
 const cutoff=new Date(Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z')-3*86400000).toISOString().slice(0,10);
 const venue=(id,side)=>{
  const games=(found?.rows||[]).filter(r=>r[side+'_team_id']===id&&String(r.dataset_slug).endsWith('-2026-27')&&r.match_date>='2026-07-01'&&r.match_date<cutoff);
  if(!games.length)return null;
  const gf=r=>side==='home'?r.home_score:r.away_score,ga=r=>side==='home'?r.away_score:r.home_score,uefa=r=>['ucl','uel','uecl'].includes(r.league_key);
  return {team_id:id,venue:side,played:games.length,wins:games.filter(r=>gf(r)>ga(r)).length,draws:games.filter(r=>gf(r)===ga(r)).length,
   losses:games.filter(r=>gf(r)<ga(r)).length,goals_for:games.reduce((n,r)=>n+gf(r),0),goals_against:games.reduce((n,r)=>n+ga(r),0),
   uefa_matches:games.filter(uefa).length,domestic_matches:games.filter(r=>!uefa(r)).length};
 };
 return {season:'2026-27',source:'stored_final_results',current_season_only:true,training_cutoff_exclusive:cutoff,probability_model:false,
  home:venue(legacy.home_id,'home'),away:venue(legacy.away_id,'away')};
}
/* Match statistics for the Stats tab ({type,side,value} per team), labelled in Greek from this list (the site's
   language switch translates them) and shown in this order. Unknown types are dropped. Counters the provider rarely
   tracks (attacks, throw-ins...) are hidden when both teams show 0, which means "not recorded". */
const FA_STAT_LABELS={possesion:'Κατοχή',attempts_on_goal:'Σουτ',shots_on_target:'Σουτ στην εστία',shots_off_target:'Σουτ εκτός εστίας',
 shots_blocked:'Μπλοκαρισμένα σουτ',corners:'Κόρνερ',fauls:'Φάουλ',offsides:'Οφσάιντ',saves:'Αποκρούσεις',yellow_cards:'Κίτρινες κάρτες',
 red_cards:'Κόκκινες κάρτες',penalties:'Πέναλτι',dangerous_attacks:'Επικίνδυνες επιθέσεις',attacks:'Επιθέσεις',free_kicks:'Ελεύθερα λακτίσματα',
 goal_kicks:'Άουτ εστίας',throw_ins:'Πλάγια άουτ',substitutions:'Αλλαγές',treatments:'Περιθάλψεις'};
const FA_STAT_ORDER=Object.keys(FA_STAT_LABELS);
const FA_STAT_OPTIONAL=new Set(['dangerous_attacks','attacks','free_kicks','goal_kicks','throw_ins','substitutions','treatments']);
export function faDetailStatistics(rows){
 return (Array.isArray(rows)?rows:[]).filter(x=>Object.hasOwn(FA_STAT_LABELS,x?.type)&&!(FA_STAT_OPTIONAL.has(x.type)&&!x.home&&!x.away))
  .sort((a,b)=>FA_STAT_ORDER.indexOf(a.type)-FA_STAT_ORDER.indexOf(b.type)).flatMap(x=>{
   const label=FA_STAT_LABELS[x.type],fmt=v=>v===null?null:x.type==='possesion'?v+'%':v;
   return [{type:label,code:x.type,side:'home',value:fmt(x.home)},{type:label,code:x.type,side:'away',value:fmt(x.away)}]});
}
/* The provider's own xG for the match (larger competitions only), shown to three decimals on the match page. */
export function faDetailXg(rows){
 const x=(Array.isArray(rows)?rows:[]).find(r=>r?.type==='expected_goals');
 return x&&[x.home,x.away].every(v=>Number.isFinite(v)&&v>=0&&v<=15)?{home:x.home,away:x.away,available:true,source:'football-api.com'}:{home:null,away:null,available:false};
}
export async function faPrimaryDetail(req,env,publicId,ctx){
 if(req.method!=='GET')return smResponse({error:'method_not_allowed'},405);
 return faEdgeCached('match-'+publicId,ctx,20000,()=>faPrimaryDetailBuild(req,env,publicId,ctx));
}
async function faPrimaryDetailBuild(req,env,publicId,ctx){
 try{
  const focus=await (await faPrimaryFocus(req,env,ctx)).json();const game=focus.matches?.find(m=>m.id===publicId);
  if(!game)return smResponse({error:'match_not_in_current_schedule'},404);
  const model=await tdPublishedModel(env),legacy=model?faHistoricalIdentity(game,model,fhName,faBadgeCache.identities):null;
  const found=legacy&&env.TIKI_DB?await faTeamResults(env.TIKI_DB,legacy.home_id,legacy.away_id,game.date.slice(0,10)).catch(()=>null):null;
  let data=null;if(game.match_id){const r=await faTrialRoute(new Request(new URL('/api/football-trial/match/'+game.match_id,req.url)),env);if(r.ok)data=await r.json()}
  const players=side=>(data?.lineups?.[side]?.players||[]).map(p=>({id:p.id,name:p.name,number:Number(p.number)||null,position:null,role:null,is_goalkeeper:false,order:null,substitute:p.substitute}));
  const side=key=>{const p=players(key);return {starters:p.filter(p=>!p.substitute),bench:p.filter(p=>p.substitute)}};
  const announced={home:side('home'),away:side('away')};
  // D1-only, read-only evidence: archived Sportmonks lineups plus Football-API lineups stored since.
  // Numeric player identities never cross providers. Either source may be absent (the archive binding is
  // missing in preview); then the provider lineups continue working normally.
  const archived=await Promise.all(['home','away'].map(key=>faRecentLineupEvidence(env.SPORTMONKS_ARCHIVE_DB,legacy?.[key+'_id'],game.date,
   {db:env.TIKI_DB,teamId:game[key+'_id']}).catch(()=>null)));
  const evidence={home:archived[0],away:archived[1]};
  const lineups=faEnrichProviderLineups(announced,evidence);
  // Traditional club colours for the pitch tokens; the page labels them as such, not as today's kit.
  const kits=faMatchKits(game.home_id,game.away_id);for(const key of ['home','away'])if(kits[key])lineups[key].kit=kits[key];
  const projected=['home','away'].some(key=>lineups[key].source==='recent_historical_projection');
  const announcedAny=['home','away'].some(key=>lineups[key].source==='football_api_announced_unverified');
  const lineupStatus=announcedAny?'unconfirmed':projected?'historical_projection':'unavailable';
  const formations={home:lineups.home.source==='recent_historical_projection'?evidence.home?.formation||null:null,
   away:lineups.away.source==='recent_historical_projection'?evidence.away?.formation||null:null};
  // Most repeated formation in the same recent archived games; shown as an estimate even beside announced players.
  const historicalFormations={home:evidence.home?.formation||null,away:evidence.away?.formation||null};
  return smResponse({source:'football-api.com',fixture_id:game.match_id||game.fixture_id,public_id:game.id,verified:true,
   lineup_status:lineupStatus,confirmed_lineup:null,lineups,lineup_sources:{home:lineups.home.source,away:lineups.away.source},
   formations,historical_formations:historicalFormations,statistics:faDetailStatistics(data?.statistics),match_statistics_available:!!data?.match_statistics_available,statistics_updated_at:data?.statistics_updated_at||null,xg:faDetailXg(data?.statistics),player_xg:[],venue:game.venue||null,
   events:(data?.events||[]).map(e=>({...e,type:e.type,team_id:e.side==='home'?game.home_id:e.side==='away'?game.away_id:null})),
   history:await faPrimaryHistory(env,legacy,game,found),current_season_form:found?faSeasonForm(found,legacy):null,
   updated_at:new Date().toISOString(),news:[],disclosures:{lineups:'Η τρέχουσα ενδεκάδα προέρχεται από Football-API όταν είναι διαθέσιμη. Οι θέσεις και οι πιθανές ενδεκάδες βασίζονται αποκλειστικά σε πρόσφατους προηγούμενους αγώνες και δεν αποτελούν επίσημη επιβεβαίωση.',xg:'Ο πάροχος δεν παρέχει xG.'}},200,30);
 }catch{return smResponse({error:'football_api_details_unavailable'},503)}
}
/* Finished results for model training (/matches/history.json, 90-minute ft_score). Football-API team IDs are
   translated to the model's archived Sportmonks identities through fa_team_identity; a match with an unmapped
   side is skipped and counted, never guessed. Runs inside the scheduled training job. */
export const FA_TRAINING_LEAGUES={1:'bundesliga',2:'epl',3:'laliga',4:'seriea',5:'ligue1',9:'greece',44:'cyprus',244:'ucl',245:'uel',446:'uecl'};
const faInt=v=>/^\d{1,14}$/.test(String(v))&&Number(v)>0?Number(v):null;
export function faHistoryMatch(m){
 const id=faInt(m?.id),home=faInt(m?.home?.id),away=faInt(m?.away?.id),s=/^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(String(m?.scores?.ft_score||''));
 if(!id||!home||!away||home===away||!s||m?.status!=='FINISHED'||!/^\d{4}-\d{2}-\d{2}$/.test(String(m?.date||'')))return null;
 const clock=/^\d{2}:\d{2}$/.test(String(m.scheduled||''))?m.scheduled:'00:00',fixture=faInt(m.fixture_id);
 return {id,fixture_id:fixture,public_id:fixture?'football-api-fixture-'+fixture:'football-api-'+id,kickoff:m.date+'T'+clock+':00Z',
  date:m.date,competition_id:faInt(m.competition?.id),home_id:home,away_id:away,
  home:String(m.home.name||'').slice(0,80),away:String(m.away.name||'').slice(0,80),home_score:Number(s[1]),away_score:Number(s[2])};
}
export function faResultRow(m,identity,observedAt){
 const key=FA_TRAINING_LEAGUES[m?.competition_id];
 if(!key||m.home_score>15||m.away_score>15||!m.home||!m.away)return {skip:'invalid'};
 const h=identity.get(m.home_id),a=identity.get(m.away_id);
 if(!h||!a||h===a)return {skip:'unmapped_team'};
 const y=Number(m.date.slice(0,4))-(Number(m.date.slice(5,7))<7?1:0);
 return {row:{fa_match_id:m.id,dataset_slug:key+'-'+y+'-'+String((y+1)%100).padStart(2,'0'),league_key:key,match_date:m.date,
  home_team:m.home,away_team:m.away,home_team_id:h,away_team_id:a,home_score:m.home_score,away_score:m.away_score,
  fa_home_id:m.home_id,fa_away_id:m.away_id,observed_at:observedAt}};
}
/* Every finished match in the trained competitions, mapped or not, for the Transparency audit. */
export function faAuditRow(m,badges){
 const key=FA_TRAINING_LEAGUES[m?.competition_id];
 if(!key||!m.home||!m.away)return null;
 const logo=id=>badges?.has(id)?'/badges/'+id+'.png':null;
 return {fixture_id:m.public_id,league_key:key,kickoff:m.kickoff,home:m.home,away:m.away,home_logo:logo(m.home_id),away_logo:logo(m.away_id),
  status:'FT',home_score:m.home_score,away_score:m.away_score,source:'football-api'};
}
export async function faSyncResults(env,now=Date.now(),fetcher=fetch){
 if(!env?.TIKI_DB||!env?.FOOTBALL_TRIAL_DB)return {status:'unavailable'};
 const day=t=>new Date(t).toISOString().slice(0,10),to=day(now-86400000),floor=day(now-14*86400000);
 const last=(await env.TIKI_DB.prepare('SELECT max(match_date) d FROM football_training_results').first())?.d;
 // Two days of overlap catch late corrections; never further back than 14 days, never before the archive ends.
 const from=[last?day(Date.parse(last+'T00:00:00Z')-2*86400000):'2026-10-26',floor].sort().at(-1);
 if(from>to)return {status:'up_to_date',from,to};
 const identity=new Map(((await env.TIKI_DB.prepare('SELECT fa_team_id,sportmonks_team_id FROM fa_team_identity').all()).results||[]).map(r=>[r.fa_team_id,r.sportmonks_team_id]));
 const badges=await faBadgeIds(env,now),audit=[];
 const observed=new Date(now).toISOString(),rows=[],skipped={invalid:0,unmapped_team:0},unmapped=new Set();let pages=0,partial=false;
 for(let page=1;page<=12;page++){
  const r=await faTrialCached(env,'history-'+from+'-'+to+'-'+page,'/matches/history.json',
   {competition_id:Object.keys(FA_TRAINING_LEAGUES).join(','),from,to,page},6*3600000,d=>{
    if(!Array.isArray(d?.match))throw Error('provider_invalid_response');
    return {matches:d.match.map(faHistoryMatch).filter(Boolean),received:d.match.length,next:!!d.next_page};
   },fetcher,now);
  if(r.error)partial=true;
  if(!r.data)break;
  pages++;
  for(const m of r.data.matches){
   const a=faAuditRow(m,badges);if(a)audit.push(a);
   const out=faResultRow(m,identity,observed);
   if(out.row)rows.push(out.row);else{skipped[out.skip]++;if(out.skip==='unmapped_team')for(const [id,n] of [[m.home_id,m.home],[m.away_id,m.away]])if(!identity.has(id))unmapped.add(n+' ('+id+')')}
  }
  if(!r.data.next||r.data.received<30)break;
  if(page===12)partial=true;
 }
 const cols=['fa_match_id','dataset_slug','league_key','match_date','home_team','away_team','home_team_id','away_team_id','home_score','away_score','fa_home_id','fa_away_id','observed_at'];
 const sql='INSERT INTO football_training_results('+cols.join(',')+') VALUES('+cols.map((_,i)=>'?'+(i+1)).join(',')+') ON CONFLICT(fa_match_id) DO UPDATE SET '+
  cols.slice(1).map(c=>c+'=excluded.'+c).join(',');
 for(let i=0;i<rows.length;i+=50)await env.TIKI_DB.batch(rows.slice(i,i+50).map(r=>env.TIKI_DB.prepare(sql).bind(...cols.map(c=>r[c]))));
 const acols=['fixture_id','league_key','kickoff','home','away','home_logo','away_logo','status','home_score','away_score','source'];
 const asql='INSERT INTO audit_fixtures('+acols.join(',')+') VALUES('+acols.map((_,i)=>'?'+(i+1)).join(',')+') ON CONFLICT(fixture_id) DO UPDATE SET '+
  acols.slice(1).map(c=>c+'=excluded.'+c).join(',');
 for(let i=0;i<audit.length;i+=50)await env.TIKI_DB.batch(audit.slice(i,i+50).map(r=>env.TIKI_DB.prepare(asql).bind(...acols.map(c=>r[c]))));
 return {status:partial?'partial':'ok',from,to,pages,stored:rows.length,audited:audit.length,skipped,unmapped_teams:[...unmapped].slice(0,20)};
}
/* Lineups of finished matches already stored as training results, so probable XIs keep using recent games after the
   Sportmonks archive stopped. Newest first, at most `limit` matches per scheduled run (about 100 provider requests a
   day of the shared budget) and about 20 seconds. Empty provider lineups are retried up to three times, 12 hours apart. */
/* Shared by the lineup and statistics syncs: finished matches of the last 60 days that have no stored answer yet,
   newest first, four provider requests at a time and about 20 seconds per run. */
async function faSyncFinished(env,now,fetcher,limit,clock,o){
 if(!env?.TIKI_DB||!env?.FOOTBALL_TRIAL_DB)return {status:'unavailable'};
 const started=clock(),observed=new Date(now).toISOString();
 const pending=(await env.TIKI_DB.prepare('SELECT r.fa_match_id,r.match_date,r.league_key,r.fa_home_id,r.fa_away_id FROM football_training_results r LEFT JOIN '+o.fetches+' f ON f.fa_match_id=r.fa_match_id WHERE (f.fa_match_id IS NULL OR (f.'+o.count+'=0 AND f.attempts<3 AND f.last_attempt_at<?1)) AND r.match_date>=?3 ORDER BY r.match_date DESC,r.fa_match_id DESC LIMIT ?2')
  .bind(new Date(now-12*3600000).toISOString(),limit,new Date(now-60*86400000).toISOString().slice(0,10)).all()).results||[];
 const report={status:'ok',pending:pending.length,stored:0,empty:0,errors:0};
 const attempt='INSERT INTO '+o.fetches+'(fa_match_id,'+o.count+',attempts,last_attempt_at,last_error) VALUES(?1,?2,1,?3,?4) ON CONFLICT(fa_match_id) DO UPDATE SET '+o.count+'=excluded.'+o.count+',attempts='+o.fetches+'.attempts+1,last_attempt_at=excluded.last_attempt_at,last_error=excluded.last_error';
 for(let i=0;i<pending.length&&report.status==='ok';i+=4){
  if(clock()-started>20000){report.status='partial';break}
  // A cached answer (from a match-page visit or an earlier try) is reused only if fetched on or after match day and
  // within 12 hours, so a retry of an empty answer really asks the provider again.
  const done=await Promise.all(pending.slice(i,i+4).map(async m=>({m,r:await faTrialCached(env,o.cache+m.fa_match_id,o.path,
   {match_id:m.fa_match_id},Math.max(60000,Math.min(12*3600000,now-Date.parse(m.match_date+'T00:00:00Z'))),o.normalize,fetcher,now)})));
  const writes=[];
  for(const {m,r} of done){
   // Out of budget: leave the match unrecorded so a later run tries it again.
   if(r.error==='trial_daily_limit_reached'){report.status='partial';continue}
   const {count,statements}=o.store(m,r.data,observed);
   writes.push(...statements);
   if(count)report.stored++;else if(r.error)report.errors++;else report.empty++;
   writes.push(env.TIKI_DB.prepare(attempt).bind(m.fa_match_id,count,observed,count?null:r.error||null));
  }
  if(writes.length)await env.TIKI_DB.batch(writes);
 }
 return report;
}
export async function faSyncLineups(env,now=Date.now(),fetcher=fetch,limit=40,clock=Date.now){
 const lineup='INSERT INTO football_lineups(fa_match_id,fa_team_id,match_date,league_key,starters_json,bench_json,observed_at) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(fa_match_id,fa_team_id) DO UPDATE SET match_date=excluded.match_date,league_key=excluded.league_key,starters_json=excluded.starters_json,bench_json=excluded.bench_json,observed_at=excluded.observed_at';
 return faSyncFinished(env,now,fetcher,limit,clock,{fetches:'football_lineup_fetches',count:'players',cache:'lineups-',path:'/matches/lineups.json',normalize:faTrialLineups,
  store(m,data,observed){
   let count=0;const statements=[];
   for(const [side,team] of [['home',m.fa_home_id],['away',m.fa_away_id]]){
    const list=(data?.[side]?.players||[]).filter(p=>p?.name).map(p=>({id:p.id||null,name:String(p.name).slice(0,80),
     number:/^\d{1,2}$/.test(String(p.number))?Number(p.number):null,bench:!!p.substitute}));
    if(!list.length)continue;
    count+=list.length;
    const pick=bench=>JSON.stringify(list.filter(p=>p.bench===bench).map(({bench,...p})=>p));
    statements.push(env.TIKI_DB.prepare(lineup).bind(m.fa_match_id,team,m.match_date,m.league_key,pick(false),pick(true),observed));
   }
   return {count,statements};
  }});
}
/* Shots, corners, cards, possession and, where the provider has it, xG of finished matches, so team form keeps
   updating after the Sportmonks archive. Training runs twice a day, so each run takes up to 40 matches. */
export async function faSyncStatistics(env,now=Date.now(),fetcher=fetch,limit=40,clock=Date.now){
 const row='INSERT INTO football_match_statistics(fa_match_id,match_date,league_key,fa_home_id,fa_away_id,home_xg,away_xg,stats_json,observed_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(fa_match_id) DO UPDATE SET match_date=excluded.match_date,league_key=excluded.league_key,fa_home_id=excluded.fa_home_id,fa_away_id=excluded.fa_away_id,home_xg=excluded.home_xg,away_xg=excluded.away_xg,stats_json=excluded.stats_json,observed_at=excluded.observed_at';
 return faSyncFinished(env,now,fetcher,limit,clock,{fetches:'football_statistics_fetches',count:'metrics',cache:'statistics-',path:'/statistics/matches.json',normalize:faTrialStatistics,
  store(m,data,observed){
   const stats=Object.fromEntries((Array.isArray(data)?data:[]).map(s=>[s.type,[s.home,s.away]]));
   const count=Object.keys(stats).length,xg=stats.expected_goals||[null,null];
   return {count,statements:count?[env.TIKI_DB.prepare(row).bind(m.fa_match_id,m.match_date,m.league_key,m.fa_home_id,m.fa_away_id,xg[0],xg[1],JSON.stringify(stats),observed)]:[]};
  }});
}
