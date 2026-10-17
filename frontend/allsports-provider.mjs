/* AllSportsAPI V2.1 — server-side only. No credentials or arbitrary provider proxy in the browser.
 * The provider documents POST as well as GET. Form POST keeps APIkey out of upstream URLs.
 * Source identifiers are namespaced; no cross-provider merge without verified mapping.
 */
const AS_ORIGIN='https://apiv2.allsportsapi.com/football/';
const AS_MAX_BODY=1400000;
const asString=(v,n=140)=>typeof v==='string'?v.trim().slice(0,n):'';
const asId=v=>/^\d{1,13}$/.test(String(v??''))?String(v):null;
const asDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const ms=Date.parse(s+'T00:00:00Z');return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===s?s:null;};
const asDayInRange=s=>{const d=asDate(s);return !!d&&Math.abs(Date.parse(d+'T00:00:00Z')-Date.now())<16*86400000;};
const asLogo=s=>typeof s==='string'&&/^https:\/\/(?:apiv2\.)?allsportsapi\.com\/logo\/[a-zA-Z0-9_./%-]{1,180}\.(?:png|jpg|jpeg|webp)$/i.test(s)?s:null;
function asTime(row){
 const date=asDate(row?.event_date),clock=asString(row?.event_time,8);
 if(!date||!/^\d\d:\d\d(?::\d\d)?$/.test(clock))return null;
 const iso=date+'T'+clock+(clock.length===5?':00':'')+'Z',ts=Date.parse(iso);
 return Number.isFinite(ts)&&new Date(ts).toISOString().slice(0,10)===date?new Date(ts).toISOString():null;
}
function asScore(s){const m=/^\s*(\d{1,2})\s*[-:]\s*(\d{1,2})\s*$/.exec(String(s||''));if(!m)return[null,null];const a=Number(m[1]),b=Number(m[2]);return a<=40&&b<=40?[a,b]:[null,null];}
function asFixture(row){
 if(!row||typeof row!=='object')return null;
 const id=asId(row.event_key),date=asTime(row),home=asString(row.event_home_team),away=asString(row.event_away_team);
 if(!id||!date||!home||!away||home===away)return null;
 const raw=asString(row.event_status,25),live=String(row.event_live)==='1';
 const finished=/^(finished|after extra time|after penalties|ft|aet|pen)$/i.test(raw);
 const status=finished?'FT':live?(raw==='Half Time'?'HT':'LIVE'):'NS';
 const [home_score,away_score]=asScore(row.event_final_result||row.event_ft_result);
 return {id:'allsports-'+id,provider_id:id,provider:'allsportsapi',home,away,date,
  league:asString(row.league_name)||'Διοργάνωση',league_id:asId(row.league_key),
  home_id:asId(row.home_team_key),away_id:asId(row.away_team_key),
  status,minute:live&&/^\d{1,3}$/.test(raw)?Math.min(130,Number(raw)):null,
  home_score,away_score,stage:asString(row.league_round||row.stage_name,65),
  logos:{home:asLogo(row.home_team_logo),away:asLogo(row.away_team_logo)},
  league_logo:asLogo(row.league_logo),
  token:null,league_token:null,home_token:null,away_token:null};
}
function asNormalize(payload){
 if(!payload||typeof payload!=='object'||!(payload.success===1||payload.success==='1'||payload.success===true))return null;
 if(!Array.isArray(payload.result)||payload.result.length>850)return null;
 return payload.result.map(asFixture).filter(Boolean);
}
const asReply=(value,status=200,ttl=0)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':ttl?'public, max-age='+ttl:'no-store','X-Content-Type-Options':'nosniff'}});
async function asRequestFixtures(secret,date,fetchImpl=fetch){
 const form=new URLSearchParams({met:'Fixtures',APIkey:secret,from:date,to:date,timezone:'UTC'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
 try{
  const r=await fetchImpl(AS_ORIGIN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:form.toString(),signal:controller.signal,redirect:'manual'});
  if(!r.ok)return {error:r.status===429?'quota_exceeded':r.status===401||r.status===403?'unauthorized':'upstream_unavailable',status:r.status===429?429:502};
  if(Number(r.headers.get('content-length')||0)>AS_MAX_BODY)return {error:'provider_response_too_large',status:502};
  if(!r.body)return{error:'empty_response',status:502};
  const stream=r.body.getReader();const parts=[];let total=0;
  while(true){const {done,value}=await stream.read();if(done)break;total+=value.byteLength;if(total>AS_MAX_BODY){await stream.cancel();return{error:'provider_response_too_large',status:502};}parts.push(value);}
  const data=new Uint8Array(total);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.byteLength;}
  const list=asNormalize(JSON.parse(new TextDecoder().decode(data)));
  return list?{fixtures:list}:{error:'invalid_provider_response',status:502};
 }catch{return{error:'provider_unavailable',status:502};}finally{clearTimeout(timer);}
}
async function asPublicResponse(req,env,ctx,url){
 if(req.method!=='GET')return asReply({error:'method_not_allowed'},405);
 if(url.pathname==='/api/allsports/status')return asReply({source:'AllSportsAPI',configured:!!env?.ALLSPORTS_API_KEY},200,0);
 if(!env?.ALLSPORTS_API_KEY)return asReply({error:'provider_not_configured',source:'AllSportsAPI'},503);
 const date=url.searchParams.get('date');if(!asDayInRange(date))return asReply({error:'date_out_of_range'},400);
 if([...url.searchParams.keys()].some(x=>x!=='date'))return asReply({error:'invalid_query'},400);
 const key=new Request('https://tiki-cache.local/allsports/fixtures-v1/'+date);
 const cache=typeof caches!=='undefined'?caches.default:null;
 try{const hit=await cache?.match(key);if(hit)return hit;}catch{}
 const upstream=await asRequestFixtures(env.ALLSPORTS_API_KEY,date);
 if(!upstream.fixtures)return asReply({error:upstream.error,source:'AllSportsAPI'},upstream.status||502);
 const ttl=date===new Date().toISOString().slice(0,10)?900:3600;
 const response=asReply({source:'AllSportsAPI',date,updated_at:new Date().toISOString(),data:{fixtures:upstream.fixtures},count:upstream.fixtures.length},200,ttl);
 try{ctx?.waitUntil?.(cache?.put(key,response.clone()))}catch{}
 return response;
}
export {asFixture,asNormalize,asRequestFixtures,asPublicResponse,asLogo,asDayInRange};
