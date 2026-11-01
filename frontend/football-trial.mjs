/* Independent provider trial. Never merges provider IDs, statistics or forecasts.
 * All upstream requests reserve a centrally enforced daily budget before fetch.
 * Cache leases and usage counters use primary D1 writes, across visitors/regions.
 */
// Legend plan (from 2026-11-01): 40,000 requests a day, then 0.0015 EUR each. The ceiling keeps 2,000 in reserve so the
// site never runs into paid overage.
export const FA_TRIAL_CAP=38000;
const faText=v=>typeof v==='string'?v.slice(0,180):'';
const faId=v=>/^\d{1,14}$/.test(String(v))&&Number(v)>0?Number(v):null;
const faStamp=v=>{const s=String(v||'').replace(' ','T').replace(/Z?$/,'Z');return Number.isFinite(Date.parse(s))?s:null};
export function faTrialMatch(m){
 const id=faId(m?.id),h=faText(m?.home?.name),a=faText(m?.away?.name);
 if(!id||!h||!a||!faId(m?.home?.id)||!faId(m?.away?.id)||Number(m.home.id)===Number(m.away.id))return null;
 const score=/^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(String(m.scores?.score||''));
 const day=/^\d{4}-\d{2}-\d{2}$/.test(String(m.date||''))?m.date:String(m.added||'').slice(0,10);
 const clock=/^\d{2}:\d{2}(?::\d{2})?$/.test(String(m.scheduled||''))?m.scheduled:null;
 let date=clock?faStamp(day+'T'+clock):null;
 if(date&&faStamp(m.added)&&Date.parse(date)<Date.parse(faStamp(m.added))-12*3600000)date=new Date(Date.parse(date)+86400000).toISOString();
 const logo=v=>typeof v==='string'&&/^https:\/\/cdn\.football-api\.com\/[^?]+$/.test(v)?v:null;
 return {id:'football-api-'+id,match_id:id,fixture_id:faId(m.fixture_id),home:h,away:a,date,
  home_id:faId(m.home.id),away_id:faId(m.away.id),league:faText(m.competition?.name),
  country:faText(m.country?.name),competition_id:faId(m.competition?.id),
  status:faText(m.status),minute:faText(String(m.time||'')),
  home_score:score?Number(score[1]):null,away_score:score?Number(score[2]):null,
  provider_updated_at:faStamp(m.last_changed),venue:faText(m.location),round:faText(String(m.round||'')),logos:{home:logo(m.home.logo,m.home.id),away:logo(m.away.logo,m.away.id)},source:'football-api.com'};
}
export function faTrialEvents(d){
 return (Array.isArray(d?.event)?d.event:[]).slice(0,300).map(e=>({id:faId(e.id),
  type:faText(e.event),label:faText(e.label),minute:faText(String(e.time??'')),
  player:faText(e.player?.name),related_player:faText(e.info?.name),
  side:e.is_home===true?'home':e.is_away===true?'away':null,
  sort:Number.isFinite(Number(e.sort))?Number(e.sort):0})).sort((a,b)=>a.sort-b.sort);
}
export function faTrialLineups(d){
 const team=s=>{const t=d?.lineup?.[s];return {team:faText(t?.team?.name),players:
  (Array.isArray(t?.players)?t.players:[]).slice(0,60).map(p=>({id:faId(p.id),name:faText(p.name),
   number:faText(String(p.shirt_number??'')),substitute:String(p.substitution)==='1'}))}};
 return {home:team('home'),away:team('away')};
}
/* /statistics/matches.json: [{type,label,home,away}]. Keeps only the type and plain counts (possession 0-100);
   provider labels are not passed on. Rows with neither value are dropped (smaller competitions omit some). */
export function faTrialStatistics(d){
 const n=v=>v===null||v===undefined||v===''?null:/^\d{1,5}(?:\.\d+)?$/.test(String(v))&&Number(v)<=50000?Number(v):null;
 return (Array.isArray(d)?d:[]).slice(0,40).map(x=>({type:String(x?.type||'').slice(0,40),home:n(x?.home),away:n(x?.away)}))
  .filter(x=>/^[a-z_]+$/.test(x.type)&&(x.home!==null||x.away!==null)&&!(x.type==='possesion'&&(x.home>100||x.away>100)));
}
/* A match in play whose provider record has not changed for five minutes is treated as frozen. On a busy Saturday
   (close to 300 matches at once) the provider updates each record only every one to three minutes. */
