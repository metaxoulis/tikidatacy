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
export async function faRecentLineupEvidence(db,teamId,kickoff){
 const at=faLineupDayMs(kickoff),season=faHistorySeasonStart(kickoff);
 if(!db||!Number.isSafeInteger(teamId)||teamId<1||at===null||season===null)return null;
 // The last two seasons, up to eight complete matches, and strictly pre-match.
 const lower=Math.max(season,at-FA_LU_MAX_LOOKBACK_MS);
 const cutoff=new Date(at-3*86400000).toISOString().slice(0,19).replace('T',' ');
 const from=new Date(lower).toISOString().slice(0,19).replace('T',' ');
 try{
  const raw=await db.prepare("SELECT id,starting_at,home_id,away_id,home_formation,away_formation FROM sm_fixtures WHERE state IN ('FT','AET','FTP') AND starting_at < ?1 AND starting_at >= ?2 AND (home_id=?3 OR away_id=?3) ORDER BY starting_at DESC,id DESC LIMIT 8").bind(cutoff,from,teamId).all();
  const fixtures=(raw.results||[]).filter(f=>f&&Number.isSafeInteger(f.id)&&faLineupDayMs(f.starting_at.replace(' ','T')+'Z')<at-3*86400000).slice(0,FA_LU_MAX_GAMES);
  if(!fixtures.length)return null;
  const ids=fixtures.map(f=>f.id);
  const placeholders=ids.map((_,i)=>'?'+(i+2)).join(',');
  const rs=await db.prepare("SELECT fixture_id,team_id,player_id,player_name,jersey_number,position_id,role,formation_field,formation_position FROM sm_lineups WHERE team_id=?1 AND fixture_id IN ("+placeholders+") AND role IN ('lineup','bench')").bind(teamId,...ids).all();
  return faAnalyzeLineupEvidence(fixtures,(rs.results||[]),teamId,kickoff);
 }catch{return null}
}
export function faAnalyzeLineupEvidence(fixtures,players,teamId,kickoff){
 const at=faLineupDayMs(kickoff),season=faHistorySeasonStart(kickoff);if(at===null||season===null)return null;
 const lower=Math.max(season,at-FA_LU_MAX_LOOKBACK_MS),embargo=at-3*86400000;
 const games=(fixtures||[]).filter(f=>Number.isSafeInteger(f?.id)&&(f.home_id===teamId||f.away_id===teamId)).filter(f=>{
  const time=faLineupDayMs(String(f.starting_at).replace(' ','T')+'Z');return time!==null&&time<embargo&&time>=lower;
 }).sort((a,b)=>String(b.starting_at).localeCompare(String(a.starting_at))).slice(0,FA_LU_MAX_GAMES);
 const starters=new Map(games.map(f=>[f.id,[]])),bench=new Map(games.map(f=>[f.id,[]]));
 for(const p of players||[]){
  if(p?.team_id!==teamId||typeof p.player_name!=='string'||!faLineupName(p.player_name))continue;
  const rows=p.role==='lineup'?starters.get(p.fixture_id):p.role==='bench'?bench.get(p.fixture_id):null;
  if(rows&&!rows.some(old=>old.player_id===p.player_id&&old.player_name===p.player_name))rows.push(p);
 }
 const complete=games.filter(f=>starters.get(f.id).length>=10&&starters.get(f.id).length<=12);
 if(!complete.length)return null;
 // One entry per Sportmonks player ID; newest games are read first, so name and shirt are the latest seen.
 const people=new Map(),forms=new Map();
 const person=p=>{
  const norm=faLineupName(p.player_name),key=p.player_id?'id:'+p.player_id:'name:'+norm;
  if(!people.has(key))people.set(key,{norm,tokens:norm.split(' '),name:p.player_name,number:Number.isInteger(p.jersey_number)?p.jersey_number:null,
   score:0,starts:0,roles:new Map(),benchRoles:new Map()});
  return people.get(key);
 };
 const add=(m,role,w)=>{if(role)m.set(role,(m.get(role)||0)+w)};
 complete.forEach((f,index)=>{
  const formation=f.home_id===teamId?f.home_formation:f.away_formation,weight=Math.pow(.78,index);
  if(faLineupValidFormation(formation))forms.set(formation,(forms.get(formation)||0)+1);
  for(const p of starters.get(f.id)){
   const x=person(p);x.score+=weight;x.starts++;
   add(x.roles,faHistoricalRole(p.formation_field,formation,p.position_id),weight);
  }
 });
 games.forEach((f,index)=>{for(const p of bench.get(f.id))add(person(p).benchRoles,faHistoricalRole(null,null,p.position_id),Math.pow(.78,index))});
 const top=m=>[...m].sort((a,b)=>b[1]-a[1]||faLineupRoleRank(a[0])-faLineupRoleRank(b[0]))[0]?.[0]||null;
 const list=[...people.values()].map(x=>{const position=top(x.roles)||top(x.benchRoles);return {...x,position,is_goalkeeper:position==='Τερματοφύλακας'}})
  .sort((a,b)=>b.score-a.score||b.starts-a.starts||a.name.localeCompare(b.name));
 const regulars=list.filter(x=>x.starts>0);
 const common=[...forms].sort((a,b)=>b[1]-a[1]);
 const formation=common[0]?.[1]>=2?common[0][0]:null;
 const recentDate=faLineupDayMs(String(complete[0].starting_at).replace(' ','T')+'Z');
 const projectionReady=complete.length>=3&&regulars.length>=11&&recentDate!==null&&(at-recentDate)<FA_LU_FRESH_MS;
 let projected=null;
 const keeper=projectionReady?regulars.find(x=>x.is_goalkeeper):null;
 if(keeper){
  // Fill the usual formation's lines with the most frequent recent starters for each line, then top up by starts.
  const outfield=regulars.filter(x=>!x.is_goalkeeper),chosen=new Set();
  if(formation){
   const lines=formation.split('-').map(Number),need={D:lines[0],M:lines.slice(1,-1).reduce((a,b)=>a+b,0),F:lines.at(-1)};
   for(const x of outfield){const line=faLineupLine(x.position);if(need[line]>0){need[line]--;chosen.add(x)}}
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
 return {matches_observed:complete.length,formation,projected,positionFor,oldest:complete.at(-1).starting_at,
  newest:complete[0].starting_at,verified:false,source:'archived_previous_lineups'};
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
