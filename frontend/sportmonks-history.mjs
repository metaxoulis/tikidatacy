/* Tiki-Data Sportmonks historical records — bounded, sanitized, independently testable. */
export const historyDay = value => {
 const s=String(value??'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const t=Date.parse(s+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?s:null;
};
export function historyWindow(start,end,now=Date.now()){
 const a=historyDay(start),b=historyDay(end);
 if(!a||!b)return null;
 const x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');
 if(x>y||y>now+86400000||x<now-3650*86400000||y-x>6*86400000)return null;
 return {start:a,end:b};
}
const positiveId=n=>Number.isSafeInteger(n)&&n>0&&n<1e15?n:null;
const finished=new Set(['FT','FINISHED','FULL_TIME','AET','PEN']);
const text=(v,max=110)=>typeof v==='string'?v.trim().slice(0,max):'';
const img=x=>{
 if(typeof x!=='string')return null;
 try{const u=new URL(x);return u.protocol==='https:'&&u.hostname==='cdn.sportmonks.com'&&
 /^\/images\/[\w/%.-]{1,190}\.(?:png|jpe?g|webp|svg)$/i.test(u.pathname)&&!u.search?u.href:null}
 catch{return null}
};
export function historyMatch(row,classify){
 if(!row||row.sport_id!==1||!positiveId(row.id))return null;
 const state=text(row.state?.short_name??row.state?.state??row.state?.name??'',25).toUpperCase();
 if(!finished.has(state))return null;
 const league=text(row.league?.name,95),country=text(row.league?.country?.name,65);
 const leagueKey=classify(league,country);
 if(!leagueKey)return null;
 const participants=Array.isArray(row.participants)?row.participants:[];
 const home=participants.find(p=>String(p?.meta?.location??p?.meta?.position??'').toLowerCase()==='home');
 const away=participants.find(p=>String(p?.meta?.location??p?.meta?.position??'').toLowerCase()==='away');
 if(!positiveId(home?.id)||!positiveId(away?.id)||home.id===away.id)return null;
 if(!text(home.name)||!text(away.name))return null;
 const time=Date.parse(text(row.starting_at,35).replace(' ','T')+'Z');
 if(!Number.isFinite(time))return null;
 const scores=Array.isArray(row.scores)?row.scores:[];
 let goals=null;
 for(const type of ['FT','FULL_TIME','CURRENT']){
  const stage=scores.filter(x=>String(x?.description??'').toUpperCase()===type);
  const h=stage.find(x=>x?.score?.participant==='home')?.score?.goals;
  const a=stage.find(x=>x?.score?.participant==='away')?.score?.goals;
  if(Number.isInteger(h)&&Number.isInteger(a)&&h>=0&&a>=0&&h<100&&a<100){goals={home:h,away:a};break;}
 }
 if(!goals)return null;
 return {id:'sportmonks-'+row.id,source:'sportmonks',date:new Date(time).toISOString(),
  league,league_key:leagueKey,country,home:text(home.name),away:text(away.name),
  home_id:home.id,away_id:away.id,home_score:goals.home,away_score:goals.away,
  home_logo:img(home.image_path),away_logo:img(away.image_path),final:true};
}
export function historyOddsRow(row){
 if(!row||!positiveId(row.id)||!positiveId(row.odd_id))return null;
 const price=Number(row.value);
 if(!Number.isFinite(price)||price<=1||price>10000)return null;
 const rawTime=text(row.bookmaker_update,35);
 const updated=rawTime&&/^\d{4}-\d{2}-\d{2}[ T]\d\d:\d\d:\d\d/.test(rawTime)?rawTime:null;
 const odd=row.odd??null;
 return{id:row.id,odd_id:row.odd_id,fixture_id:positiveId(odd?.fixture_id),
  market_id:positiveId(odd?.market_id),bookmaker_id:positiveId(odd?.bookmaker_id),
  price,updated_at:updated};
}
export function summarizeHistoryOdds(rows){
 const valid=(Array.isArray(rows)?rows:[]).map(historyOddsRow).filter(Boolean);
 const prices=valid.map(r=>r.price).sort((a,b)=>a-b);
 const updates=valid.map(r=>r.updated_at).filter(Boolean).sort();
 return {records:valid.length,distinct_odds:new Set(valid.map(x=>x.odd_id)).size,
  identifiable_fixtures:new Set(valid.map(x=>x.fixture_id).filter(Boolean)).size,
  from:updates[0]??null,to:updates.at(-1)??null,
  price_min:prices[0]??null,price_max:prices.at(-1)??null,
  attribution:'premium_pre_match_odds_history',model_prediction:false};
}
