/* Tiki-Data: Sportmonks v3 is the SOLE live match-data supplier.
 * OpenFootball CC0 finished scores continue to train the independent, experimental Poisson model.
 * Never publish league priors as team-specific forecasts.
 */
const SM_FOCUS_CACHE_KEY='focus_sportmonks_v1';
const SM_FINISHED=new Set(['FT','FINISHED','FULL_TIME','AET','PEN','CANCELLED','POSTPONED','DELAYED','ABANDONED']);
function smBuildFocus(fixtures,live,model,now,estimate=null,likely=null){
 const actual=new Map((Array.isArray(live)?live:[]).map(m=>[String(m.id),m]));
 const map=new Map();
 for(const f of [...(Array.isArray(fixtures)?fixtures:[]),...(Array.isArray(live)?live:[])]){
  if(!f||!f.id||!f.home||!f.away||!Number.isFinite(Date.parse(f.date)))continue;
  if(SM_FINISHED.has(String(f.status||'').toUpperCase()))continue;
  const liveMatch=actual.get(String(f.id));
  const game=liveMatch?{...f,...liveMatch,logos:{...f.logos,...liveMatch.logos},league_logo:liveMatch.league_logo||f.league_logo}:f;
  const playedAt=Date.parse(game.date);
  if(!liveMatch&&playedAt<now-60000)continue;
  if(playedAt>now+8*86400000)continue;
  const isUpcoming=playedAt>now+60000&&!liveMatch;
  let p=null;
  if(isUpcoming&&model){
   const val=(estimate||fhEstimate)(game,model);
   if(validHistoricalTier(val))
    p={...val,most_likely_score:(likely||fhLikelyScore)(val.mu_home,val.mu_away)};
  }
  const forecast=p?{p1:p.p1,px:p.px,p2:p.p2,over25:p.over25,under25:p.under25,btts:p.btts,
   no_btts:p.no_btts,mu_home:p.mu_home,mu_away:p.mu_away,method:p.method,
   confidence:p.confidence,coverage:p.tier==='team'?'verified_historical_inputs':'historical_baseline_only',
   prediction_tier:p.tier,evidence_source:p.evidence_source,model_note:p.model_note,validated:false,
   historical_sample:p.team_samples,history_latest:p.history_latest,most_likely_score:p.most_likely_score}:
   {p1:null,px:null,p2:null,over25:null,under25:null,btts:null,no_btts:null,mu_home:null,mu_away:null,
    method:null,confidence:'unavailable',coverage:'insufficient_team_history',validated:false};
  map.set(String(game.id),{...game,...forecast,model:p});
 }
 const matches=[...map.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const future=matches.filter(m=>Date.parse(m.date)>now&&!actual.has(String(m.id)));
 const featured=future.find(m=>!!m.model)||future[0]||matches[0]||null;
 const next=future.filter(m=>m!==featured).slice(0,6);
 const leagues=new Set(matches.map(m=>m.league_key));
 const covered=matches.filter(m=>m.model).length;
 const tiers={team:0,partial_team:0,league:0,cross_league:0};
 for(const m of matches)if(m.model&&Object.hasOwn(tiers,m.model.tier))tiers[m.model.tier]++;
 return{matches,featured,upcoming:next,coverage:{matches:matches.length,competitions:leagues.size,with_prediction:covered,
  with_team_prediction:tiers.team,with_partial_team_prediction:tiers.partial_team,
  with_league_baseline:tiers.league,with_cross_league_baseline:tiers.cross_league,
  without_prediction:matches.filter(m=>!m.model&&!actual.has(String(m.id))).length,
  live_matches:matches.filter(m=>actual.has(String(m.id))).length},leagues_with_matches:[...leagues]};
}
const smResponse=(data,status=200,maxAge=0)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':status===200?'public,max-age='+maxAge:'no-store',
 'X-Content-Type-Options':'nosniff'}});
