/* Private, resumable, lossless JSON snapshots. No model or public feed writes. */
export const SM_ARCHIVE_TASKS=[
 ['resources','/v3/my/resources'],['enrichments','/v3/my/enrichments'],['my-leagues','/v3/my/leagues'],
 ['types','/v3/core/types'],['countries','/v3/core/countries'],['continents','/v3/core/continents'],['regions','/v3/core/regions'],['cities','/v3/core/cities'],
 ['leagues','/v3/football/leagues',{include:'country;seasons'}],['seasons','/v3/football/seasons'],
 ['teams','/v3/football/teams',{include:'country;venue'}],['players','/v3/football/players',{include:'nationality;country;position;detailedPosition'}],
 ['coaches','/v3/football/coaches'],['referees','/v3/football/referees'],['venues','/v3/football/venues'],['states','/v3/football/states'],
 ['stages','/v3/football/stages'],['rounds','/v3/football/rounds'],['standings','/v3/football/standings',{include:'details;form;participant'}],
 ['tv-stations','/v3/football/tv-stations'],['rivals','/v3/football/rivals'],['transfers','/v3/football/transfers'],
 ['news-pre','/v3/football/news/pre-match'],['news-post','/v3/football/news/post-match'],
 ['fixtures-core','/v3/football/fixtures',{include:'participants;league;season;stage;round;group;aggregate;venue;state;scores',per_page:50}],
 ['fixtures-detail','/v3/football/fixtures',{include:'events;statistics.type;lineups.details.type;formations;coaches;referees;periods;weatherReport;metadata',per_page:20}],
 ['fixtures-extra','/v3/football/fixtures',{include:'xGFixture;pressure;comments;trends;timeline;ballCoordinates;sidelined;expectedLineups;predictions;prematchNews;postmatchNews',per_page:50}],
 ['xg-teams','/v3/football/expected/fixtures'],['xg-players','/v3/football/expected/lineups'],
 ['predictions','/v3/football/predictions/probabilities'],['value-bets','/v3/football/predictions/value-bets'],
 ['commentaries','/v3/football/commentaries'],['odds-markets','/v3/odds/markets'],['odds-bookmakers','/v3/odds/bookmakers'],
 ['odds-prematch','/v3/football/odds/pre-match'],['odds-inplay','/v3/football/odds/inplay'],
 ['odds-premium','/v3/football/odds/premium'],['odds-history','/v3/football/odds/premium/history'],
 ['match-facts','/v3/football/match-facts'],['team-rankings','/v3/football/team-rankings'],['live-predictions','/v3/football/predictions/live/probabilities'],
 ['premium-markets','/v3/odds/premium/markets'],['premium-bookmakers','/v3/odds/premium/bookmakers']
];
export function archiveSafeJSON(payload,token){
 // Pagination URLs may include credentials. Keep every data field and redact only secrets.
 return JSON.stringify(payload).replaceAll(token,'REDACTED').replace(/([?&]api_token=)[^&"\s]+/g,'$1REDACTED');
}
async function archiveRead(response){
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
  if(size>12*1024*1024){await reader.cancel();throw Error('payload_exceeds_12MiB')}
  chunks.push(value);
 }}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 return JSON.parse(new TextDecoder().decode(bytes));
}
async function archiveFetch(path,params,token){
 let url=new URL('https://api.sportmonks.com'+path);
 for(const [k,v]of Object.entries(params))url.searchParams.set(k,String(v));
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(url,{headers:{Authorization:token,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(20000)});
  if([301,302,303,307,308].includes(response.status)){
   const next=new URL(response.headers.get('location'),url);
   if(next.hostname!=='api.sportmonks.com'||next.protocol!=='https:')throw Error('unapproved_redirect');
   url=next;continue;
  }
  let payload;try{payload=await archiveRead(response)}catch(e){if(response.ok)throw e;payload={message:'non_json_http_'+response.status}}
  return {status:response.status,payload};
 }
 throw Error('redirect_loop');
}
async function archiveSummary(db){
 const tasks=(await db.prepare('SELECT task,path,page,status,records,pages,gzip_bytes,last_error,updated_at FROM archive_tasks ORDER BY rowid').all()).results;
 return {complete:tasks.length>0&&tasks.every(t=>t.status==='complete'),tasks,
  totals:tasks.reduce((n,t)=>({pages:n.pages+t.pages,records:n.records+t.records,gzip_bytes:n.gzip_bytes+t.gzip_bytes}),{pages:0,records:0,gzip_bytes:0})};
}
export async function sportmonksArchive(req,env){
 const db=env.SPORTMONKS_RAW_0;
 if(!db||!env.SPORTMONKS_API_TOKEN)return Response.json({error:'archive_not_configured'},{status:503});
 const input=await req.json();
 if(input.action==='init'){
  await db.prepare("DELETE FROM archive_state WHERE key='terminal_status'").run();
  await db.batch(SM_ARCHIVE_TASKS.map(([task,path,params={}],priority)=>db.prepare('INSERT OR IGNORE INTO archive_tasks(task,path,params_json,priority) VALUES(?1,?2,?3,?4)').bind(task,path,JSON.stringify({per_page:50,...params}),task.startsWith('fixtures-')?-10+priority:priority)));
  return Response.json(await archiveSummary(db));
 }
 if(input.action==='status')return Response.json(await archiveSummary(db));
 if(input.action!=='step')return Response.json({error:'invalid_action'},{status:400});
 const terminal=await db.prepare("SELECT value FROM archive_state WHERE key='terminal_status'").first();
 if(terminal)return Response.json(JSON.parse(terminal.value));
 const budgetKey='reserved-pages:'+new Date().toISOString().slice(0,10);
 const used=await db.prepare('SELECT value FROM archive_state WHERE key=?1').bind(budgetKey).first();
 if(Number(used?.value||0)>=15000)return Response.json({paused:'daily_archive_budget',resumes:'next UTC day'});
 const now=Date.now();
 let task;
 for(const state of ['running','retry'])if(!task)task=await db.prepare('SELECT * FROM archive_tasks WHERE status=?1 AND lease_until<?2 ORDER BY lease_until LIMIT 1').bind(state,now).first();
 if(!task)task=await db.prepare("SELECT * FROM archive_tasks WHERE status='pending' ORDER BY priority,task LIMIT 1").first();
 if(!task){
  const summary=await archiveSummary(db);
  if(summary.tasks.every(t=>['complete','blocked'].includes(t.status)))await db.prepare("INSERT INTO archive_state(key,value) VALUES('terminal_status',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(summary)).run();
  return Response.json(summary);
 }
 const lease=await db.prepare("UPDATE archive_tasks SET status='running',lease_until=?1 WHERE task=?2 AND lease_until<?3").bind(now+180000,task.task,now).run();
 if(!lease.meta.changes)return Response.json({busy:true});
 const batchSize=task.task==='seasons'?1:Math.min(6,Math.max(1,Number(input.pages)||6)),params=JSON.parse(task.params_json),out=[];
 const reservation=await db.prepare('INSERT INTO archive_state(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+?2 WHERE CAST(value AS INTEGER)<=15000-?2 RETURNING value').bind(budgetKey,batchSize).first();
 if(!reservation){
  await db.prepare("UPDATE archive_tasks SET status='pending',lease_until=0 WHERE task=?1").bind(task.task).run();
  return Response.json({paused:'daily_archive_budget',resumes:'next UTC day',task:task.task});
 }

 // Two requests in flight; retain compressed pages only to bound memory during rich lineup exports.
 for(let start=0;start<batchSize;start+=2){
  const results=await Promise.all(Array.from({length:Math.min(2,batchSize-start)},async(_,i)=>{
   const page=task.page+start+i;
   try{
    const result=await archiveFetch(task.path,{...params,page},env.SPORTMONKS_API_TOKEN);
    if(result.status!==200)return {page,...result};
    if(result.payload?.data===undefined)return {page,status:422,payload:{message:'missing_data_field'}};
    const raw=archiveSafeJSON(result.payload,env.SPORTMONKS_API_TOKEN),encoded=new TextEncoder().encode(raw);
    const count=Array.isArray(result.payload.data)?result.payload.data.length:1;
    const pagination=result.payload.pagination;
    const children=task.task==='seasons'&&Array.isArray(result.payload.data)?result.payload.data.flatMap(s=>Number.isSafeInteger(s.id)?[
     ['topscorers-season-'+s.id,'/v3/football/topscorers/seasons/'+s.id],
     ['schedule-season-'+s.id,'/v3/football/schedules/seasons/'+s.id],
     ['standings-season-'+s.id,'/v3/football/standings/seasons/'+s.id]
    ]:[]):[];
    result.payload=null;
    const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const gzip=await new Response(new Blob([encoded]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    return {page,status:200,payload:{pagination},count,raw_bytes:encoded.length,sha,gzip,children};
   }
   catch(e){return {page,status:0,error:String(e.message).replaceAll(env.SPORTMONKS_API_TOKEN,'REDACTED')}}
  }));out.push(...results);
  if(results.some(r=>r.status!==200||r.payload?.pagination?.has_more!==true))break;
 }
 let next=task.page,status='pending',error=null,records=0,pages=0,bytes=0;
 let shard=Number((await db.prepare("SELECT value FROM archive_state WHERE key='shard'").first())?.value||0);
 for(const result of out.sort((a,b)=>a.page-b.page)){
  if(result.page!==next)break;
  if(result.status!==200){status=[401,403,404,422].includes(result.status)?'blocked':'retry';error=JSON.stringify({http:result.status,message:result.payload?.message||result.error||'provider_error'}).slice(0,1000);break;}
  const {gzip,sha,count,raw_bytes}=result;
  const target=env['SPORTMONKS_RAW_'+shard];
  if(!target){status='blocked';error='archive_storage_shards_full';break;}
  const saved=await target.prepare('INSERT OR IGNORE INTO archive_pages(task,page,request_path,params_json,payload_gzip,sha256,records,raw_bytes,gzip_bytes,fetched_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)')
   .bind(task.task,result.page,task.path,JSON.stringify({...params,page:result.page}),gzip,sha,count,raw_bytes,gzip.byteLength,new Date().toISOString()).run();
  const children=result.children||[];
  for(let i=0;i<children.length;i+=25){const batch=children.slice(i,i+25);
   await db.prepare('INSERT OR IGNORE INTO archive_tasks(task,path,params_json,priority) VALUES'+batch.map(()=>'(?,?,?,?)').join(','))
    .bind(...batch.flatMap(([name,path])=>[name,path,'{"per_page":50}',200])).run();
  }
  records+=count;pages++;bytes+=gzip.byteLength;next++;
  if(saved.meta.size_after>400*1024*1024){shard++;await db.prepare("INSERT INTO archive_state VALUES('shard',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(shard)).run();}
  if(result.payload?.pagination?.has_more!==true){status='complete';break;}
 }
 await db.prepare('UPDATE archive_tasks SET page=?1,status=?2,records=records+?3,pages=pages+?4,gzip_bytes=gzip_bytes+?5,last_error=?6,updated_at=?7,lease_until=?8 WHERE task=?9')
  .bind(next,status,records,pages,bytes,error,new Date().toISOString(),status==='retry'?Date.now()+120000:0,task.task).run();
 return Response.json({task:task.task,status,next_page:next,records,pages,gzip_bytes:bytes,error});
}