export function faTrialSourceStale(m,now=Date.now()){
 return ['IN PLAY','ADDED TIME'].includes(m.status)&&(!m.provider_updated_at||now-Date.parse(m.provider_updated_at)>300000||Date.parse(m.provider_updated_at)>now+60000);
}
const faReply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function faTrialRead(response){
 const reader=response.body?.getReader();if(!reader)throw Error('provider_empty_response');
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
  if(size>2*1024*1024){await reader.cancel();throw Error('provider_response_too_large')}chunks.push(value);}}
 finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function faTrialCached(env,key,path,params,ttl,normalize,fetcher=fetch,now=Date.now(),{timeout=12000,retry=120000}={}){
 const db=env.FOOTBALL_TRIAL_DB;if(!db)throw Error('trial_storage_unavailable');
 if(!env.FOOTBALL_API_KEY||!env.FOOTBALL_API_KEY_SECRET)throw Error('trial_not_configured');
 const old=await db.prepare('SELECT * FROM football_trial_cache WHERE cache_key=?1').bind(key).first();
 const cached=old?.payload_json?JSON.parse(old.payload_json):null;
 if(cached&&now-old.fetched_at<ttl)return {data:cached,fetched_at:old.fetched_at,stale:false};
 if(old?.retry_after>now||old?.lease_until>now)return {data:cached,fetched_at:old.fetched_at,stale:true,error:old.last_error?.split(':')[0]||'refresh_in_progress'};
 const lease=await db.prepare('INSERT INTO football_trial_cache(cache_key,lease_until,retry_after) VALUES(?1,?2,?3) ON CONFLICT(cache_key) DO UPDATE SET lease_until=excluded.lease_until,retry_after=excluded.retry_after WHERE football_trial_cache.lease_until<=?4 AND football_trial_cache.retry_after<=?4 RETURNING cache_key')
  .bind(key,now+45000,now+ttl,now).first();
 if(!lease)return {data:cached,fetched_at:old?.fetched_at||0,stale:true,error:'refresh_in_progress'};
 try{
  const day=new Date(now).toISOString().slice(0,10);
  const budget=await db.prepare('INSERT INTO football_trial_usage(day_utc,used) VALUES(?1,1) ON CONFLICT(day_utc) DO UPDATE SET used=used+1 WHERE used<?2 RETURNING used').bind(day,FA_TRIAL_CAP).first();
  if(!budget)throw Error('trial_daily_limit_reached');
  const url=new URL('https://api.football-api.com'+path);
  url.searchParams.set('key',String(env.FOOTBALL_API_KEY).trim());url.searchParams.set('secret',String(env.FOOTBALL_API_KEY_SECRET).trim());
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  let response;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{response=await fetcher(url.toString(),{redirect:'manual',signal:controller.signal})}
  catch(cause){const error=Error('provider_network_error');error.networkHint=String(cause?.message||cause?.name||'unknown').replaceAll(String(env.FOOTBALL_API_KEY).trim(),'REDACTED').replaceAll(String(env.FOOTBALL_API_KEY_SECRET).trim(),'REDACTED').replace(/https?:\/\/\S+/g,'[url]').slice(0,180);throw error}
  finally{clearTimeout(timer)}
  if(!response.ok)throw Error(response.status===401?'provider_access_denied':'provider_http_error');
  let raw;try{raw=await faTrialRead(response)}catch{throw Error('provider_invalid_response')}
  if(raw?.success!==true)throw Error('provider_request_rejected');
  // Store ONLY whitelisted fields. Provider URLs can contain API credentials.
  const data=normalize(raw.data);
  await db.prepare('UPDATE football_trial_cache SET payload_json=?1,fetched_at=?2,lease_until=0,retry_after=0,last_error=NULL WHERE cache_key=?3')
   .bind(JSON.stringify(data),now,key).run();
  return {data,fetched_at:now,stale:false,refreshed:true};
 }catch(e){
  const safe=new Set(['trial_daily_limit_reached','provider_network_error','provider_access_denied','provider_http_error','provider_invalid_response','provider_request_rejected']);
  const error=safe.has(e.message)?e.message:'trial_storage_error';
  await db.prepare('UPDATE football_trial_cache SET lease_until=0,retry_after=?1,last_error=?2 WHERE cache_key=?3').bind(now+retry,error+(e.networkHint?': '+e.networkHint:''),key).run();
  return {data:cached,fetched_at:old?.fetched_at||0,stale:true,error};
 }
}
export async function faTrialUsage(env){
 const day=new Date().toISOString().slice(0,10);
 const r=await env.FOOTBALL_TRIAL_DB.prepare('SELECT used FROM football_trial_usage WHERE day_utc=?1').bind(day).first();
 return {day_utc:day,used:r?.used||0,trial_limit:FA_TRIAL_CAP,plan_limit:40000};
}
/* The live feed. The scheduler's heartbeat refreshes it twice a minute; a visitor's request asks the provider itself
   only when the copy is over 90 seconds old, that is when the heartbeat has stopped, and in the background, so it
   may take as long as the heartbeat. `params` narrows the request (the site asks only for its competitions: the
   whole world, about 300 matches on a Saturday, took the provider over 25 seconds). A match is frozen when the
   provider had not changed it for five minutes at the time we fetched the feed, so a slow or failed provider call
   keeps the last known matches visible; a copy over 15 minutes old hides them all. */
