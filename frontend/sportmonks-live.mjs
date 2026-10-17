/* Sportmonks live-only normalization. Provider inputs are untrusted; no inferred probabilities. */
const safeText=(value,n=100)=>typeof value==='string'?value.trim().slice(0,n):'';
const safeInt=value=>Number.isInteger(value)&&value>=0&&value<1e9?value:null;
function safePercent(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null}
export function normalizeLiveProbability(row){
 if(!row||typeof row!=='object')return null;
 const id=Number(row.fixture_id??row.fixture?.id);
 if(!Number.isSafeInteger(id)||id<=0)return null;
 if(row.type_id!=null&&Number(row.type_id)!==237)return null;
 const p=row.predictions??row.probabilities??row.value;
 if(!p||typeof p!=='object'||Array.isArray(p))return null;
 const h=safePercent(p.home),d=safePercent(p.draw),a=safePercent(p.away);
 if(h===null||d===null||a===null||Math.abs(h+d+a-100)>2)return null;
 return{fixture_id:id,p1:h,px:d,p2:a,minute:safeInt(row.minute),source:'sportmonks_live',market:'1x2'};
}
export function normalizeLiveDetails(row){
 const events=Array.isArray(row?.events)?row.events:[];
 const statistics=Array.isArray(row?.statistics)?row.statistics:[];
 const lineups=Array.isArray(row?.lineups)?row.lineups:[];
 return{
  minute:safeInt(row?.minute??row?.time?.minute??row?.periods?.[0]?.minutes),
  events:events.slice(-30).map(e=>{
   const minute=safeInt(e?.minute),extra_minute=safeInt(e?.extra_minute);
   const type=safeText(e?.type?.name??e?.type?.developer_name??e?.info??'',45);
   const player=safeText(e?.player_name,90);
   const related_player=safeText(e?.related_player_name,90);
   const team_id=Number.isSafeInteger(e?.team_id)?e.team_id:null;
   return{id:safeInt(e?.id),minute,extra_minute,type,player,related_player,team_id};
  }).filter(e=>e.minute!==null||e.type).sort((a,b)=>(a.minute??0)-(b.minute??0)),
  statistics:statistics.slice(0,80).map(s=>{
   const value=s?.data?.value;
   const number=typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=100000?value:null;
   const type=safeText(s?.type?.developer_name??s?.type?.name??'',45);
   return{type,value:number,participant_id:Number.isSafeInteger(s?.participant_id)?s.participant_id:null};
  }).filter(s=>s.type&&s.value!==null),
  lineups:lineups.filter(s=>s?.type_id===11).slice(0,22).map(s=>({
   player:safeText(s?.player_name,90),number:safeInt(s?.jersey_number),team_id:Number.isSafeInteger(s?.team_id)?s.team_id:null
  })).filter(s=>s.player)
 };
}
