/* Only verified live Sportmonks statistics and finished D1 scores.
 * Missing real-time values remain null; a form-based forecast is separately experimental.
 */
export const METRICS=[
 ['shots','Σουτ',['SHOTS_TOTAL','TOTAL_SHOTS']],
 ['on_target','Στην εστία',['SHOTS_ON_TARGET','SHOTS_ON_GOAL']],
 ['possession','Κατοχή',['BALL_POSSESSION','POSSESSION']],
 ['corners','Κόρνερ',['CORNERS','CORNER_KICKS','CORNERS_WON']],
 ['fouls','Φάουλ',['FOULS','FOULS_COMMITTED']],
 ['yellow','Κίτρινες',['YELLOWCARDS','YELLOW_CARDS','YELLOW_CARDS_TOTAL']],
 ['red','Κόκκινες',['REDCARDS','RED_CARDS']],
 ['off_target','Εκτός εστίας',['SHOTS_OFF_TARGET','SHOTS_OFF_GOAL']],
 ['blocked','Μπλοκαρισμένα σουτ',['SHOTS_BLOCKED','BLOCKED_SHOTS']],
 ['attacks','Επιθέσεις',['ATTACKS']],
 ['dangerous','Επικίνδυνες επιθέσεις',['DANGEROUS_ATTACKS']],
 ['offsides','Οφσάιντ',['OFFSIDES']],
 ['saves','Αποκρούσεις',['SAVES','GOALKEEPER_SAVES']],
 ['throwins','Πλάγια άουτ',['THROW_INS']],
 ['goal_kicks','Ελεύθερα',['GOAL_KICKS']]
];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function liveStatSummary(rows,homeId,awayId){
 const h=Number(homeId),a=Number(awayId);
 if(!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||h<=0||a<=0||h===a)return [];
 const m=new Map();
 for(const v of Array.isArray(rows)?rows:[]){
  const side=Number(v?.participant_id)===h?'home':Number(v?.participant_id)===a?'away':null;
  const type=String(v?.type||'').toUpperCase().replace(/[^A-Z0-9]+/g,'_');
  const num=v?.value;
  if(!side||!finite(num)||num<0||num>50000)continue;
  if(type==='GOALS')continue; // score endpoint, not GOALS statistic, is authoritative.
  if(!m.has(type))m.set(type,{home:null,away:null});
  m.get(type)[side]=num;
 }
 return METRICS.map(([key,label,types])=>{
  const matched=types.map(k=>m.get(k)).find(x=>x&&x.home!==null&&x.away!==null);
  if(!matched)return null;
  if((key==='possession')&&(matched.home>100||matched.away>100))return null;
  return {key,label,home:matched.home,away:matched.away,unit:key==='possession'?'%':''};
 }).filter(Boolean);
}
export const teamKey=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[^a-z0-9\u0370-\u03ff]+/g,' ').replace(/\b(fc|cf|afc|sc|ac|football club)\b/g,'').replace(/\s+/g,' ').trim();
export function historicalFormIndex(rows,cutoff){
 const map=new Map(),bound=Date.parse(String(cutoff).slice(0,10)+'T00:00:00Z');
 for(const r of Array.isArray(rows)?rows:[]){
  const d=Date.parse(String(r.match_date||'')+'T00:00:00Z');
  if(!Number.isFinite(d)||!(d<bound)||!Number.isInteger(r.home_score)||!Number.isInteger(r.away_score)||r.home_score<0||r.away_score<0||r.home_score>15||r.away_score>15)continue;
  const h=teamKey(r.home_team),a=teamKey(r.away_team);if(!h||!a||h===a)continue;
  for(const [name,gf,ga,venue] of [[h,r.home_score,r.away_score,'home'],[a,r.away_score,r.home_score,'away']]){
   if(!map.has(name))map.set(name,[]);
   const list=map.get(name);
   if(list.length<9)list.push({date:r.match_date,gf,ga,venue,league_key:r.league_key});
  }
 }
 return map;
}
export function recentTeamForm(index,name){
 const all=(index?.get(teamKey(name))||[]).slice(0,8),n=all.length;
 if(!n)return {matches:0,source:'sportmonks_d1_final_scores',verified:false};
 const sum=key=>all.reduce((s,r)=>s+r[key],0);
 const gf=sum('gf'),ga=sum('ga');
 return {matches:n,source:'sportmonks_d1_final_scores',verified:true,last_match:all[0].date,
  wins:all.filter(x=>x.gf>x.ga).length,draws:all.filter(x=>x.gf===x.ga).length,losses:all.filter(x=>x.gf<x.ga).length,
  goals_for:gf,goals_against:ga,goals_per_match:Number((gf/n).toFixed(2)),
  conceded_per_match:Number((ga/n).toFixed(2)),form:all.map(x=>x.gf>x.ga?'W':x.gf<x.ga?'L':'D').join(''),
  competitions:[...new Set(all.map(x=>x.league_key))],window:'last_8_verified_finished_matches'};
}
export function formBasedRates(home,away){
 if(!home?.verified||!away?.verified||home.matches<4||away.matches<4)return null;
 const hx=home.goals_per_match,ha=home.conceded_per_match,ax=away.goals_per_match,aa=away.conceded_per_match;
 if(![hx,ha,ax,aa].every(finite))return null;
 const clip=v=>Math.max(.35,Math.min(3.8,v));
 // Shrink simple scored/conceded averages toward neutral goal rates; no xG assumed.
 const mh=clip(.4*1.38+.6*(hx+aa)/2);
 const ma=clip(.4*1.13+.6*(ax+ha)/2);
 return {mu_home:mh,mu_away:ma,team_samples:{home:home.matches,away:away.matches},
  method:'form_based_live_poisson_v1',confidence:'low',validated:false,source:'sportmonks_d1_finished_scores',
  note:'Experimental scenario based on recent real goals for and against; not calibrated or validated.'};
}
