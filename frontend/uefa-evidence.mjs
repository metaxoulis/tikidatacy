/* Verified UEFA match evidence. Store normalized licensed statistics, never raw provider responses.
 * No missing field is inferred or replaced by a league average.
 */
export const UEFA_LEAGUE_IDS=Object.freeze({ucl:2,uel:5,uecl:2286});
const uFinite=(value,max)=>{const n=typeof value==='string'?Number(value.trim().replace(/%$/,'')):value;return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max?n:null;};
const uLocation=(r,h,a)=>{
 const l=String(r?.location||'').toLowerCase();
 if(l==='home'||l==='away')return l;
 return Number(r?.participant_id)===h?'home':Number(r?.participant_id)===a?'away':null;
};
export function normalizedUefaEvidence(raw,result,observedAt){
 if(!raw||!result||!['ucl','uel','uecl'].includes(result.league_key)||
   Number(raw.league_id)!==UEFA_LEAGUE_IDS[result.league_key])return null;
 const sides=Array.isArray(raw.participants)?raw.participants:[];
 const hs=sides.find(x=>String(x?.meta?.location??'').toLowerCase()==='home');
 const as=sides.find(x=>String(x?.meta?.location??'').toLowerCase()==='away');
 const h=hs?.id,a=as?.id;
 if(!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||h<=0||a<=0||h===a)return null;
 const id=Number(result.fixture_id),home=result.home_score,away=result.away_score;
 if(!Number.isSafeInteger(id)||id<=0||!Number.isInteger(home)||!Number.isInteger(away)||
   home<0||away<0||home>15||away>15)return null;
 const expected=Array.isArray(raw.expected)?raw.expected:[];
 const xg={home:null,away:null};
 for(const row of expected){
  if(Number(row?.type_id)!==5304)continue;
  const side=uLocation(row,h,a),val=uFinite(row?.data?.value,12);
  if(side&&val!==null)xg[side]=val;
 }
 const shots={home:null,away:null},onTarget={home:null,away:null},possession={home:null,away:null};
 for(const s of Array.isArray(raw.statistics)?raw.statistics:[]){
  const side=uLocation(s,h,a);if(!side)continue;
  const type=String(s?.type?.developer_name??s?.type?.code??s?.type?.name??'').toUpperCase().replace(/[^A-Z0-9]+/g,'_');
  const val=s?.data?.value;
  if(['SHOTS_TOTAL','TOTAL_SHOTS','TOTAL_SHOT'].includes(type))shots[side]=uFinite(val,100);
  else if(['SHOTS_ON_TARGET','SHOT_ON_TARGET','SHOTS_ON_GOAL'].includes(type))onTarget[side]=uFinite(val,100);
  else if(['BALL_POSSESSION','POSSESSION'].includes(type))possession[side]=uFinite(val,100);
 }
 const hasXg=xg.home!==null&&xg.away!==null;
 const hasStats=[...Object.values(shots),...Object.values(onTarget),...Object.values(possession)].some(v=>v!==null);
 return {fixture_id:id,league_key:result.league_key,match_date:result.match_date,
  home_team_id:h,away_team_id:a,home_team:result.home_team,away_team:result.away_team,
  home_score:home,away_score:away,home_xg:xg.home,away_xg:xg.away,
  home_shots:shots.home,away_shots:shots.away,
  home_shots_on_target:onTarget.home,away_shots_on_target:onTarget.away,
  home_possession:possession.home,away_possession:possession.away,
  metric_coverage:hasXg&&hasStats?'xg_and_stats':hasXg?'xg':hasStats?'stats':'score_only',
  observed_at:observedAt,source:'sportmonks_final'};
}
