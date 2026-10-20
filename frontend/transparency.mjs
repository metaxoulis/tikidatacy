/* Fixture-led audit. No training, result-table scans or retrospective forecasts. */
const AUDIT_START='2026-10-18';
const AUDIT_LEAGUES={8:'epl',564:'laliga',82:'bundesliga',384:'seriea',301:'ligue1',325:'greece',253:'cyprus',2:'ucl',5:'uel',2286:'uecl'};
function auditLocalDay(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Nicosia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
function auditVerdict(m){
 const p=m.probabilities,valid=Array.isArray(p)&&p.length===3&&p.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1)&&Math.abs(p.reduce((a,b)=>a+b,0)-1)<0.01;
 const top=valid?Math.max(...p):null,pick=valid?p.indexOf(top):-1;
 const final=m.final===true&&Number.isInteger(m.home_score)&&Number.isInteger(m.away_score);
 const actual=final?(m.home_score>m.away_score?0:m.home_score===m.away_score?1:2):-1;
 return {pick:pick<0?'—':['1','Χ','2'][pick],confidence:top===null?null:top*100,status:valid&&final&&p.filter(x=>x===top).length===1?(pick===actual?'hit':'miss'):'pending'};
}
async function tdTransparency(req,env,ctx){
 if(req.method!=='GET')return smResponse({error:'method_not_allowed'},405);
 const q=new URL(req.url).searchParams,today=auditLocalDay(Date.now());
 // Traverse every published fixture in the current season, including future rounds.
 const year=Number(today.slice(0,4))+(Number(today.slice(5,7))>=7?1:0);
 const horizon=q.get('end')||year+'-06-30',start=q.get('start')||AUDIT_START;
 if(!smIsoDay(horizon)||horizon>smAddDay(today,370)||horizon<AUDIT_START)return smResponse({error:'invalid_end'},400);
 if(!smIsoDay(start)||start<AUDIT_START||start>horizon)return smResponse({error:'invalid_start'},400);
 const end=[smAddDay(start,27),horizon].sort()[0],next=end<horizon?smAddDay(end,1):null;
 const key='tiki:transparency:v2:'+start+':'+end,kv=env.MATCHIQ_CACHE;
 let cached;try{cached=await kv?.get(key,'json')}catch{}
 if(cached&&Date.now()-Date.parse(cached.updated_at)<300000)return smResponse(cached,200,60);
 try{
  const raw=await smPages('fixtures/between/'+smAddDay(start,-1)+'/'+end,env.SPORTMONKS_API_TOKEN,fetch,{params:{include:'participants;league.country;state;scores',filters:'fixtureLeagues:'+Object.keys(AUDIT_LEAGUES).join(',')},maxPages:20});
  const matches=new Map();let forecastUnavailable=false;
  const keys=[...new Set(raw.filter(r=>AUDIT_LEAGUES[r.league_id]).map(r=>'sportmonks-'+r.id+':'+new Date(String(r.starting_at).replace(' ','T')+'Z').toISOString()))];
  const logsKey='tiki:audit-logs:v2:'+start+':'+end;
  let saved;try{saved=await kv?.get(logsKey,'json')}catch{}
  if(!saved){
   const logs=[];
   try{
    if(!kv||!env.TIKI_DB)throw Error('storage_unavailable');
    for(let i=0;i<keys.length;i+=80){
     const batch=keys.slice(i,i+80);
     const result=await env.TIKI_DB.prepare('SELECT id,fixture_key,created_at,model_version,ph,pd,pa FROM prospective_forecast_log WHERE fixture_key IN ('+batch.map(()=>'?').join(',')+') LIMIT 10001').bind(...batch).all();
     if(result.results.length>10000)throw Error('forecast_archive_incomplete');logs.push(...result.results);
    }
    saved={logs};await kv.put(logsKey,JSON.stringify(saved),{expirationTtl:21600});
   }catch{forecastUnavailable=true;saved={logs:[]};}
  }
  const byFixture=new Map();
  for(const log of saved.logs){
   const kickoff=log.fixture_key.slice(log.fixture_key.indexOf(':')+1),stamp=Date.parse(log.created_at.replace(' ','T')+'Z');
   const previous=byFixture.get(log.fixture_key);
   if(stamp<Date.parse(kickoff)&&(!previous||stamp>Date.parse(previous.created_at.replace(' ','T')+'Z')||stamp===Date.parse(previous.created_at.replace(' ','T')+'Z')&&log.id>previous.id))byFixture.set(log.fixture_key,log);
  }
  for(const row of raw){
   const leagueKey=AUDIT_LEAGUES[row.league_id];if(!leagueKey)continue;
   const m=smNormalizeFixture(row,new Map([[row.league_id,{key:leagueKey,name:FH_LEAGUES[leagueKey].name,country:row.league?.country?.name||'',image_path:row.league?.image_path}]]));
   if(!m||auditLocalDay(m.date)<start||auditLocalDay(m.date)>end)continue;
   const log=byFixture.get(m.id+':'+m.date),score=smPublishedScore(row),regular=(row.scores||[]).filter(s=>['2ND_HALF','FT','FULL_TIME'].includes(String(s.description).toUpperCase()));
   const regulation=smPublishedScore({scores:regular});
   const final=['FT','FULL_TIME','FINISHED','AET','FT_PEN','PEN'].includes(m.status);
   const finalScore=regulation.home!==null?regulation:m.status==='FT'?score:{home:null,away:null};
   matches.set(m.id,{fixture_id:m.id,home:m.home,away:m.away,league:m.league,league_key:m.league_key,kickoff:m.date,status:m.status,final,
    home_score:final?finalScore.home:score.home,away_score:final?finalScore.away:score.away,home_logo:m.logos.home,away_logo:m.logos.away,league_logo:m.league_logo,
    probabilities:log?[log.ph,log.pd,log.pa]:null,captured_at:log?log.created_at.replace(' ','T')+'Z':null,model_version:log?.model_version||null,log_id:log?.id||null,
    prediction_status:log?'recorded':forecastUnavailable?'unavailable':'pending'});
  }
  const payload={start,end,horizon,next,timezone:'Asia/Nicosia',updated_at:new Date().toISOString(),partial:forecastUnavailable,matches:[...matches.values()].sort((a,b)=>a.kickoff.localeCompare(b.kickoff))};
  if(kv)await kv.put(key,JSON.stringify(payload),{expirationTtl:604800});
  return smResponse(payload,200,60);
 }catch{
  if(cached)return smResponse({...cached,stale:true,partial:true,next},200,30);
  return smResponse({error:'transparency_unavailable',start,end,next,matches:[],partial:true},503,0);
 }
}
export {auditLocalDay,auditVerdict,tdTransparency};
