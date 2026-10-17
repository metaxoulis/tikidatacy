/* Licensed Sportmonks finished league results only. No provider raw JSON retained. */
const tdAllowedLeague=new Set(['epl','laliga','bundesliga','seriea','ligue1','greece','cyprus']);
const tdDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'));
function normalizeFinishedSportmonks(fixtures){
 const seen=new Set(),rows=[];
 for(const m of Array.isArray(fixtures)?fixtures:[]){
  const fixtureId=Number(String(m?.id??'').replace(/^sportmonks-/,''));
  if(!Number.isSafeInteger(fixtureId)||fixtureId<1||!tdAllowedLeague.has(m.league_key)||
    !['FT','FINISHED','FULL_TIME'].includes(String(m.status||'').toUpperCase())||
    typeof m.home!=='string'||typeof m.away!=='string'||!m.home.trim()||!m.away.trim()||m.home===m.away)continue;
  const day=String(m.date||'').slice(0,10);
  if(!tdDay(day)||seen.has(fixtureId))continue;
  const scores=Array.isArray(m.scores)?m.scores:[];
  let result=null;
  for(const desc of ['2ND_HALF','FT','FULL_TIME','CURRENT']){
   const subset=scores.filter(s=>String(s?.description||'').toUpperCase()===desc);
   const h=subset.find(s=>s?.score?.participant==='home')?.score?.goals;
   const a=subset.find(s=>s?.score?.participant==='away')?.score?.goals;
   if(Number.isInteger(h)&&Number.isInteger(a)&&h>=0&&a>=0&&h<=15&&a<=15){
    result={home:h,away:a};break;
   }
  }
  if(!result)continue;
  const start=Number(day.slice(0,4))-(Number(day.slice(5,7))<7?1:0),end=String((start+1)%100).padStart(2,'0');
  rows.push({fixture_id:fixtureId,league_key:m.league_key,dataset_slug:m.league_key+'-'+start+'-'+end,
   match_date:day,home_team:m.home.trim().slice(0,105),away_team:m.away.trim().slice(0,105),
   home_score:result.home,away_score:result.away,match_status:'FINISHED',
   source_provider:'sportmonks'});
  seen.add(fixtureId);
 }
 return rows;
}
export {normalizeFinishedSportmonks};
