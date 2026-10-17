/* Trusted Sportmonks historical football ingestion: bounded calendar windows.
 * Source rows are only retained as normalized, verified final results.
 */
const VALID_DAY=/^\d{4}-\d{2}-\d{2}$/;
export function batchDay(s){
 if(typeof s!=='string'||!VALID_DAY.test(s))return null;
 const ms=Date.parse(s+'T00:00:00Z');
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===s?s:null;
}
export function addBatchDays(day,shift){
 if(!batchDay(day)||!Number.isInteger(shift)||Math.abs(shift)>3650)return null;
 return new Date(Date.parse(day+'T00:00:00Z')+shift*86400000).toISOString().slice(0,10);
}
export function historyBatchWindow(cursor,latest,days=28){
 if(!batchDay(cursor)||!batchDay(latest)||cursor>latest||!Number.isInteger(days)||days<1||days>100)return null;
 const end=addBatchDays(cursor,days-1),bounded=end>latest?latest:end;
 return {start:cursor,end:bounded,next:addBatchDays(bounded,1),days:Math.round((Date.parse(bounded)-Date.parse(cursor))/86400000)+1};
}
const leagueKeys=new Set(['epl','laliga','bundesliga','seriea','ligue1','greece','cyprus']);
export function normalizedHistoricRow(match){
 if(!match||match.source!=='sportmonks'||match.final!==true||!leagueKeys.has(match.league_key))return null;
 const id=Number(String(match.id||'').replace(/^sportmonks-/,''));
 const date=String(match.date||'').slice(0,10);
 const h=match.home_score,a=match.away_score;
 if(!Number.isSafeInteger(id)||id<=0||!batchDay(date)||!Number.isInteger(h)||!Number.isInteger(a)||
 h<0||a<0||h>15||a>15||typeof match.home!=='string'||typeof match.away!=='string'||
 !match.home.trim()||!match.away.trim()||match.home.trim()===match.away.trim())return null;
 const year=Number(date.slice(0,4))-(Number(date.slice(5,7))<7?1:0),next=String((year+1)%100).padStart(2,'0');
 return {fixture_id:id,dataset_slug:match.league_key+'-'+year+'-'+next,league_key:match.league_key,
 match_date:date,home_team:match.home.trim().slice(0,105),away_team:match.away.trim().slice(0,105),
 home_score:h,away_score:a,source_provider:'sportmonks'};
}
export function filterCompletedHistoricalRows(rows,normalize){
 if(!Array.isArray(rows)||typeof normalize!=='function')return [];
 const seen=new Set(),out=[];
 for(const row of rows){
  const state=String(row?.state?.short_name??row?.state?.state??row?.state?.name??'').toUpperCase();
  // Extra-time / penalty kick scores are not standard 90-minute results.
  if(!['FT','FINISHED','FULL_TIME'].includes(state))continue;
  const normalized=normalizedHistoricRow(normalize(row));
  if(!normalized||seen.has(normalized.fixture_id))continue;
  seen.add(normalized.fixture_id);out.push(normalized);
 }
 return out;
}