export const FA_LIVE_VISITOR_TTL=90000;
export async function faTrialLive(env,ttl=FA_LIVE_VISITOR_TTL,opts={},fetcher=fetch,now=Date.now(),params={}){
 const r=await faTrialCached(env,'live-primary-v2','/matches/live.json',params,ttl,d=>{if(!Array.isArray(d?.match))throw Error('provider_invalid_response');return d.match.map(faTrialMatch).filter(Boolean)},fetcher,now,opts);
 const at=r.fetched_at||0,old=!at||now-at>900000;
 const matches=(r.data||[]).map(m=>({...m,source_stale:old||faTrialSourceStale(m,at)}));
 if(r.refreshed&&matches.length){
  const stmts=matches.map(m=>env.FOOTBALL_TRIAL_DB.prepare('INSERT INTO football_trial_matches(match_id,payload_json,observed_at,finished) VALUES(?1,?2,?3,?4) ON CONFLICT(match_id) DO UPDATE SET payload_json=excluded.payload_json,observed_at=excluded.observed_at,finished=excluded.finished WHERE football_trial_matches.finished=0 OR excluded.finished=1')
   .bind(m.match_id,JSON.stringify(m),new Date(r.fetched_at).toISOString(),m.status==='FINISHED'?1:0));
  for(let i=0;i<stmts.length;i+=50)await env.FOOTBALL_TRIAL_DB.batch(stmts.slice(i,i+50));
 }
 return {r,matches};
}
export async function faTrialRoute(req,env){
 if(req.method!=='GET')return faReply({error:'method_not_allowed'},405);
 const url=new URL(req.url),path=url.pathname;
 try{
  if(path==='/api/football-trial/live'){
   const {r,matches}=await faTrialLive(env);
   return faReply({source:'football-api.com',mode:'parallel_trial',updated_at:r.fetched_at?new Date(r.fetched_at).toISOString():null,stale:r.stale,error:r.error||null,
    match_statistics_available:false,probabilities_modified:false,usage:await faTrialUsage(env),matches},r.data?200:503);
  }
  const match=/^\/api\/football-trial\/match\/([1-9]\d{0,13})$/.exec(path);
  if(match){
   const id=Number(match[1]);
   const known=await env.FOOTBALL_TRIAL_DB.prepare('SELECT payload_json FROM football_trial_matches WHERE match_id=?1').bind(id).first();
   if(!known)return faReply({error:'match_not_in_trial_feed'},404);
   const game=JSON.parse(known.payload_json),ended=game.status==='FINISHED',ttl=ended?86400000:60000;
   // Three independent provider requests, made together rather than one after another.
   const [events,lineups,statistics]=await Promise.all([faTrialCached(env,'events-'+id,'/matches/events.json',{match_id:id},ttl,faTrialEvents),
    faTrialCached(env,'lineups-'+id,'/matches/lineups.json',{match_id:id},ended?86400000:1200000,faTrialLineups),
    faTrialCached(env,'statistics-'+id,'/statistics/matches.json',{match_id:id},ttl,faTrialStatistics)]);
   return faReply({source:'football-api.com',match:game,events:events.data||[],events_updated_at:events.fetched_at?new Date(events.fetched_at).toISOString():null,
    events_stale:events.stale,lineups:lineups.data||null,lineups_stale:lineups.stale,
    statistics:statistics.data||[],statistics_updated_at:statistics.fetched_at?new Date(statistics.fetched_at).toISOString():null,statistics_stale:statistics.stale,
    match_statistics_available:!!statistics.data?.length,errors:[events.error,lineups.error,statistics.error].filter(Boolean),usage:await faTrialUsage(env)});
  }
  return faReply({error:'not_found'},404);
 }catch{return faReply({error:'trial_temporarily_unavailable'},503)}
}