async function smFocusResponse(req,env,ctx){
 if(req.method!=='GET')return smResponse({error:'method_not_allowed'},405);
 if(!env?.SPORTMONKS_API_TOKEN)return smResponse({error:'sportmonks_not_configured'},503);
 const key=SM_FOCUS_CACHE_KEY,db=env?.TIKI_DB,now=Math.floor(Date.now()/1000);
 if(db){
  try{const old=await db.prepare("SELECT payload_json FROM sportapi_home_cache WHERE cache_key=?1 AND expires_at>?2")
   .bind(key,now).first();if(old?.payload_json)return smResponse(JSON.parse(old.payload_json),200,40);}catch{}
 }
 const start=new Date().toISOString().slice(0,10);
 const classify=(name,country)=>fhLeague(name,country)||
  (String(country).toLowerCase()==='cyprus'&&/^1\.?\s*division$/i.test(String(name))?'cyprus':null);
 try{
  const [week,model,live]=await Promise.all([smWeek(start,env.SPORTMONKS_API_TOKEN,classify,fetch,7),
   fhLoadModel(db,ctx),smInplay(env.SPORTMONKS_API_TOKEN,classify,fetch,start).catch(()=>[])]);
  if(week.partial)throw Error('sportmonks_incomplete_fixture_window');
  const nowMs=Date.now(),selected=smBuildFocus(week.fixtures,live,model,nowMs);
  const publicMatch=m=>{if(!m)return null;const {model,...safe}=m;return safe};
  const upcoming=selected.upcoming.map(m=>({...publicMatch(m),model:m.model}));
  const featured=selected.featured?{...publicMatch(selected.featured),model:selected.featured.model}:null;
  const payload={source:'sportmonks',updated_at:new Date().toISOString(),range:Array.from({length:7},(_,i)=>smAddDay(start,i)),
   coverage:selected.coverage,featured,upcoming,matches:selected.matches.map(publicMatch),
   leagues_with_matches:selected.leagues_with_matches,data_sources:{sportmonks:selected.matches.length},
   model:{name:'CC0 historical venue Poisson v2 (experimental)',historical_matches:Object.values(model?.leagues||{})
     .reduce((sum,l)=>sum+(l.matches||0),0),trained_at:model?.trained_at||null,
    historical_cutoff:model?.cutoff||null,validated:false,source:'openfootball_cc0',
    note:'Experimental statistical predictions only where both teams have matched historical results.'},
   model_predictions_available:selected.coverage.with_prediction};
  if(db&&ctx?.waitUntil){
   const writes=selected.matches.filter(m=>m.model&&Date.parse(m.date)>nowMs+2*3600000).map(m=>
    db.prepare("INSERT OR IGNORE INTO prospective_forecast_log (fixture_key,created_at,model_version,data_cutoff,source_sync_at,ph,pd,pa) VALUES (?1,datetime('now'),?2,?3,?4,?5,?6,?7)")
     .bind(m.id+':'+m.date,model.model_version,model.cutoff,payload.updated_at,
       m.p1/100,m.px/100,m.p2/100).run());
   if(writes.length)ctx.waitUntil(Promise.allSettled(writes));
  }
  if(db&&ctx?.waitUntil){
   ctx.waitUntil(db.prepare("INSERT INTO sportapi_home_cache(cache_key,payload_json,expires_at,saved_at) VALUES(?1,?2,?3,?4) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at,saved_at=excluded.saved_at")
     .bind(key,JSON.stringify(payload),now+120,payload.updated_at).run().catch(()=>{}));
  }
  return smResponse(payload,200,40);
 }catch(e){return smResponse({error:'sportmonks_unavailable',message:String(e?.message||'').slice(0,80)},502);}
}
async function smLiveResponse(req,env,ctx){
 if(req.method!=='GET')return smResponse({error:'method_not_allowed'},405);
 if(!env?.SPORTMONKS_API_TOKEN)return smResponse({error:'sportmonks_not_configured'},503);
 const classify=(name,country)=>fhLeague(name,country)||
  (String(country).toLowerCase()==='cyprus'&&/^1\.?\s*division$/i.test(String(name))?'cyprus':null);
 try{
  const games=await smInplay(env.SPORTMONKS_API_TOKEN,classify,fetch);
  return smResponse({source:'sportmonks',updated_at:new Date().toISOString(),matches:games},200,20);
 }catch{return smResponse({error:'sportmonks_live_unavailable'},502)}
}
export {smBuildFocus,smFocusResponse,smLiveResponse};
