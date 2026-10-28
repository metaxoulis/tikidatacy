import {faTrialMatch,faTrialCached,faTrialRoute} from './football-trial.mjs';
/* Main provider adapter. Football-API and legacy Sportmonks IDs never share a namespace. */
export const FA_COMPETITIONS={1:'bundesliga',2:'epl',3:'laliga',4:'seriea',5:'ligue1',9:'greece',44:'cyprus',244:'ucl',245:'uel',446:'uecl'};
const faPrimaryLiveStatus=new Set(['LIVE','1ST','2ND','HT','ET','BREAK','PEN_LIVE']);
export function faPrimaryGame(row){
 if(!row?.date||!Number.isFinite(Date.parse(row.date)))return null;
 let key=FA_COMPETITIONS[row.competition_id];
 if(!key){const country={Greece:'greece',Cyprus:'cyprus',England:'epl',Spain:'laliga',Germany:'bundesliga',Italy:'seriea',France:'ligue1'}[row.country];if(!country)return null;key='fa'+row.competition_id}
 const clock=String(row.minute||''),min=/^(\d{1,3})(?:\+\d{1,2})?$/.exec(clock);
 const status=row.status==='FINISHED'?'FT':row.status==='HALF TIME BREAK'?'HT':row.status==='IN PLAY'?(Number(min?.[1])<=45?'1ST':'2ND'):row.status==='EXTRA TIME'?'ET':row.status==='PENALTY SHOOTOUT'?'PEN_LIVE':'NS';
 return {...row,id:row.fixture_id?'football-api-fixture-'+row.fixture_id:'football-api-'+row.match_id,
  league_key:key,league:['ucl','uel','uecl'].includes(key)?'UEFA '+row.league:row.country&&/^Cup$/i.test(row.league)?row.country+' Cup':row.league,
  status,minute:status==='NS'?null:min?Number(min[1]):null,logos:{home:null,away:null},events:[],lineups:[],statistics:[],live_stats:[],match_statistics_available:false};
}
export function faPrimaryFixture(raw){
 const row=faTrialMatch({...raw,scheduled:raw.time,status:'NS',fixture_id:raw.id});
 if(!row)return null;const game=faPrimaryGame(row);return game?{...game,match_id:null}:null;
}
export function faHistoricalIdentity(game,model,nameKey){
 const aliases={'paok thessaloniki fc':'PAOK','aris thessaloniki fc':'Aris','ofi crete':'OFI','apoel nicosia':'APOEL'};
 const resolve=name=>{const canonical=aliases[String(name).toLowerCase()]||name,n=nameKey(canonical);
  if(model?.team_identity?.ambiguous?.includes(n))return null;
  const value=model?.team_identity?.aliases?.[n];return /^sportmonks:[1-9]\d*$/.test(value||'')?Number(value.split(':')[1]):null};
 const h=resolve(game.home),a=resolve(game.away);
 return h&&a&&h!==a?{...game,home_id:h,away_id:a}:null;
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
function faPrimaryForecast(game,model){
 const legacy=model?faHistoricalIdentity(game,model,fhName):null;
 if(!legacy)return {...game,p1:null,px:null,p2:null,coverage:'unmatched_historical_identity',forecast_review:{status:'withheld',reasons:['unmatched_historical_identity']}};
 const logo=id=>'https://cdn.sportmonks.com/images/soccer/teams/'+(id%32)+'/'+id+'.png';
 game={...game,logos:{home:logo(legacy.home_id),away:logo(legacy.away_id)}};
 const review=forecastIntegrity(legacy,model,fhTeamKey);
 const fitted=fhEstimate(legacy,model)||fhEstimate(legacy,model,{experimentalPreview:true});
 const usable=fitted?.tier==='team'&&fitted.team_samples.home>=3&&fitted.team_samples.away>=3;
 if(!usable)return {...game,p1:null,px:null,p2:null,coverage:'insufficient_team_history',forecast_review:review};
 const live=faPrimaryLiveStatus.has(game.status),outlook=live?liveOutlook(game,fitted,[]):null;
 const p={...fitted,prediction_tier:fitted.tier,most_likely_score:fhLikelyScore(fitted.mu_home,fitted.mu_away)};
 const withheld=review.status==='withheld';
 return {...game,...(live||withheld?{}:p),p1:live||withheld?null:p.p1,px:live||withheld?null:p.px,p2:live||withheld?null:p.p2,
  model:live||withheld?null:p,experimental_preview:!live&&withheld?p:null,
  prematch_prediction:live?{...p,source:'tiki_prematch_experimental_reference'}:null,
  live_outlook:outlook?{...outlook,source:'historical_team_live_poisson',model_version:model.model_version,historical_cutoff:model.cutoff}:null,
  forecast_review:review,historical_sample:fitted.team_samples,model_coverage:fitted.team_samples,
  coverage:'verified_historical_inputs',forecast_source:'published_trained_model',forecast_calculated_at:model.trained_at,
  historical_identity:{home:'sportmonks:'+legacy.home_id,away:'sportmonks:'+legacy.away_id,method:'unique_archived_alias'},
  analysis_provenance:'historical_score_minute_no_live_statistics',live_stats:[],statistics:[]};
}
async function faPrimarySnapshot(req,env){
 const r=await faTrialRoute(new Request(new URL('/api/football-trial/live',req.url)),env);const data=await r.json();
 return {...data,matches:(data.matches||[]).map(faPrimaryGame).filter(Boolean)};
}
export async function faPrimaryLive(req,env){
 try{const [snapshot,model]=await Promise.all([faPrimarySnapshot(req,env),tdPublishedModel(env)]);
  const matches=snapshot.matches.filter(g=>faPrimaryLiveStatus.has(g.status)&&!g.source_stale&&Number.isInteger(g.home_score)&&Number.isInteger(g.away_score)&&(Number.isInteger(g.minute)||g.status==='HT')).map(g=>faPrimaryForecast(g,model));
  return smResponse({...snapshot,mode:'primary',source:'football-api.com',processing:'football_api_score_minute_historical_model',matches,model_unavailable:!model,pending:!snapshot.updated_at,refreshing:false,match_statistics_available:false},snapshot.updated_at?200:503,15);
 }catch{return smResponse({source:'football-api.com',error:'football_api_live_unavailable',matches:[],stale:true,pending:true},503)}
}
export async function faPrimaryFocus(req,env){
 try{const [schedule,snapshot,model]=await Promise.all([faPrimaryScheduled(env),faPrimarySnapshot(req,env),tdPublishedModel(env)]);
  const map=new Map(schedule.games.map(g=>[g.id,g]));
  for(const game of snapshot.matches)map.set(game.id,game);
  const matches=[...map.values()].filter(g=>g.status==='NS'?Date.parse(g.date)>Date.now()-60000:faPrimaryLiveStatus.has(g.status)&&!g.source_stale).map(g=>faPrimaryForecast(g,model)).sort((a,b)=>a.date.localeCompare(b.date));
  const future=matches.filter(g=>g.status==='NS'),featured=future.find(g=>g.model)||future[0]||matches[0]||null;
  const available=matches.filter(g=>g.model).length;
  return smResponse({source:'football-api.com',processing:'football_api_primary',updated_at:new Date().toISOString(),matches,featured,upcoming:future.filter(g=>g!==featured).slice(0,6),
   range:Array.from({length:7},(_,i)=>smAddDay(new Date().toISOString().slice(0,10),i)),stale:false,partial:schedule.partial,
   coverage:{matches:matches.length,competitions:new Set(matches.map(g=>g.league_key)).size,with_prediction:available,without_prediction:matches.length-available,live_matches:snapshot.matches.filter(g=>faPrimaryLiveStatus.has(g.status)).length},
   model:{name:'Tiki-Data historical Poisson',trained_at:model?.trained_at||null,historical_cutoff:model?.cutoff||null,validated:false},model_unavailable:!model,model_predictions_available:available,usage:snapshot.usage,match_statistics_available:false},200,30);
 }catch{return smResponse({source:'football-api.com',error:'football_api_schedule_unavailable',matches:[],stale:true},503)}
}
async function faPrimaryHistory(env,legacy,fixture){
 const empty={home:[],away:[],head_to_head:[],source:'archived_historical_results'};if(!legacy||!env.TIKI_DB)return empty;
 try{const d=await env.TIKI_DB.prepare('SELECT fixture_id,match_date,home_team,away_team,home_team_id,away_team_id,home_score,away_score,league_key FROM sportmonks_training_results WHERE match_date<?1 AND (home_team_id IN (?2,?3) OR away_team_id IN (?2,?3)) ORDER BY match_date DESC LIMIT 80').bind(fixture.date.slice(0,10),legacy.home_id,legacy.away_id).all();
  const rows=(d.results||[]).map(r=>({id:'archived-sportmonks-'+r.fixture_id,date:r.match_date,home:r.home_team,away:r.away_team,home_id:r.home_team_id,away_id:r.away_team_id,home_score:r.home_score,away_score:r.away_score,league:r.league_key}));
  const recent=id=>rows.filter(r=>r.home_id===id||r.away_id===id).slice(0,8).map(r=>{const h=r.home_id===id?r.home_score:r.away_score,a=r.home_id===id?r.away_score:r.home_score;return {...r,result:h>a?'W':h===a?'D':'L'}});
  return {...empty,home:recent(legacy.home_id),away:recent(legacy.away_id),head_to_head:rows.filter(r=>[r.home_id,r.away_id].includes(legacy.home_id)&&[r.home_id,r.away_id].includes(legacy.away_id)).slice(0,5)};
 }catch{return empty}
}
export async function faPrimaryDetail(req,env,publicId){
 if(req.method!=='GET')return smResponse({error:'method_not_allowed'},405);
 try{
  const focus=await (await faPrimaryFocus(req,env)).json();const game=focus.matches?.find(m=>m.id===publicId);
  if(!game)return smResponse({error:'match_not_in_current_schedule'},404);
  const model=await tdPublishedModel(env),legacy=model?faHistoricalIdentity(game,model,fhName):null;
  let data=null;if(game.match_id){const r=await faTrialRoute(new Request(new URL('/api/football-trial/match/'+game.match_id,req.url)),env);if(r.ok)data=await r.json()}
  const players=side=>(data?.lineups?.[side]?.players||[]).map(p=>({id:p.id,name:p.name,number:Number(p.number)||null,position:null,role:null,is_goalkeeper:false,order:null,substitute:p.substitute}));
  const side=key=>{const p=players(key);return {starters:p.filter(p=>!p.substitute),bench:p.filter(p=>p.substitute)}};
  const lineups={home:side('home'),away:side('away')};
  return smResponse({source:'football-api.com',fixture_id:game.match_id||game.fixture_id,public_id:game.id,verified:true,
   lineup_status:lineups.home.starters.length&&lineups.away.starters.length?'unconfirmed':'unavailable',confirmed_lineup:null,lineups,lineup_sources:{home:lineups.home.starters.length?'official':'unavailable',away:lineups.away.starters.length?'official':'unavailable'},
   formations:{home:null,away:null},statistics:[],match_statistics_available:false,xg:{home:null,away:null,available:false},player_xg:[],venue:game.venue||null,
   events:(data?.events||[]).map(e=>({...e,type:e.type,team_id:e.side==='home'?game.home_id:e.side==='away'?game.away_id:null})),
   history:await faPrimaryHistory(env,legacy,game),current_season_form:legacy?await tdSeason2627Form(env.TIKI_DB,legacy):null,
   updated_at:new Date().toISOString(),news:[],disclosures:{lineups:'Παίκτες από Football-API. Δεν παρέχονται επιβεβαιωμένες θέσεις ή σχηματισμός.',xg:'Δεν υπάρχει πρόσβαση σε στατιστικά ή xG με το τρέχον πακέτο.'}},200,30);
 }catch{return smResponse({error:'football_api_details_unavailable'},503)}
}
