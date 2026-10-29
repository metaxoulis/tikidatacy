/* Copy licensed archive crests into Tiki-Data storage; public routes never call Sportmonks. */
const ASSET_TYPES=new Set(['image/png','image/jpeg','image/webp']);
export function archivedTeamMatch(team,rows,identity,nameKey){
 const known=identity.get(team.id);
 if(known)return rows.find(r=>r.id===known)||null;
 const matches=rows.filter(r=>nameKey(r.name)===nameKey(team.name)&&(!team.country||String(r.country).toLowerCase()===team.country.toLowerCase()));
 return matches.length===1?matches[0]:null;
}
async function storedCrest(archive,path){
 if(typeof path!=='string')return null;
 const row=await archive.prepare('SELECT content_type,image FROM sm_images WHERE path=?1').bind(path).first();
 if(row?.image&&ASSET_TYPES.has(row.content_type))return {type:row.content_type,bytes:new Uint8Array(row.image),source:'sportmonks_local_archive'};
 const url=new URL(path);
 if(url.protocol!=='https:'||url.hostname!=='cdn.sportmonks.com'||url.search||!url.pathname.startsWith('/images/'))return null;
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000)}),type=r.headers.get('content-type')?.split(';')[0];
 if(!r.ok||!ASSET_TYPES.has(type))return null;
 const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}
 const valid=type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:
  type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(!valid)return null;
 await archive.prepare('INSERT OR IGNORE INTO sm_images(path,content_type,image) VALUES(?1,?2,?3)').bind(path,type,bytes.buffer).run();
 return {type,bytes,source:'sportmonks_cdn_saved_locally'};
}
async function crestHash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')}
export async function syncLocalSportmonksAssets(env){
 const archive=env.SPORTMONKS_ARCHIVE_DB,db=env.TIKI_DB;
 if(!archive||!db)return {status:'archive_binding_unavailable'};
 const [schedule,teamRows,leagueRows,existing,mapping,leagueExisting]=await Promise.all([
  faPrimaryScheduled(env),archive.prepare('SELECT id,name,country,image_path FROM sm_teams').all(),
  archive.prepare('SELECT id,name,country,image_path FROM sm_leagues').all(),
  db.prepare('SELECT fa_team_id FROM team_badges').all(),db.prepare('SELECT fa_team_id,sportmonks_team_id FROM fa_team_identity').all(),
  db.prepare('SELECT league_key FROM league_logos').all()
 ]);
 const teams=new Map(),competitions=new Map();
 for(const g of schedule.games){
  for(const side of ['home','away'])teams.set(g[side+'_id'],{id:g[side+'_id'],name:g[side],country:g.country||''});
  competitions.set(g.league_key,g);
 }
 const identity=new Map(mapping.results.map(r=>[r.fa_team_id,r.sportmonks_team_id])),badges=new Set(existing.results.map(r=>r.fa_team_id)),leagues=new Set(leagueExisting.results.map(r=>r.league_key));
 const report={status:schedule.partial?'partial':'ok',teams_saved:0,league_logos_saved:0,identities_added:0,unmatched_teams:[],missing_images:[]},stamp=new Date().toISOString();
 for(const team of teams.values()){
  const match=archivedTeamMatch(team,teamRows.results,identity,fhName);
  if(!match){if(!badges.has(team.id))report.unmatched_teams.push(team);continue;}
  if(!identity.has(team.id)){
   await db.prepare('INSERT OR IGNORE INTO fa_team_identity(fa_team_id,sportmonks_team_id,team_name,matched_by,updated_at) VALUES(?1,?2,?3,?4,?5)').bind(team.id,match.id,team.name,'unique_archived_name_and_country',stamp).run();report.identities_added++;
  }
  if(badges.has(team.id))continue;
  try{const image=await storedCrest(archive,match.image_path);if(!image){report.missing_images.push(team.name);continue;}
   await db.prepare('INSERT OR IGNORE INTO team_badges(fa_team_id,team_name,country,content_type,image,image_sha256,source,source_ref,matched_by,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)')
    .bind(team.id,team.name,team.country,image.type,image.bytes.buffer,await crestHash(image.bytes),image.source,'sportmonks:team:'+match.id,'verified_archive_identity',stamp).run();report.teams_saved++;
  }catch{report.missing_images.push(team.name)}
 }
 const leagueIds={epl:8,bundesliga:82,laliga:564,seriea:384,ligue1:301,greece:325,cyprus:253,ucl:2,uel:5,uecl:2286};
 for(const [key,game]of competitions){
  if(leagues.has(key))continue;
  const candidates=leagueRows.results.filter(r=>r.id===leagueIds[key]||fhName(r.name)===fhName(game.league.replace(/^UEFA\s+/g,''))&&(!game.country||r.country===game.country));
  if(candidates.length!==1){report.missing_images.push('league:'+key);continue;}
  try{const image=await storedCrest(archive,candidates[0].image_path);if(!image){report.missing_images.push('league:'+key);continue;}
   await db.prepare('INSERT OR IGNORE INTO league_logos(league_key,name,content_type,image,image_sha256,source,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7)').bind(key,game.league,image.type,image.bytes.buffer,await crestHash(image.bytes),image.source,stamp).run();report.league_logos_saved++;
  }catch{report.missing_images.push('league:'+key)}
 }
 if(typeof faBadgeCache!=='undefined')faBadgeCache.at=0;
 return report;
}
export async function localArchivedBadge(env,id){
 if(!/^[1-9]\d{0,13}$/.test(String(id))||!env.SPORTMONKS_ARCHIVE_DB)return new Response('Not Found',{status:404});
 const archive=env.SPORTMONKS_ARCHIVE_DB;
 const team=await archive.prepare('SELECT image_path FROM sm_teams WHERE id=?1').bind(Number(id)).first();
 const row=team?await archive.prepare('SELECT image,content_type FROM sm_images WHERE path=?1').bind(team.image_path).first():null;
 if(!row?.image||!ASSET_TYPES.has(row.content_type))return new Response('Not Found',{status:404});
 return new Response(new Uint8Array(row.image),{headers:{'Content-Type':row.content_type,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}});
}
