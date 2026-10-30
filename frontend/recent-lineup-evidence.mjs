/* Read-only projection and role estimates using *past* Sportmonks lineups only.
 * Football-API player IDs are never compared to Sportmonks player IDs.
 * Never present a historical position as an official current-game position.
 */
const FA_LU_HALF_YEAR_MS=185*86400000;
const FA_LU_MAX_LOOKBACK_MS=450*86400000;
const FA_LU_MAX_GAMES=8;
const faLineupDayMs=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:null};
export function faLineupName(v){
 return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
export function faHistoricalRole(field){
 const lane=/^([1-5]):[1-5]$/.exec(String(field||''));if(!lane)return null;
 return {1:'Τερματοφύλακας',2:'Αμυντικός',3:'Μέσος',4:'Μεσοεπιθετικός',5:'Επιθετικός'}[Number(lane[1])]||null;
}
export function faHistorySeasonStart(kickoff){
 const d=new Date(kickoff);
 if(!Number.isFinite(d.getTime()))return null;
 const y=d.getUTCFullYear()-(d.getUTCMonth()<6?1:0);
 return Date.UTC(y-1,6,1);
}
const faLineupValidFormation=v=>typeof v==='string'&&/^([1-5]-){1,4}[1-5]$/.test(v)&&v.split('-').map(Number).reduce((a,b)=>a+b,0)===10;
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
  const rs=await db.prepare("SELECT fixture_id,team_id,player_id,player_name,jersey_number,role,formation_field,formation_position FROM sm_lineups WHERE team_id=?1 AND fixture_id IN ("+placeholders+") AND role='lineup'").bind(teamId,...ids).all();
  return faAnalyzeLineupEvidence(fixtures,(rs.results||[]),teamId,kickoff);
 }catch{return null}
}
export function faAnalyzeLineupEvidence(fixtures,players,teamId,kickoff){
 const at=faLineupDayMs(kickoff);if(at===null)return null;
 const byMatch=new Map(),games=(fixtures||[]).filter(f=>Number.isSafeInteger(f?.id)&&f.home_id===teamId||Number.isSafeInteger(f?.id)&&f.away_id===teamId)
  .sort((a,b)=>String(b.starting_at).localeCompare(String(a.starting_at))).slice(0,FA_LU_MAX_GAMES);
 const validGames=games.filter(f=>{const time=faLineupDayMs(String(f.starting_at).replace(' ','T')+'Z');return time!==null&&time<at-3*86400000&&time>=Math.max(faHistorySeasonStart(kickoff),at-FA_LU_MAX_LOOKBACK_MS)});
 for(const f of validGames)byMatch.set(f.id,[]);
 for(const p of players||[])if(byMatch.has(p.fixture_id)&&p.team_id===teamId&&p.role==='lineup'&&typeof p.player_name==='string'&&faLineupName(p.player_name)){
  const rows=byMatch.get(p.fixture_id);
  if(!rows.some(old=>old.player_id===p.player_id&&old.player_name===p.player_name))rows.push(p);
 }
 const complete=validGames.filter(f=>byMatch.get(f.id).length>=10&&byMatch.get(f.id).length<=12);
 if(!complete.length)return null;
 const scores=new Map(),names=new Map(),last=new Map(),roles=new Map();
 const forms=new Map();
 complete.forEach((f,index)=>{
  const formation=f.home_id===teamId?f.home_formation:f.away_formation;
  if(faLineupValidFormation(formation))forms.set(formation,(forms.get(formation)||0)+1);
  const seen=new Set(),weight=Math.pow(.78,index);
  for(const p of byMatch.get(f.id)){
   const key=faLineupName(p.player_name);
   if(seen.has(key))continue;seen.add(key);
   if(!names.has(key))names.set(key,new Set());
   if(p.player_id)names.get(key).add(p.player_id);
   if(!last.has(key))last.set(key,p);
   scores.set(key,(scores.get(key)||0)+weight);
   const role=faHistoricalRole(p.formation_field);
   if(role){if(!roles.has(key))roles.set(key,new Map());const rs=roles.get(key);rs.set(role,(rs.get(role)||0)+weight)}
  }
 });
 const people=[...scores].filter(([key])=>names.get(key)?.size<=1).map(([key,score])=>{
  const p=last.get(key),roleScores=[...(roles.get(key)||new Map()).entries()].sort((a,b)=>b[1]-a[1]);
  return {name:p.player_name,number:Number.isInteger(p.jersey_number)?p.jersey_number:null,
   position:roleScores[0]?.[0]||null,position_source:roleScores.length?'recent_historical_lineups':null,
   is_goalkeeper:roleScores[0]?.[0]==='Τερματοφύλακας',score,
   starts:complete.filter(f=>byMatch.get(f.id).some(v=>faLineupName(v.player_name)===key)).length,
   historical_player_id:p.player_id||null, last_date:complete.find(f=>byMatch.get(f.id).includes(p))?.starting_at||null};
 }).sort((a,b)=>b.score-a.score||b.starts-a.starts||a.name.localeCompare(b.name));
 const recentDate=faLineupDayMs(String(complete[0].starting_at).replace(' ','T')+'Z');
 const projectionReady=complete.length>=3&&people.length>=11&&recentDate!==null&&(at-recentDate)<FA_LU_HALF_YEAR_MS;
 let projected=null;
 if(projectionReady){
  const keeper=people.find(p=>p.is_goalkeeper);
  if(keeper){
   const chosen=[keeper,...people.filter(p=>p!==keeper).slice(0,10)];
   if(chosen.length===11)projected=chosen.map(({historical_player_id,score,starts,last_date,...p})=>({...p,id:null,order:null,role:p.position,source:'recent_historical_projection'}));
  }
 }
 const common=[...forms].sort((a,b)=>b[1]-a[1]);
 const formation=common[0]?.[1]>=2?common[0][0]:null;
 // Team + normalized name + unique historical player ID, never cross-provider numeric player IDs.
 function positionFor(currentName){
  const k=faLineupName(currentName),ids=names.get(k),p=people.find(v=>faLineupName(v.name)===k);
  return ids?.size===1&&p?.position?{position:p.position,position_source:'recent_historical_lineups',is_goalkeeper:p.is_goalkeeper}:null;
 }
 return {matches_observed:complete.length,formation,projected,positionFor,oldest:complete.at(-1).starting_at,
  newest:complete[0].starting_at,verified:false,source:'archived_previous_lineups'};
}
export function faEnrichProviderLineups(data,evidence){
 const side=key=>{
  const source=data?.[key]||{starters:[],bench:[]};
  const annotate=p=>{const pos=evidence?.[key]?.positionFor(p.name);return {...p,...(pos||{})}};
  const announced=source.starters?.length>0;
  return {starters:announced?source.starters.map(annotate):evidence?.[key]?.projected||[],
   bench:announced?(source.bench||[]).map(annotate):[],
   source:announced?'football_api_announced_unverified':evidence?.[key]?.projected?'recent_historical_projection':'unavailable'};
 };
 return {home:side('home'),away:side('away')};
}
