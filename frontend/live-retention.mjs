/* Retain the last valid live 1X2 estimate until the next valid estimate for that same fixture.
   Never mix fixture identities, and preserve the original calculation timestamp and score. */
function smValidLiveEstimate(p){
 return !!p&&[p.p1,p.px,p.p2].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100)&&Math.abs(p.p1+p.px+p.p2-100)<3;
}
function smRetainLiveEstimates(next,previous){
 if(!Array.isArray(next?.matches))return next;
 const byId=new Map((Array.isArray(previous?.matches)?previous.matches:[]).filter(m=>m?.id).map(m=>[String(m.id),m]));
 return {...next,matches:next.matches.map(m=>{
  if(!m?.id)return m;
  const fresh=smValidLiveEstimate(m.live_outlook)||smValidLiveEstimate(m.live_prediction);
  if(fresh)return {...m,live_probability_stale:false,live_probability_updated_at:next.updated_at,
   live_probability_score:[m.home_score,m.away_score],live_probability_minute:m.minute??null};
  const prior=byId.get(String(m.id));
  if(!prior||prior.home_id!==m.home_id||prior.away_id!==m.away_id||prior.date!==m.date)return m;
  const oldOutlook=smValidLiveEstimate(prior.live_outlook)?prior.live_outlook:null;
  const oldProvider=smValidLiveEstimate(prior.live_prediction)?prior.live_prediction:null;
  if(!oldOutlook&&!oldProvider)return m;
  const savedAt=prior.live_probability_updated_at||previous.updated_at;
  if(!Number.isFinite(Date.parse(savedAt)))return m;
  return {...m,live_outlook:oldOutlook,live_prediction:oldProvider,live_probability_stale:true,
   live_probability_updated_at:savedAt,
   live_probability_score:Array.isArray(prior.live_probability_score)?prior.live_probability_score:[prior.home_score,prior.away_score],
   live_probability_minute:prior.live_probability_minute??prior.minute??null};
 })};
}
export {smValidLiveEstimate,smRetainLiveEstimates};
