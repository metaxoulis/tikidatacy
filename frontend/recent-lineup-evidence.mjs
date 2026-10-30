/* Read-only projection and role estimates using *past* Sportmonks lineups only.
 * Football-API player IDs are never compared to Sportmonks player IDs.
 * Never present a historical position as an official current-game position.
 */
const FA_LU_FRESH_MS=60*86400000;
const FA_LU_MAX_LOOKBACK_MS=450*86400000;
const FA_LU_MAX_GAMES=8;
const FA_LU_ROLE_ORDER=['Τερματοφύλακας','Αμυντικός','Αμυντικός μέσος','Μέσος','Μεσοεπιθετικός','Επιθετικός'];
// Sportmonks position_id groups; used for bench rows, which carry no formation_field.
const FA_LU_POSITION_GROUP={24:'Τερματοφύλακας',25:'Αμυντικός',26:'Μέσος',27:'Επιθετικός'};
const FA_LU_NAME_PARTICLES=new Set(['van','von','der','den','del','della','dos','das','bin','ben']);
const faLineupDayMs=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:null};
const faLineupValidFormation=v=>typeof v==='string'&&/^([1-5]-){1,4}[1-5]$/.test(v)&&v.split('-').map(Number).reduce((a,b)=>a+b,0)===10;
const faLineupRoleRank=role=>{const i=FA_LU_ROLE_ORDER.indexOf(role);return i<0?99:i};
const faLineupLine=role=>role==='Τερματοφύλακας'?'G':role==='Αμυντικός'?'D':role==='Επιθετικός'?'F':role?'M':null;
export function faLineupName(v){
 return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
/* Sportmonks numbers formation_field rows per formation (1 = goalkeeper, 2 = defence, last = attack), so row 4
   is the striker line in 4-3-3 but the attacking-midfield line in 4-2-3-1. Rows are read against that match's
   own formation; without one, only the goalkeeper row or the player's position_id group is trusted. */
export function faHistoricalRole(field,formation,positionId){
 const lane=/^([1-9]):\d{1,2}$/.exec(String(field||'')),row=lane?Number(lane[1]):null;
 if(row===1)return 'Τερματοφύλακας';
 const lines=faLineupValidFormation(formation)?formation.split('-').map(Number):null;
 if(lines&&row&&row<=lines.length+1){
  if(row===2)return 'Αμυντικός';
  if(row===lines.length+1)return 'Επιθετικός';
  const middle=lines.slice(1,-1),i=row-3;
  if(middle.length>1&&i===0&&middle[0]<=2)return 'Αμυντικός μέσος';
  if(middle.length>1&&i===middle.length-1&&middle[i]<=3)return 'Μεσοεπιθετικός';
  return 'Μέσος';
 }
 return FA_LU_POSITION_GROUP[positionId]||null;
}
export function faHistorySeasonStart(kickoff){
 const d=new Date(kickoff);
 if(!Number.isFinite(d.getTime()))return null;
 const y=d.getUTCFullYear()-(d.getUTCMonth()<6?1:0);
 return Date.UTC(y-1,6,1);
}
/* Football-API abbreviates first names ("M. Sannadi") while Sportmonks keeps them ("Maroan Sannadi").
   A provider name matches one recent player of the same team by full name, or by surname plus initial;
   the shirt number only breaks ties. Anything still ambiguous stays unmatched. */
export function faLineupNameMatch(currentName,number,people){
 const k=faLineupName(currentName);if(!k)return null;
 const exact=people.filter(p=>p.norm===k);if(exact.length)return exact.length===1?exact[0]:null;
 const tokens=k.split(' '),initial=tokens.length>1&&tokens[0].length===1?tokens[0]:null;
 const surname=(initial?tokens.slice(1):tokens).filter(t=>t.length>=3&&!FA_LU_NAME_PARTICLES.has(t));
 if(!surname.length)return null;
 const shared=people.filter(p=>surname.some(t=>p.tokens.includes(t)));
 const sameInitial=initial?shared.filter(p=>p.tokens[0]?.[0]===initial):shared;
 if(sameInitial.length===1)return sameInitial[0];
 const byNumber=(sameInitial.length?sameInitial:shared).filter(p=>Number.isInteger(number)&&p.number===number);
 return byNumber.length===1?byNumber[0]:null;
}
export async function faRecentLineupEvidence(db,teamId,kickoff,fa=null){
 const at=faLineupDayMs(kickoff),season=faHistorySeasonStart(kickoff);
 const archived=!!db&&Number.isSafeInteger(teamId)&&teamId>0,stored=!!fa?.db&&Number.isSafeInteger(fa.teamId)&&fa.teamId>0;
 if((!archived&&!stored)||at===null||season===null)return null;
 // The last two seasons, up to eight complete matches per source, and strictly pre-match.
 const lower=Math.max(season,at-FA_LU_MAX_LOOKBACK_MS),day=new Date(at).toISOString().slice(0,10);
 const cutoff=new Date(at-3*86400000).toISOString().slice(0,19).replace('T',' ');
 const from=new Date(lower).toISOString().slice(0,19).replace('T',' ');
 // Stored Football-API rows carry the archived team ID when the club is mapped, so both sources describe one team.
 const team=archived?teamId:'football-api:'+fa.teamId;
 try{
  // Either source failing (e.g. a missing table) leaves the other one in use.
  const none={fixtures:[],players:[]};
  const [sm,fl]=await Promise.all([
   archived?faLineupCached('sm/'+teamId+'/'+day,21600,()=>faArchivedLineupRows(db,teamId,cutoff,from)).catch(()=>none):none,
   stored?faLineupCached('fa/'+fa.teamId+'/'+day,10800,()=>faStoredLineupRows(fa.db,fa.teamId,cutoff.slice(0,10),from.slice(0,10))).catch(()=>none):none]);
  const fixtures=[...sm.fixtures,...fl.fixtures.map(f=>({...f,home_id:team,away_id:null,home_formation:null}))];
  const players=[...sm.players,...fl.players.map(p=>({...p,team_id:team}))];
  return fixtures.length?faAnalyzeLineupEvidence(fixtures,players,team,kickoff):null;
 }catch{return null}
}
// Cached per team and match day: the archive no longer changes and stored lineups only grow every four hours.
async function faLineupCached(key,ttl,load){
 const cache=typeof caches!=='undefined'?caches.default:null,req=new Request('https://tiki-cache.local/lineup-evidence-v1/'+key);
 try{const hit=await cache?.match(req);if(hit)return await hit.json()}catch{}
 const data=await load();
 try{await cache?.put(req,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'max-age='+ttl}}))}catch{}
 return data;
}
async function faArchivedLineupRows(db,teamId,cutoff,from){
 // Two branches so each can use sm_fixtures_home_date / sm_fixtures_away_date; "home_id=? OR away_id=?" scans
 // every archived fixture.
 const games="SELECT id,starting_at,home_id,away_id,home_formation,away_formation FROM sm_fixtures WHERE state IN ('FT','AET','FTP') AND starting_at < ?1 AND starting_at >= ?2 AND ";
 const raw=await db.prepare(games+"home_id=?3 UNION ALL "+games+"away_id=?3 ORDER BY starting_at DESC,id DESC LIMIT 8").bind(cutoff,from,teamId).all();
 const fixtures=(raw.results||[]).filter(f=>f&&Number.isSafeInteger(f.id)).slice(0,FA_LU_MAX_GAMES);
 if(!fixtures.length)return {fixtures:[],players:[]};
 const ids=fixtures.map(f=>f.id);
 const placeholders=ids.map((_,i)=>'?'+(i+2)).join(',');
 const rs=await db.prepare("SELECT fixture_id,team_id,player_id,player_name,jersey_number,position_id,role,formation_field,formation_position FROM sm_lineups WHERE team_id=?1 AND fixture_id IN ("+placeholders+") AND role IN ('lineup','bench')").bind(teamId,...ids).all();
 return {fixtures,players:rs.results||[]};
}
// Lineups stored by faSyncLineups: who started and who was on the bench, without formation or positions.
async function faStoredLineupRows(db,faTeamId,cutoffDay,fromDay){
 const raw=await db.prepare('SELECT fa_match_id,match_date,starters_json,bench_json FROM football_lineups WHERE fa_team_id=?1 AND match_date<=?2 AND match_date>=?3 ORDER BY match_date DESC,fa_match_id DESC LIMIT 8').bind(faTeamId,cutoffDay,fromDay).all();
 const fixtures=[],players=[];
 for(const r of raw.results||[]){
  const id='football-api:'+r.fa_match_id;
  // Only the match day is stored; midday keeps the three-day embargo close to the real kickoff.
  fixtures.push({id,starting_at:r.match_date+' 12:00:00',source:'football-api'});
  for(const [json,role] of [[r.starters_json,'lineup'],[r.bench_json,'bench']]){
   let list=[];try{list=JSON.parse(json)}catch{}
   for(const p of Array.isArray(list)?list:[])players.push({fixture_id:id,player_id:p.id?'football-api:'+p.id:null,player_name:p.name,
    jersey_number:Number.isInteger(p.number)?p.number:null,position_id:null,role,formation_field:null,source:'football-api'});
  }
 }
 return {fixtures,players};
}
export function faAnalyzeLineupEvidence(fixtures,players,teamId,kickoff){
 const at=faLineupDayMs(kickoff),season=faHistorySeasonStart(kickoff);if(at===null||season===null)return null;
 const lower=Math.max(season,at-FA_LU_MAX_LOOKBACK_MS),embargo=at-3*86400000;
 const games=(fixtures||[]).filter(f=>f?.id!=null&&(f.home_id===teamId||f.away_id===teamId)).filter(f=>{
  const time=faLineupDayMs(String(f.starting_at).replace(' ','T')+'Z');return time!==null&&time<embargo&&time>=lower;
 }).sort((a,b)=>String(b.starting_at).localeCompare(String(a.starting_at)));
 const starters=new Map(games.map(f=>[f.id,[]])),bench=new Map(games.map(f=>[f.id,[]]));
 for(const p of players||[]){
  if(p?.team_id!==teamId||typeof p.player_name!=='string'||!faLineupName(p.player_name))continue;
  const rows=p.role==='lineup'?starters.get(p.fixture_id):p.role==='bench'?bench.get(p.fixture_id):null;
  if(rows&&!rows.some(old=>old.player_id===p.player_id&&old.player_name===p.player_name))rows.push(p);
 }
 const complete=games.filter(f=>starters.get(f.id).length>=10&&starters.get(f.id).length<=12);
 if(!complete.length)return null;
 // Archived Sportmonks games give formations and positions; stored Football-API games only who started.
 // Who starts is judged on the eight newest complete games from either source.
 const recent=complete.slice(0,FA_LU_MAX_GAMES),archived=complete.filter(f=>f.source!=='football-api');
 // One entry per player ID; shirt numbers follow the newest appearance.
 const people=new Map(),forms=new Map();
 const person=(p,f)=>{
  const norm=faLineupName(p.player_name),key=p.player_id?'id:'+p.player_id:'name:'+norm;
  if(!people.has(key))people.set(key,{norm,tokens:norm.split(' '),name:p.player_name,number:null,seen:'',score:0,starts:0,roles:new Map(),benchRoles:new Map()});
  const x=people.get(key),at=String(f.starting_at);
  if(at>x.seen){x.seen=at;if(Number.isInteger(p.jersey_number))x.number=p.jersey_number}
  return x;
 };
 const add=(m,role,w)=>{if(role)m.set(role,(m.get(role)||0)+w)};
 archived.forEach((f,index)=>{
  const formation=f.home_id===teamId?f.home_formation:f.away_formation,weight=Math.pow(.78,index),counted=new Set();
  for(const p of starters.get(f.id)){const x=person(p,f);if(!counted.has(x)){counted.add(x);add(x.roles,faHistoricalRole(p.formation_field,formation,p.position_id),weight)}}
 });
 games.filter(f=>f.source!=='football-api').forEach((f,index)=>{for(const p of bench.get(f.id))add(person(p,f).benchRoles,faHistoricalRole(null,null,p.position_id),Math.pow(.78,index))});
 // A Football-API player ("M. Sannadi") joins the archived player he matches ("Maroan Sannadi") so he keeps his
 // position; otherwise he is a new player whose position stays unknown.
 const archivedPeople=[...people.values()];
 const resolve=(p,f)=>{
  if(p.source==='football-api'){
   const key=p.player_id?'id:'+p.player_id:'name:'+faLineupName(p.player_name);
   if(!people.has(key)){const same=faLineupNameMatch(p.player_name,p.jersey_number,archivedPeople);if(same)people.set(key,same)}
  }
  return person(p,f);
 };
 recent.forEach((f,index)=>{
  const formation=f.home_id===teamId?f.home_formation:f.away_formation,weight=Math.pow(.78,index),counted=new Set();
  if(faLineupValidFormation(formation))forms.set(formation,(forms.get(formation)||0)+1);
  for(const p of starters.get(f.id)){const x=resolve(p,f);if(!counted.has(x)){counted.add(x);x.score+=weight;x.starts++}}
 });
 const top=m=>[...m].sort((a,b)=>b[1]-a[1]||faLineupRoleRank(a[0])-faLineupRoleRank(b[0]))[0]?.[0]||null;
 const list=[...new Set(people.values())].map(x=>{const position=top(x.roles)||top(x.benchRoles);return {...x,position,is_goalkeeper:position==='Τερματοφύλακας'}})
  .sort((a,b)=>b.score-a.score||b.starts-a.starts||a.name.localeCompare(b.name));
 const regulars=list.filter(x=>x.starts>0);
 const common=[...forms].sort((a,b)=>b[1]-a[1]);
 const formation=common[0]?.[1]>=2?common[0][0]:null;
 const recentDate=faLineupDayMs(String(recent[0].starting_at).replace(' ','T')+'Z');
 const projectionReady=recent.length>=3&&regulars.length>=11&&recentDate!==null&&(at-recentDate)<FA_LU_FRESH_MS;
 let projected=null;
 const keeper=projectionReady?regulars.find(x=>x.is_goalkeeper):null;
 if(keeper){
  // Fill the usual formation's lines with the most frequent recent starters for each line, then top up by starts.
  // A regular without a known position (a new signing) is taken on his starts alone.
  const outfield=regulars.filter(x=>!x.is_goalkeeper),chosen=new Set();
  if(formation){
   const lines=formation.split('-').map(Number),need={D:lines[0],M:lines.slice(1,-1).reduce((a,b)=>a+b,0),F:lines.at(-1)};
   for(const x of outfield){if(chosen.size>=10)break;const line=faLineupLine(x.position);if(!line||need[line]>0){if(line)need[line]--;chosen.add(x)}}
  }
  for(const x of outfield)if(chosen.size<10)chosen.add(x);
  if(chosen.size===10)projected=[keeper,...chosen].sort((a,b)=>faLineupRoleRank(a.position)-faLineupRoleRank(b.position)||b.score-a.score)
   .map(x=>({name:x.name,number:x.number,position:x.position,position_source:x.position?'recent_historical_lineups':null,
    is_goalkeeper:x.is_goalkeeper,id:null,order:null,role:x.position,source:'recent_historical_projection'}));
 }
 // Team + name (surname and initial at least) + one Sportmonks player ID, never cross-provider numeric player IDs.
 function positionFor(currentName,number){
  const x=faLineupNameMatch(currentName,number,list);
  return x?.position?{position:x.position,position_source:'recent_historical_lineups',is_goalkeeper:x.is_goalkeeper}:null;
 }
 return {matches_observed:recent.length,formation,projected,positionFor,oldest:recent.at(-1).starting_at,
  newest:recent[0].starting_at,verified:false,source:'archived_previous_lineups',
  football_api_matches:recent.filter(f=>f.source==='football-api').length};
}
export function faEnrichProviderLineups(data,evidence){
 const side=key=>{
  const source=data?.[key]||{starters:[],bench:[]};
  const annotate=p=>{const pos=evidence?.[key]?.positionFor(p.name,p.number);return {...p,...(pos||{})}};
  const announced=source.starters?.length>0;
  return {starters:announced?source.starters.map(annotate):evidence?.[key]?.projected||[],
   bench:announced?(source.bench||[]).map(annotate):[],
   source:announced?'football_api_announced_unverified':evidence?.[key]?.projected?'recent_historical_projection':'unavailable'};
 };
 return {home:side('home'),away:side('away')};
}
