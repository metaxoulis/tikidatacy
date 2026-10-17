/* Public SportAPI.ai match centre API. Runs ONLY on Cloudflare server.
 * Exposes allowlisted, sanitized football data. Never exports the provider credential.
 */
const SPORT_ORIGIN = 'https://sportapi.ai/api/';
const SPORT_MAX_BODY = 1100000;
const SPORT_DAY_RANGE = 15;
const SPORT_STATS = ['shots','shots_on_target','shots_off_target','fouls','total_passes','pass_accuracy','tackles','tackle_success','saves','yellow_cards','red_cards','possession','corners','offsides'];
const SPORT_FINISHED = new Set(['FT','AET','PEN','FINISHED','FULL_TIME']);
const SPORT_SECTIONS = {
  match:{overview:'',events:'/events',stats:'/stats',lineups:'/lineups',h2h:'h2h'},
  league:{standings:'standings',scorers:'topscorers',assists:'topassists',cards:'topcards'},
  team:{profile:'',squad:'/squad',trophies:'/trophies'}
};
const spStr=(x,n=130)=>typeof x==='string'?x.trim().slice(0,n):'';
const spNum=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const spId=x=>/^\d{1,13}$/.test(String(x??''))?String(x):null;
const spScore=x=>Number.isInteger(x)&&x>=0&&x<=40?x:null;
const spDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))?x:null;
function sportISO(row){
  const s=spStr(row.kickoff_utc||row.datetime||row.kickoff||row.start_at,50);
  if(!s)return null;
  const v=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)?s.replace(' ','T')+'Z':s;
  const n=Date.parse(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(n)?new Date(n).toISOString():null;
}
function sportRange(day){const ts=Date.parse(day+'T00:00:00Z');return Number.isFinite(ts)&&Math.abs(ts-Date.now())<=SPORT_DAY_RANGE*86400000+86400000;}
const sportHex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
function sportUnhex(str){if(!/^[0-9a-f]{64}$/.test(str))return null;return new Uint8Array(str.match(/../g).map(x=>parseInt(x,16)));}
async function sportSigner(secret){return crypto.subtle.importKey('raw',new TextEncoder().encode('tiki-data-match-centre:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
const sportMessage=(kind,identity,date)=>new TextEncoder().encode(kind+'|'+identity+'|'+date);
async function sportToken(key,kind,identity,date){return sportHex(await crypto.subtle.sign('HMAC',key,sportMessage(kind,identity,date)));}
async function sportVerify(key,kind,identity,date,token){const bytes=sportUnhex(token||'');return bytes!==null&&crypto.subtle.verify('HMAC',key,bytes,sportMessage(kind,identity,date));}
function sportJSON(value,status=200,ttl=0){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':ttl>0?'public, max-age='+ttl:'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'https://tiki-data.pages.dev','Vary':'Origin'}});}
async function sportUpstream(path,secret){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),7500);
  try{
    const r=await fetch(SPORT_ORIGIN+path,{method:'GET',headers:{'X-Api-Key':secret,'Accept':'application/json'},signal:ctrl.signal,redirect:'manual'});
    if(!r.ok) return {error:r.status===429?'quota_exceeded':r.status===401||r.status===403?'unauthorized':'upstream_unavailable',status:r.status===429?429:502};
    if(Number(r.headers.get('content-length')||0)>SPORT_MAX_BODY)return{error:'response_too_large',status:502};
    const reader=r.body?.getReader();if(!reader)return{error:'empty_upstream_response',status:502};
    let total=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>SPORT_MAX_BODY){await reader.cancel();return {error:'response_too_large',status:502};}chunks.push(value);}
    const bytes=new Uint8Array(total);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
    const raw=JSON.parse(new TextDecoder().decode(bytes));
    if(!raw||typeof raw!=='object'||raw.success===false)return{error:'provider_unavailable',status:502};
    return{data:raw};
  }catch{return{error:'upstream_unavailable',status:502};}
  finally{clearTimeout(timer);}
}
function sportRows(x){return Array.isArray(x?.data)?x.data:Array.isArray(x?.fixtures)?x.fixtures:Array.isArray(x?.data?.fixtures)?x.data.fixtures:null;}
function sportState(raw){const v=spStr(raw?.status?.short||raw?.status,30).toUpperCase();return v;}
async function sportFixture(row,key,day){
  if(!row||typeof row!=='object')return null;
  const id=spId(row.id),home=spStr(typeof row.home_team==='string'?row.home_team:row.home_team?.name),away=spStr(typeof row.away_team==='string'?row.away_team:row.away_team?.name),date=sportISO(row);
  if(!id||!home||!away||!date||home===away)return null;
  const league_id=spId(row.league_id),home_id=spId(row.home_id),away_id=spId(row.away_id);
  const status=sportState(row),finished=SPORT_FINISHED.has(status);
  const identity=id+':'+(home_id||'0')+':'+(away_id||'0');
  return {id,home,away,date,league:spStr(row.league_name||row.league?.name||row.league,100)||'Διοργάνωση',league_id,home_id,away_id,
    geo:spStr(row.league_geo,8),status,minute:spNum(row.minute),
    stage:spStr(row.stage,65),home_score:finished?spScore(row.home_score):spScore(row.home_score),away_score:finished?spScore(row.away_score):spScore(row.away_score),
    token:await sportToken(key,'match',identity,day),
    league_token:league_id?await sportToken(key,'league',league_id,day):null,
    home_token:home_id?await sportToken(key,'team',home_id,day):null,
    away_token:away_id?await sportToken(key,'team',away_id,day):null};
}
async function spAttachSignedLogos(fixtures,secret){
 const ids=[...new Set(fixtures.flatMap(x=>[x.home_id,x.away_id]).filter(spId))];
 if(!ids.length)return;
 const k=await crypto.subtle.importKey('raw',new TextEncoder().encode('tiki-logo-v1:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const entries=await Promise.all(ids.map(async id=>[id,'/api/logo/team/'+id+'?sig='+sportHex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('sportapi-team:'+id)))]));
 const mapped=new Map(entries);for(const x of fixtures)x.logos={home:mapped.get(x.home_id)||null,away:mapped.get(x.away_id)||null};
}
function sportEvents(raw){
  const entries=Array.isArray(raw?.events)?raw.events:Array.isArray(raw?.data)?raw.data:Array.isArray(raw?.fixture?.events)?raw.fixture.events:[];
  return entries.slice(0,180).map(x=>({minute:spStr(x.minute,12),type:spStr(x.event_type||x.type,48),side:spStr(x.team_side||x.side,12),team:spStr(x.team_name,100),
    player:spStr(x.player_name||x.player?.name,100),detail:spStr(x.detail||x.description,120),assist:spStr(x.assist_name,100)}));
}
function sportStats(raw){
  const data=raw?.data&&typeof raw.data==='object'?raw.data:raw?.stats;
  if(!data||typeof data!=='object')return null;
  const clean=side=>{const v=data[side];if(!v||typeof v!=='object')return null;const z={};for(const k of SPORT_STATS){let n=spNum(v[k]);if(n!==null&&n>=0&&n<=100000)z[k]=n;}return Object.keys(z).length?z:null;};
  const home=clean('home'),away=clean('away');return home||away?{home,away}:null;
}
function sportLineups(raw){
  const d=raw?.data;if(!d||typeof d!=='object')return null;
  const team=v=>{if(!v||typeof v!=='object')return null;const people=xs=>Array.isArray(xs)?xs.slice(0,30).map(x=>({name:spStr(x.name||x.full_name,100),position:spStr(x.position,32),shirt:spNum(x.shirt??x.jersey_number),captain:x.is_captain===true})).filter(x=>x.name):[];return{starters:people(v.starters),subs:people(v.subs||v.substitutes)};};
  const home=team(d.home),away=team(d.away);return home||away?{home,away}:null;
}
function sportStandings(raw){const rows=raw?.data?.standings||raw?.standings;if(!Array.isArray(rows))return null;return rows.slice(0,50).map(r=>({position:spNum(r.position??r.rank),team:spStr(r.team_name||r.team?.name,110),played:spNum(r.played),won:spNum(r.won),drawn:spNum(r.drawn??r.draw),lost:spNum(r.lost),goals_for:spNum(r.goals_for),goals_against:spNum(r.goals_against),points:spNum(r.points),form:Array.isArray(r.form)?r.form.slice(0,6).map(x=>spStr(x,1)):spStr(r.form,12).split('').slice(0,6)})).filter(r=>r.team);}
function sportLeaderboard(raw,section){const rows=Array.isArray(raw?.data)?raw.data:[];return rows.slice(0,60).map(r=>({rank:spNum(r.rank),name:spStr(r.player_name||r.name,100),team:spStr(r.team_name,100),goals:spNum(r.goals),assists:spNum(r.assists),yellow_cards:spNum(r.yellow_cards),red_cards:spNum(r.red_cards)})).filter(x=>x.name);}
function sportH2h(raw){return{summary:raw?.summary&&typeof raw.summary==='object'?{total:spNum(raw.summary.total_matches),home_wins:spNum(raw.summary.team1_wins),away_wins:spNum(raw.summary.team2_wins),draws:spNum(raw.summary.draws)}:null,matches:(Array.isArray(raw?.fixtures)?raw.fixtures:[]).slice(0,30).map(m=>({date:spStr(m.date,28),home:spStr(m.home_team,110),away:spStr(m.away_team,110),home_score:spScore(m.home_score),away_score:spScore(m.away_score)}))};}
function sportTeam(raw,section){
  if(section==='squad')return (Array.isArray(raw?.squad)?raw.squad:[]).slice(0,80).map(x=>({name:spStr(x.full_name||x.name,100),position:spStr(x.position,40),number:spNum(x.jersey_number),nationality:spStr(x.nationality,50)}));
  if(section==='trophies')return (Array.isArray(raw?.trophies)?raw.trophies:[]).slice(0,60).map(x=>({year:spNum(x.year),position:spStr(x.position,30),competition:spStr(x.tournament_name,90)}));
  const r=raw?.team||{};return {name:spStr(r.name,100),country:spStr(r.country,60),coach:spStr(r.coach_name,100),stadium:spStr(r.stadium_name,100),recent_matches:(Array.isArray(raw?.matches)?raw.matches:[]).slice(0,15).map(x=>({date:spStr(x.date,28),home:spStr(x.home_team,80),away:spStr(x.away_team,80),home_score:spScore(x.home_score),away_score:spScore(x.away_score)}))};
}
async function sportPublicResponse(url,env,ctx){
  if(!env?.SPORTAPI_AI_KEY)return sportJSON({error:'provider_not_configured'},503);
  const day=spDate(url.searchParams.get('date'));if(!day||!sportRange(day))return sportJSON({error:'date_out_of_range'},400);
  const route=url.pathname.substring('/api/sport/'.length);
  if(!['fixtures','match','league','team'].includes(route))return sportJSON({error:'unknown_route'},404);
  const key=await sportSigner(env.SPORTAPI_AI_KEY);
  let providerPath='',kind=route,identity='',section='',ttl=120;
  if(route==='fixtures'){providerPath='fixtures/date/'+day;ttl=day===new Date().toISOString().slice(0,10)?180:7200;}
  else {
    const id=spId(url.searchParams.get('id'));section=spStr(url.searchParams.get('section'),22);
    if(!id||!SPORT_SECTIONS[route][section]){if(!id||!(section in SPORT_SECTIONS[route]))return sportJSON({error:'invalid_request'},400);}
    if(route==='match'){
      const home=spId(url.searchParams.get('home')),away=spId(url.searchParams.get('away'));
      if(!home||!away)return sportJSON({error:'invalid_teams'},400);
      identity=id+':'+home+':'+away;
      providerPath=section==='h2h'?'fixtures/h2h/'+home+'/'+away:'fixtures/'+id+SPORT_SECTIONS.match[section];
    }else if(route==='league'){identity=id;providerPath=section==='standings'?'standings/'+id:'leagues/'+id+'/'+SPORT_SECTIONS.league[section];}
    else {identity=id;providerPath='teams/'+id+SPORT_SECTIONS.team[section];}
    if(!await sportVerify(key,route,identity,day,url.searchParams.get('token')))return sportJSON({error:'invalid_link'},403);
    ttl=section==='events'||section==='stats'?900:section==='lineups'?3600:section==='standings'?1800:7200;
  }
  const cacheReq=new Request(new URL('/__tiki_data_cache/v25/'+route+'/'+encodeURIComponent(day)+'/'+encodeURIComponent(identity||'date')+'/'+encodeURIComponent(section||'list'),url.origin).toString());
  let stored=null;try{stored=await caches.default.match(cacheReq);}catch{}
  if(stored)return stored;
  const fetched=await sportUpstream(providerPath,env.SPORTAPI_AI_KEY);
  if(fetched.error)return sportJSON({error:fetched.error},fetched.status);
  const raw=fetched.data;let payload=null;
  if(route==='fixtures'){
    const rows=sportRows(raw);if(!rows||rows.length>600)return sportJSON({error:'invalid_provider_data'},502);
    const fixtures=(await Promise.all(rows.map(x=>sportFixture(x,key,day)))).filter(Boolean);
    await spAttachSignedLogos(fixtures,env.SPORTAPI_AI_KEY);
    payload={source:'SportAPI.ai',date:day,updated_at:new Date().toISOString(),count:fixtures.length,fixtures};
  }else if(route==='match'){
    if(section==='stats')payload=sportStats(raw);
    else if(section==='lineups')payload=sportLineups(raw);
    else if(section==='events')payload=sportEvents(raw);
    else if(section==='h2h')payload=sportH2h(raw);
    else {const r=raw.fixture||raw.data?.fixture||raw.data||{};payload={stage:spStr(r.stage,60),venue:spStr(r.venue||r.stadium_name,100),referee:spStr(r.referee,100),events:sportEvents(raw)};}
  }else if(route==='league')payload=section==='standings'?sportStandings(raw):sportLeaderboard(raw,section);
  else payload=sportTeam(raw,section);
  const response=sportJSON({source:'SportAPI.ai',available:payload!==null&&(Array.isArray(payload)?payload.length>0:true),section:section||'fixtures',data:payload,updated_at:new Date().toISOString()},200,ttl);
  try{ctx?.waitUntil?.(caches.default.put(cacheReq,response.clone()));}catch{}
  return response;
}
export {sportPublicResponse, sportISO, sportFixture, sportStats, sportLineups, sportStandings, sportRange};
