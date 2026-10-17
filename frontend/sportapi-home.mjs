/* SportAPI.ai-only public homepage feed. No legacy fixture API, no bookmaker prices.
   All forecasts are a conservative, explicitly provisional Poisson baseline derived from current
   SportAPI standings: not trained/validated and never presented as live in-play odds. */
const TD_HOME_ORIGIN='https://sportapi.ai/api/';
const TD_MAX_RESPONSE=1100000;
const TD_FINISHED=new Set(['FT','AET','PEN','FINISHED','FULL_TIME']);
const TD_LIVE=new Set(['LIVE','1H','2H','HT','ET','BREAK']);
const TD_PRIORITIES=[
 [/champions league|europa league|conference league/i,100],
 [/premier league|la liga|bundesliga|serie a|ligue 1/i,94],
 [/super league.*gree|greek super|greece.*super|super league 1/i,91],
 [/cyprus|cypriot|1st division|first division.*cy/i,88],
 [/eredivisie|primeira liga|liga portugal/i,75],
 [/fa cup|copa del rey|coppa italia|coupe de france/i,70],
 [/championship|ligue 2|serie b|2\. bundesliga/i,50]
];
const tdId=x=>/^\d{1,13}$/.test(String(x??''))?String(x):null;
const tdString=(x,n=120)=>typeof x==='string'?x.trim().slice(0,n):'';
const tdScore=x=>Number.isInteger(x)&&x>=0&&x<=30?x:null;
const tdNum=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const tdClamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const tdDay=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?x:null;
const tdAddDays=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+86400000*n).toISOString().slice(0,10);
const tdStatus=row=>tdString(row.status?.short||row.status,25).toUpperCase();
function tdISO(r){const s=tdString(r.kickoff_utc||r.datetime||r.kickoff,45);if(!s)return null;const v=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)?s.replace(' ','T')+'Z':s;const ms=Date.parse(v);return /^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(ms)?new Date(ms).toISOString():null;}
function tdPriority(name,geo=''){
  const n=String(name||'');if(/premier league/i.test(n)&&!/^(premier league|english premier league)$/i.test(n))return 36;for(const [pattern,value] of TD_PRIORITIES){if(pattern.test(n))return value;}
  if(/^(GR|CY)$/i.test(geo))return 72;
  return 15;
}
function tdFixture(r){
 if(!r||typeof r!=='object')return null;
 const id=tdId(r.id),home=tdString(typeof r.home_team==='string'?r.home_team:r.home_team?.name),away=tdString(typeof r.away_team==='string'?r.away_team:r.away_team?.name);
 const date=tdISO(r),league=tdString(r.league_name||r.league?.name,105);
 if(!id||!home||!away||!date||!league||home===away)return null;
 const status=tdStatus(r),geo=tdString(r.league_geo,7),league_id=tdId(r.league_id);
 return {id,home,away,date,league,league_id,geo,home_id:tdId(r.home_id),away_id:tdId(r.away_id),
 status,minute:tdString(r.minute,8),home_score:tdScore(r.home_score),away_score:tdScore(r.away_score),stage:tdString(r.stage,60),
 priority:tdPriority(league,geo),model:null};
}
async function tdFetch(path,key){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),7000);
 try{
  const resp=await fetch(TD_HOME_ORIGIN+path,{headers:{'X-Api-Key':key,Accept:'application/json'},redirect:'manual',signal:c.signal});
  if(!resp.ok)return null;if(Number(resp.headers.get('content-length')||0)>TD_MAX_RESPONSE)return null;
  if(!resp.body)return null;const reader=resp.body.getReader(),parts=[];let size=0;
  for(;;){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>TD_MAX_RESPONSE){await reader.cancel();return null;}parts.push(v.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const x of parts){bytes.set(x,offset);offset+=x.length;}
  const json=JSON.parse(new TextDecoder().decode(bytes));return json?.success===false?null:json;
 }catch{return null}finally{clearTimeout(timer);}
}
function tdRows(result){return Array.isArray(result?.data)?result.data:Array.isArray(result?.fixtures)?result.fixtures:[];}
function tdPoisson(lambda){const p=[Math.exp(-lambda)];for(let k=1;k<=12;k++)p.push(p[k-1]*lambda/k);return p;}
function tdProbabilities(h,a){
 const home=tdPoisson(h),away=tdPoisson(a);let mass=0,p1=0,px=0,p2=0,over=0,btts=0;
 for(let i=0;i<home.length;i++)for(let j=0;j<away.length;j++){const p=home[i]*away[j];mass+=p;if(i>j)p1+=p;else if(i===j)px+=p;else p2+=p;if(i+j>2)over+=p;if(i>0&&j>0)btts+=p;}
 if(mass<=0)return null;
 return {p1:p1/mass*100,px:px/mass*100,p2:p2/mass*100,over25:over/mass*100,under25:(1-over/mass)*100,btts:btts/mass*100,no_btts:(1-btts/mass)*100,
  expected_home_goals:h,expected_away_goals:a,method:'provisional_poisson_standings',sample:'season_standings',updated_at:new Date().toISOString()};
}
function tdModelFromStandings(standings,fixture){
 const data=standings?.data?.standings||standings?.standings;
 if(!Array.isArray(data)||data.length<8)return null;
 const rows=data.map(x=>({name:tdString(x.team_name||x.team?.name||x.team,110),played:tdNum(x.played),gf:tdNum(x.goals_for),ga:tdNum(x.goals_against)}))
  .filter(x=>x.name&&x.played>=0&&x.gf>=0&&x.ga>=0&&x.played>0);
 if(rows.length<8||rows.reduce((n,x)=>n+x.played,0)<80)return null;
 const findTeam=(name)=>rows.find(x=>x.name.toLowerCase()===name.toLowerCase());
 const home=findTeam(fixture.home),away=findTeam(fixture.away);
 if(!home||!away||home.played<6||away.played<6)return null;
 const games=rows.reduce((n,x)=>n+x.played,0),gFor=rows.reduce((n,x)=>n+x.gf,0);
 const avg=tdClamp(gFor/games,.75,2.5),prior=8;
 const attack=t=>(t.gf+prior*avg)/(t.played+prior)/avg;
 const defend=t=>(t.ga+prior*avg)/(t.played+prior)/avg;
 const h=tdClamp(avg*attack(home)*defend(away)*1.08,.3,3.8),a=tdClamp(avg*attack(away)*defend(home)*.92,.3,3.8);
 return tdProbabilities(h,a);
}
function tdRecentRates(raw,name,kickoff){
 const matches=Array.isArray(raw?.matches)?raw.matches:[];
 const cutoff=String(kickoff||'').slice(0,10);
 const clean=matches.filter(m=>{
   const date=String(m.date||'').slice(0,10);
   return date&&date<cutoff&&Number.isInteger(m.home_score)&&Number.isInteger(m.away_score)
     &&m.home_score>=0&&m.away_score>=0&&m.home_score<=15&&m.away_score<=15
     &&(String(m.home_team||'').toLowerCase()===name.toLowerCase()||String(m.away_team||'').toLowerCase()===name.toLowerCase());
 }).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
 if(clean.length<6)return null;
 let g=0,a=0,weights=0;
 for(const x of clean){
   const isHome=String(x.home_team).toLowerCase()===name.toLowerCase();
   const gf=isHome?x.home_score:x.away_score,ga=isHome?x.away_score:x.home_score;
   const dt=Math.max(0,(Date.parse(cutoff+'T00:00:00Z')-Date.parse(String(x.date).slice(0,10)+'T00:00:00Z'))/86400000);
   const weight=Math.exp(-dt/150);
   g+=gf*weight;a+=ga*weight;weights+=weight;
 }
 const prior=8,base=1.35;
 return {attack:(g+prior*base)/(weights+prior),defense:(a+prior*base)/(weights+prior),n:clean.length};
}
function tdModelFromRecent(homeRaw,awayRaw,fixture){
 const h=tdRecentRates(homeRaw,fixture.home,fixture.date);
 const a=tdRecentRates(awayRaw,fixture.away,fixture.date);
 if(!h||!a)return null;
 const home=tdClamp((h.attack+a.defense)/2*1.09,.30,3.8);
 const away=tdClamp((a.attack+h.defense)/2*.91,.30,3.8);
 const market=tdProbabilities(home,away);
 if(!market)return null;
 return {...market,method:'provisional_poisson_recent_results',sample:'SportAPI.ai finished games before kickoff, all competitions',
    matches_sampled:{home:h.n,away:a.n},validated:false};
}
async function tdHomeBundle(secret){
 const today=new Date().toISOString().slice(0,10);
 const days=[today,tdAddDays(today,1),tdAddDays(today,2)];
 const data=await Promise.all(days.map(async day=>{const d=await tdFetch('fixtures/date/'+day,secret);return {day,ok:!!d,rows:tdRows(d)};}));
 const unique=new Map();
 for(const batch of data){for(const r of batch.rows){const fixture=tdFixture(r);if(fixture&&!unique.has(fixture.id))unique.set(fixture.id,fixture);}}
 const now=Date.now(),all=[...unique.values()],ongoing=all.filter(m=>TD_LIVE.has(m.status)).sort((a,b)=>b.priority-a.priority);
 const future=all.filter(m=>Date.parse(m.date)>=now-120000&&!TD_FINISHED.has(m.status)&&!TD_LIVE.has(m.status)).sort((a,b)=>b.priority-a.priority||Date.parse(a.date)-Date.parse(b.date));
 const notable=ongoing.filter(x=>x.priority>=70).slice(0,2),highlight=future.find(x=>x.priority>=65)||future[0]||ongoing[0]||null;
 let choices=highlight?[highlight]:[];
 const seenLeague=new Set(choices.map(x=>x.league_id));
 for(const m of [...notable,...future]){if(choices.length>=4)break;if(choices.some(x=>x.id===m.id))continue;
 if(m.priority>=40&&(!seenLeague.has(m.league_id)||choices.length<3)){choices.push(m);seenLeague.add(m.league_id);}}
 const candidates=[...new Set(choices.filter(m=>m.league_id).map(m=>m.league_id))].slice(0,3);
 const standings=await Promise.all(candidates.map(async id=>({id,data:await tdFetch('standings/'+id,secret)})));
 const table=new Map(standings.map(x=>[x.id,x.data]));
 const enriched=await Promise.all(choices.map(async m=>({...m,
   logos:{home:await tdSignedLogo(secret,m.home_id),away:await tdSignedLogo(secret,m.away_id)},
   model:Date.parse(m.date)>now&&!TD_FINISHED.has(m.status)?tdModelFromStandings(table.get(m.league_id),m):null})));
 // A league without usable standings can still have genuine prior completed team games.
// Only the featured pre-match pick is enriched, bounding extra provider requests to two.
 if(enriched[0]&&!enriched[0].model&&enriched[0].home_id&&enriched[0].away_id&&Date.parse(enriched[0].date)>now){
  const [h,a]=await Promise.all([tdFetch('teams/'+enriched[0].home_id,secret),tdFetch('teams/'+enriched[0].away_id,secret)]);
  enriched[0].model=tdModelFromRecent(h,a,enriched[0]);
 }
 const top=all.filter(x=>x.priority>=50).length;
 return {source:'SportAPI.ai',updated_at:new Date().toISOString(),range:days,
  coverage:{matches:all.length,competitions:new Set(all.map(x=>x.league_id||x.league)).size,priority_matches:top,days_available:data.filter(x=>x.ok).length},
  featured:enriched[0]||null,upcoming:enriched.slice(1,4),
  live:ongoing.filter(x=>x.priority>=50).slice(0,2).map(m=>({...m,model:null})),
  integrity:{fixtures_provider:'SportAPI.ai',model_basis:'SportAPI.ai current standings only',model_status:'provisional_unvalidated',in_play_probabilities:false},
  fallback_reason:data.some(x=>!x.ok)?'Some days unavailable':null,_fixtures:all};
}
function tdPublicJSON(j,status=200,maxage=0){
 return new Response(JSON.stringify(j),{status,headers:{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':maxage?'public,max-age='+maxage:'no-store'}});
}
async function tdStoreAssets(db,all,now){
 if(!db||!Array.isArray(all))return;
 try{
  const last=await db.prepare("SELECT observed_at FROM sportapi_ingest_state WHERE job_name='asset_daily'").first();
  if(last?.observed_at&&Date.now()-Date.parse(last.observed_at)<18*3600000)return;
  const teams=new Map(),leagues=new Map();
  for(const m of all){
   if(m.league_id&&!leagues.has(m.league_id))leagues.set(m.league_id,m);
   for(const side of ['home','away']){
    const id=m[side+'_id'];if(id&&!teams.has(id))teams.set(id,{id,name:m[side],league:m.league_id});
   }
  }
  const nowIso=new Date().toISOString();const items=[];
  for(const m of teams.values())items.push(db.prepare(
   "INSERT INTO sportapi_team_assets (provider_team_id,team_name,logo_endpoint,observed_league_id,observed_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(provider_team_id) DO UPDATE SET team_name=excluded.team_name,observed_league_id=excluded.observed_league_id,observed_at=excluded.observed_at"
  ).bind(m.id,m.name,'https://sportapi.ai/api/teams/'+m.id+'/logo',m.league,nowIso));
  for(const m of leagues.values())items.push(db.prepare(
   "INSERT INTO sportapi_league_assets (provider_league_id,league_name,country_geo,logo_endpoint,observed_at) VALUES (?1,?2,?3,NULL,?4) ON CONFLICT(provider_league_id) DO UPDATE SET league_name=excluded.league_name,country_geo=excluded.country_geo,observed_at=excluded.observed_at"
  ).bind(m.league_id,m.league,m.geo,nowIso));
  for(let i=0;i<items.length;i+=75)await db.batch(items.slice(i,i+75));
  await db.prepare("INSERT INTO sportapi_ingest_state (job_name,observed_at) VALUES('asset_daily',?1) ON CONFLICT(job_name) DO UPDATE SET observed_at=excluded.observed_at").bind(nowIso).run();
 }catch{/* historical asset catalog is auxiliary; never prevent public fixtures */}
}
async function tdBundle(env,ctx){
 const cached=await (async()=>{try{
  if(!env.TIKI_DB)return null;
  const row=await env.TIKI_DB.prepare("SELECT payload_json FROM sportapi_home_cache WHERE cache_key='home_v24' AND expires_at > ?1").bind(Math.floor(Date.now()/1000)).first();
  return row?JSON.parse(row.payload_json):null;
 }catch{return null}})();
 if(cached?.source==='SportAPI.ai')return cached;
 const result=await tdHomeBundle(env.SPORTAPI_AI_KEY);
 if(!result.coverage.matches)return result;
 if(env.TIKI_DB&&ctx?.waitUntil){
  const payload=JSON.stringify(result);
  ctx.waitUntil((async()=>{
   try{await env.TIKI_DB.prepare("INSERT INTO sportapi_home_cache(cache_key,payload_json,expires_at,saved_at) VALUES('home_v24',?1,?2,?3) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at,saved_at=excluded.saved_at")
      .bind(payload,Math.floor(Date.now()/1000)+600,new Date().toISOString()).run();}catch{}
   await tdStoreAssets(env.TIKI_DB,result._fixtures,new Date());
  })());
 }
 return result;
}
async function tdHomeHandler(req,env,ctx){
 if(!env?.SPORTAPI_AI_KEY)return tdPublicJSON({error:'provider_not_configured'},503);
 const cacheKey=new Request('https://tiki-cache.local/td/home-v24');
 try{const cached=await caches.default.match(cacheKey);if(cached)return cached;}catch{}
 const result=await tdBundle(env,ctx);
 if(!result.coverage.matches)return tdPublicJSON({error:'provider_unavailable'},503);
 const safe={...result};delete safe._fixtures;
 const response=tdPublicJSON(safe,200,600);
 try{ctx?.waitUntil?.(caches.default.put(cacheKey,response.clone()))}catch{}
 return response;
}
async function tdPredictionsHandler(req,env,ctx){
 if(!env?.SPORTAPI_AI_KEY)return tdPublicJSON({error:'provider_not_configured',matches:[]},503);
 const cacheKey=new Request('https://tiki-cache.local/td/predictions-v24');
 try{const cached=await caches.default.match(cacheKey);if(cached)return cached;}catch{}
 const b=await tdBundle(env,ctx);if(!b.coverage.matches)return tdPublicJSON({error:'provider_unavailable',matches:[]},503);
 const modeled=new Map([b.featured,...b.upcoming].filter(Boolean).map(m=>[m.id,m.model]));
 const matches=b._fixtures.map(m=>({
   id:'sportapi-'+m.id,league:m.league,date:m.date,home:m.home,away:m.away,
   p1:modeled.get(m.id)?.p1??null,px:modeled.get(m.id)?.px??null,p2:modeled.get(m.id)?.p2??null,
   over25:modeled.get(m.id)?.over25??null,under25:modeled.get(m.id)?.under25??null,
   btts:modeled.get(m.id)?.btts??null,no_btts:modeled.get(m.id)?.no_btts??null,
   home_score:m.home_score,away_score:m.away_score,status:m.status,
   provider:'sportapi.ai',home_id:m.home_id,away_id:m.away_id,league_id:m.league_id
 }));
 const response=tdPublicJSON({demo:false,source:'SportAPI.ai',matches,model:{name:'provisional_poisson_standings',available_on_selected_games_only:true,validated:false},
  generated_at:b.updated_at,coverage:b.coverage},200,600);
 try{ctx?.waitUntil?.(caches.default.put(cacheKey,response.clone()))}catch{}
 return response;
}
export {tdFixture,tdPriority,tdModelFromStandings,tdModelFromRecent,tdRecentRates,tdProbabilities,tdHomeBundle,tdHomeHandler,tdPredictionsHandler,tdStoreAssets};