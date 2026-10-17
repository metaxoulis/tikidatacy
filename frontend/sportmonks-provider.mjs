/* Sportmonks v3: one live match-data supplier. The API token is a server-side Cloudflare Secret.
 * Keep the historical CC0 model separate; never persist raw provider responses.
 */
const SM_ROOT='https://api.sportmonks.com/v3/football/';
const SM_DAY_MS=86400000;
const smText=(x,n=120)=>typeof x==='string'?x.trim().slice(0,n):'';
const smId=x=>Number.isInteger(x)&&x>0&&x<1e15?x:null;
const smIsoDay=d=>{const x=String(d||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return null;const v=Date.parse(x+'T00:00:00Z');return Number.isFinite(v)&&new Date(v).toISOString().slice(0,10)===x?x:null};
const smAddDay=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*SM_DAY_MS).toISOString().slice(0,10);
function smLogo(x){
 if(typeof x!=='string')return null;
 try{const u=new URL(x);return u.protocol==='https:'&&u.hostname==='cdn.sportmonks.com'
  &&/^\/images\/[\w/%.-]{1,190}\.(?:png|jpe?g|webp|svg)$/i.test(u.pathname)&&!u.search?u.href:null}catch{return null}
}
function smSide(row,name){
 return (Array.isArray(row?.participants)?row.participants:[]).find(p=>p&&
  String(p.meta?.location||p.meta?.position||'').toLowerCase()===name)||null;
}
function smNormalizeFixture(row,verifiedLeagues){
 if(!row||row.sport_id!==1||row.placeholder===true||!smId(row.id))return null;
 const verified=verifiedLeagues.get(row.league_id);
 if(!verified)return null;
 const home=smSide(row,'home'),away=smSide(row,'away');
 if(!smId(home?.id)||!smId(away?.id)||home.id===away.id||!smText(home?.name)||!smText(away?.name))return null;
 const stamp=smText(row.starting_at,30).replace(' ','T')+'Z';
 const time=Date.parse(stamp);if(!Number.isFinite(time))return null;
 const state=smText(row.state?.short_name||row.state?.state||row.state?.name||'NS',25).toUpperCase();
 return {id:'sportmonks-'+row.id,provider:'sportmonks',league_key:verified.key,
  league:verified.name,league_id:row.league_id,country:verified.country,
  home:smText(home.name),away:smText(away.name),date:new Date(time).toISOString(),
  home_id:home.id,away_id:away.id,status:state,logos:{home:smLogo(home.image_path),away:smLogo(away.image_path)},
  league_logo:smLogo(verified.image_path),scores:Array.isArray(row.scores)?row.scores:[]};
}
function smPublishedScore(row){
 if(!Array.isArray(row?.scores))return{home:null,away:null};
 const priority=['CURRENT','2ND_HALF','1ST_HALF','FT','FULL_TIME'];
 for(const key of priority){
  const rows=row.scores.filter(s=>String(s.description||'').toUpperCase()===key);
  if(!rows.length)continue;
  const h=rows.find(s=>s.score?.participant==='home')?.score?.goals;
  const a=rows.find(s=>s.score?.participant==='away')?.score?.goals;
  if(Number.isInteger(h)&&Number.isInteger(a)&&h>=0&&a>=0)return{home:h,away:a};
 }
 return{home:null,away:null};
}
async function smHttp(relative,token,requestFetch=fetch){
 if(typeof token!=='string'||!token.trim())throw Error('sportmonks_not_configured');
 if(!/^(?:leagues\/date\/\d{4}-\d{2}-\d{2}|fixtures\/date\/\d{4}-\d{2}-\d{2}|livescores\/inplay)\?/.test(relative))throw Error('sportmonks_path_invalid');
 let url=SM_ROOT+relative;
 for(let attempt=0;attempt<3;attempt++){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  let response;
  try{response=await requestFetch(url,{method:'GET',headers:{Authorization:token,Accept:'application/json'},redirect:'manual',signal:ctrl.signal})}
  finally{clearTimeout(timer)}
  if([301,302,303,307,308].includes(response.status)){
   const next=new URL(response.headers.get('location')||'',url);
   if(next.hostname!=='api.sportmonks.com'||next.protocol!=='https:'||
      !/^\/(?:api\/)?v3\/football\//.test(next.pathname))throw Error('sportmonks_bad_redirect');
   url=next.toString();continue;
  }
  if(response.status===401)throw Error('sportmonks_unauthorized');
  if(response.status===403)throw Error('sportmonks_subscription_restricted');
  if(response.status===429)throw Error('sportmonks_quota_reached');
  if(!response.ok)throw Error('sportmonks_upstream_'+response.status);
  if(Number(response.headers.get('content-length')||0)>2500000)throw Error('sportmonks_payload_too_large');
  const text=await response.text();if(text.length>2500000)throw Error('sportmonks_payload_too_large');
  let result;try{result=JSON.parse(text)}catch{throw Error('sportmonks_invalid_json')}
  if(!result||!Array.isArray(result.data))throw Error('sportmonks_invalid_shape');
  return result;
 }
 throw Error('sportmonks_redirect_loop');
}
async function smPages(path,token,fetcher=fetch,options={}){
 const rows=[];const max=options.maxPages||12;
 for(let page=1;page<=max;page++){
  const q=new URLSearchParams({...options.params,per_page:'50',page:String(page)});
  const d=await smHttp(path+'?'+q.toString(),token,fetcher);
  rows.push(...d.data);
  if(!d.pagination?.has_more)return rows;
 }
 throw Error('sportmonks_incomplete_pagination');
}
async function smLeagues(date,token,classify,fetcher=fetch){
 const rows=await smPages('leagues/date/'+date,token,fetcher,{params:{include:'country'}});
 const verified=new Map();
 for(const l of rows){
  const id=smId(l.id),country=smText(l.country?.name,60),league=smText(l.name);
  if(!id||!country||!league)continue;
  const key=classify(league,country);
  if(key)verified.set(id,{key,name:league,country,image_path:l.image_path});
 }
 return verified;
}
async function smDay(date,token,classify,fetcher=fetch){
 const leagues=await smLeagues(date,token,classify,fetcher);
 if(!leagues.size)return[];
 const ids=[...leagues.keys()].join(',');
 const raw=await smPages('fixtures/date/'+date,token,fetcher,{params:{include:'participants;league.country;state',filters:'fixtureLeagues:'+ids}});
 return raw.map(f=>smNormalizeFixture(f,leagues)).filter(Boolean);
}
async function smWeek(start,token,classify,fetcher=fetch,count=7){
 if(!smIsoDay(start)||count<1||count>7)throw Error('sportmonks_invalid_window');
 const all=await Promise.allSettled(Array.from({length:count},(_,i)=>smDay(smAddDay(start,i),token,classify,fetcher)));
 const success=all.filter(v=>v.status==='fulfilled');
 if(!success.length)throw Error('sportmonks_all_dates_failed');
 const map=new Map();for(const day of success)for(const m of day.value)map.set(m.id,m);
 const fixtures=[...map.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 return{fixtures,dates_checked:count,dates_successful:success.length,partial:success.length!==count};
}
async function smInplay(token,classify,fetcher=fetch,date=new Date().toISOString().slice(0,10)){
 const [leagues,raw]=await Promise.all([
  smLeagues(date,token,classify,fetcher),
  smPages('livescores/inplay',token,fetcher,{params:{include:'participants;league.country;state;scores;events'},maxPages:8})]);
 return raw.map(row=>{
  const fixture=smNormalizeFixture(row,leagues);if(!fixture)return null;
  const score=smPublishedScore(row);
  return {id:fixture.id,home:fixture.home,away:fixture.away,league:fixture.league,league_key:fixture.league_key,
   status:fixture.status,date:fixture.date,logos:fixture.logos,league_logo:fixture.league_logo,
   home_score:score.home,away_score:score.away};
 }).filter(Boolean);
}
export {smLogo,smNormalizeFixture,smHttp,smPages,smLeagues,smDay,smWeek,smInplay,smPublishedScore};