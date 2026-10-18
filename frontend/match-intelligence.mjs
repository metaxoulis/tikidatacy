/* Match intelligence v1: normalize only verified Sportmonks values.
 * Missing xG / lineups / metadata remain missing: never infer confirmation.
 */
const smInt=v=>Number.isSafeInteger(v)&&v>0?v:null;
const smLabel=(v,n=95)=>typeof v==='string'?v.trim().slice(0,n):'';
const smFinite=v=>{const x=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN;return Number.isFinite(x)&&x>=0&&x<=1000?x:null};
const smArray=v=>Array.isArray(v)?v:[];
function expectedXg(rows,id,side,player=false){
 return smArray(rows).filter(x=>x&&x.fixture_id===id&&x.type_id===5304).flatMap(x=>{
  const val=smFinite(x.data?.value??x.value);
  if(val===null)return[];
  return [{fixture_id:id,team_id:smInt(x.participant_id??x.team_id),player_id:player?smInt(x.player_id):null,
   location:['home','away'].includes(x.location)?x.location:null,xg:Number(val.toFixed(3))}];
 }).slice(0,120);
}
function normalizedPlayers(rows,id,homeId,awayId,type){
 const out={home:{starters:[],bench:[]},away:{starters:[],bench:[]}},ids=new Set();
 for(const x of smArray(rows).slice(0,120)){
  const fid=smInt(x?.fixture_id);if(fid!==null&&fid!==id)continue;
  const team=x?.team_id===homeId?'home':x?.team_id===awayId?'away':null;
  if(!team)continue;
  const typeId=Number(x?.type_id);
  const start=type==='predicted'?typeId===77614:typeId===11;
  const bench=type==='predicted'?typeId===77615:typeId===12;
  if(!start&&!bench)continue;
  const playerId=smInt(x.player_id),name=smLabel(x.player_name??x.player?.name,85);
  if(!name)continue;
  const key=team+'|'+(playerId||name);if(ids.has(key))continue;ids.add(key);
  const n=x.jersey_number==null?NaN:Number(x.jersey_number),order=x.formation_position==null?NaN:Number(x.formation_position);
  const expected=smArray(x.expected??x.xglineup??x.xGLineup);
  const px=expectedXg(expected,id,'',true).find(v=>v.player_id===playerId);
  const person={id:playerId,name,number:Number.isInteger(n)&&n>=0&&n<=99?n:null,
   position:smLabel(x.formation_field,15)||null,order:Number.isInteger(order)&&order>=0&&order<=50?order:null,
   xg:px?.xg??null};
  const a=start?out[team].starters:out[team].bench;
  if(a.length<20)a.push(person);
 }
 for(const side of ['home','away'])for(const k of ['starters','bench'])out[side][k].sort((a,b)=>(a.order??50)-(b.order??50)||a.name.localeCompare(b.name));
 return out;
}
function lineupConfirmed(metadata){
 for(const m of smArray(metadata)){
  if(m?.type_id!==572&&m?.type?.code!=='lineup-confirmed'&&m?.type?.developer_name!=='LINEUP_CONFIRMED')continue;
  const v=m.values?.confirmed??m.value?.confirmed??m.values;
  if(v===true||v===false)return v;
 }
 return null;
}
function normalizeMatchIntelligence(raw,additional={},verified={}){
 const id=smInt(raw?.id);
 if(!id||raw.sport_id!==1)return null;
 const h=smInt(verified.home_id),a=smInt(verified.away_id);
 if(!h||!a||h===a)return null;
 const meta=smArray(raw.metadata),confirmed=lineupConfirmed(meta);
 const actual=normalizedPlayers(raw.lineups,id,h,a,'official');
 const predictedRaw=smArray(raw.expectedlineups??raw.expectedLineups);
 const prediction=normalizedPlayers(predictedRaw.length?predictedRaw:raw.lineups,id,h,a,'predicted');
 const hasActual=actual.home.starters.length+actual.away.starters.length>0;
 const hasPrediction=prediction.home.starters.length+prediction.away.starters.length>0;
 const displayed=hasActual?actual:prediction;
 const kind=hasActual?(confirmed===true?'confirmed':confirmed===false?'predicted_by_provider':'unconfirmed'):
   hasPrediction?'predicted_by_provider':'unavailable';
 const fxg=expectedXg([...smArray(raw.expected),...smArray(raw.xgfixture),...smArray(raw.xGFixture),...smArray(additional.team)],id);
 const lineXg=expectedXg(additional.players,id,'',true);
 const playerNames=new Map([...smArray(raw.lineups),...predictedRaw].filter(x=>smInt(x?.player_id)&&smLabel(x.player_name)).map(x=>[x.player_id,smLabel(x.player_name,80)]));
 const identifiedPlayers=lineXg.map(x=>({...x,player_name:playerNames.get(x.player_id)||null}));
 const teamXg={home:null,away:null};
 for(const x of fxg){const team=x.location||(x.team_id===h?'home':x.team_id===a?'away':null);
  if(team&&(team==='home'||team==='away'))teamXg[team]=x.xg;}
 const stats=smArray(raw.statistics).flatMap(st=>{
  const side=st?.participant_id===h?'home':st?.participant_id===a?'away':null;
  const label=smLabel(st?.type?.name??st?.type?.code,62);
  const v=st?.data?.value??st?.value;
  const value=typeof v==='number'||typeof v==='string'?String(v).slice(0,26):null;
  return side&&label&&value!==null?[{type:label,side,value}]:[];
 }).slice(0,100);
 const forms={home:null,away:null};
 for(const f of smArray(raw.formations)){const side=f?.participant_id===h?'home':f?.participant_id===a?'away':null;
  if(side){const v=smLabel(f.formation??f.name,20);if(v)forms[side]=v;}}
 const venue=smLabel(raw.venue?.name,90)||null;
 return {source:'sportmonks',fixture_id:id,verified:true,confirmed_lineup:confirmed,
  lineup_status:kind,lineups:displayed,actual_lineups_available:hasActual,predicted_lineups_available:hasPrediction,
  formations:forms,xg:{home:teamXg.home,away:teamXg.away,source:'sportmonks_expected',available:teamXg.home!==null||teamXg.away!==null},
  player_xg:identifiedPlayers,statistics:stats,venue,updated_at:new Date().toISOString(),
  disclosures:{lineups:kind==='predicted_by_provider'?'Provider projected XI; not confirmed official lineups.':
    confirmed===null?'Lineup confirmation unavailable from provider metadata.':null,
   xg:'Provider xG refers to chances already created. It is not a pre-match goal forecast.'}};
}
export {expectedXg,lineupConfirmed,normalizedPlayers,normalizeMatchIntelligence};
