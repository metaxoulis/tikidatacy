/* Tiki-Data: leakage-resistant walk-forward evaluation of licensed finished scores.
 * No bookmaker odds and no commercial API payloads are used as model training data.
 */
const MS_DAY=86400000;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const LEAGUE=/^(epl|laliga|bundesliga|seriea|ligue1|greece|cyprus)-\d{4}-\d{2}$/;
const validDay=x=>typeof x==='string'&&DAY.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const finiteProbability=x=>num(x)!==null&&x>=0&&x<=100;
const round=(x,dp=4)=>x===null||!Number.isFinite(x)?null:Number(x.toFixed(dp));
const daysUTC=d=>Date.parse(d+'T00:00:00Z');
function sanitizeFinishedScores(records,now=Date.now()){
 const cutoff=now-3*MS_DAY,keys=new Set(),out=[];
 for(const raw of Array.isArray(records)?records:[]){
  if(!raw||raw.match_status!=='FINISHED'||!LEAGUE.test(String(raw.dataset_slug||''))||
   !validDay(raw.match_date)||daysUTC(raw.match_date)>=cutoff)continue;
  if(typeof raw.home_team!=='string'||!raw.home_team.trim()||typeof raw.away_team!=='string'||!raw.away_team.trim())continue;
  const h=raw.home_score,a=raw.away_score;
  if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h>15||a>15)continue;
  const key=String(raw.match_key||raw.dataset_slug+'|'+raw.match_date+'|'+raw.home_team+'|'+raw.away_team);
  if(keys.has(key))continue;keys.add(key);
  out.push({...raw,match_key:key,league_key:raw.dataset_slug.replace(/-\d{4}-\d{2}$/,'')});
 }
 return out.sort((a,b)=>a.match_date.localeCompare(b.match_date)||a.match_key.localeCompare(b.match_key));
}
const asProbability=x=>finiteProbability(x)?x/100:null;
function modeledProbs(estimate){
 const validMethods=new Set(['openfootball_cc0_fitted_venue_poisson','licensed_historical_venue_poisson','partial_team_hierarchical_poisson','league_historical_prior_poisson','cross_league_historical_prior_poisson']);
 if(!estimate||!validMethods.has(estimate.method)||
   (['openfootball_cc0_fitted_venue_poisson','licensed_historical_venue_poisson'].includes(estimate.method)&&
    (estimate.team_samples?.home<3||estimate.team_samples?.away<3)))return null;
 const triple=[estimate.p1,estimate.px,estimate.p2].map(asProbability);
 const over=asProbability(estimate.over25),gg=asProbability(estimate.btts);
 if(triple.some(x=>x===null)||over===null||gg===null)return null;
 const total=triple.reduce((a,b)=>a+b,0);
 return Math.abs(total-1)>.005?null:{one:triple.map(x=>x/total),over,gg};
}
function referenceProbs(base){
 if(!base)return null;
 const triple=[base.p1,base.px,base.p2].map(asProbability);
 const over=asProbability(base.over25),gg=asProbability(base.btts);
 const total=triple.reduce((a,b)=>a+(b||0),0);
 if(triple.some(x=>x===null)||over===null||gg===null||Math.abs(total-1)>.005)return null;
 return {one:triple.map(x=>x/total),over,gg};
}
const brier3=(p,j)=>p.reduce((v,x,i)=>v+(x-(i===j?1:0))**2,0);
const binaryBrier=(p,v)=>(p-v)**2;
const logLoss=(p,j)=>-Math.log(Math.max(p[j],1e-8));
const calcAccuracy=(p,j)=>p.indexOf(Math.max(...p))===j?1:0;
function accumulator(){return {n:0,scored:0,modelBrier:0,baselineBrier:0,modelLog:0,baselineLog:0,
 accuracy:0,overBrier:0,overBaselineBrier:0,bttsBrier:0,bttsBaselineBrier:0,
 tierCounts:{team:0,partial_team:0,league:0,cross_league:0},
 confidenceTotal:0,actualTotal:0,calibration:Array.from({length:10},()=>({n:0,confidence:0,actual:0}))};}
function addScore(a,prob,ref,h,g,tier=null){
 a.n++;
 if(!prob||!ref)return;
 const outcome=h>g?0:h===g?1:2,over=Number(h+g>2),btts=Number(h>0&&g>0);
 a.scored++;if(tier&&Object.hasOwn(a.tierCounts,tier))a.tierCounts[tier]++;a.modelBrier+=brier3(prob.one,outcome);a.baselineBrier+=brier3(ref.one,outcome);
 a.modelLog+=logLoss(prob.one,outcome);a.baselineLog+=logLoss(ref.one,outcome);
 a.accuracy+=calcAccuracy(prob.one,outcome);
 a.overBrier+=binaryBrier(prob.over,over);a.overBaselineBrier+=binaryBrier(ref.over,over);
 a.bttsBrier+=binaryBrier(prob.gg,btts);a.bttsBaselineBrier+=binaryBrier(ref.gg,btts);
 const conf=Math.max(...prob.one),win=calcAccuracy(prob.one,outcome),i=Math.min(9,Math.floor(conf*10));
 const v=a.calibration[i];v.n++;v.confidence+=conf;v.actual+=win;
}
function summarize(a){
 const n=a.scored;
 let ece=0;
 if(n)for(const v of a.calibration)if(v.n)ece+=(v.n/n)*Math.abs(v.actual/v.n-v.confidence/v.n);
 return {eligible:n,fixtures:a.n,coverage_pct:a.n?round(n/a.n*100,2):0,tiers:a.tierCounts,
  accuracy_pct:n?round(a.accuracy/n*100,2):null,
  brier_1x2:n?round(a.modelBrier/n):null,
  brier_1x2_baseline:n?round(a.baselineBrier/n):null,
  log_loss_1x2:n?round(a.modelLog/n):null,
  log_loss_baseline:n?round(a.baselineLog/n):null,
  brier_over25:n?round(a.overBrier/n):null,
  brier_over25_baseline:n?round(a.overBaselineBrier/n):null,
  brier_btts:n?round(a.bttsBrier/n):null,
  brier_btts_baseline:n?round(a.bttsBaselineBrier/n):null,
  ece_1x2:n?round(ece):null,
  brier_skill_vs_baseline_pct:n&&a.baselineBrier>0?round(100*(1-a.modelBrier/a.baselineBrier),2):null
 };
}
const monthAfter=d=>new Date(Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7)),1)).toISOString().slice(0,10);
function evaluateWalkForward(records,dependencies={},config={}){
 const now=Number.isFinite(config.now)?config.now:Date.now();
 const rows=sanitizeFinishedScores(records,now);
 const train=dependencies.train,estimate=dependencies.estimate,poisson=dependencies.poisson;
 if(typeof train!=='function'||typeof estimate!=='function'||typeof poisson!=='function')throw Error('backtest_dependencies_required');
 const defaultStart='2025-08-01',start=validDay(config.start)?config.start:defaultStart;
 const endLimit=new Date(now-3*MS_DAY).toISOString().slice(0,10);
 const end=validDay(config.end)&&config.end<endLimit?config.end:endLimit;
 const aggregate=accumulator(),perLeague=new Map(),folds=[];
 let period=start,foldCount=0,skipped=0;
 while(period<=end&&foldCount<18){
  const next=monthAfter(period),last=next>end?end:next;
  const test=rows.filter(r=>r.match_date>=period&&r.match_date<last);
  const cutoff=daysUTC(period)-3*MS_DAY,history=rows.filter(r=>daysUTC(r.match_date)<cutoff);
  if(test.length&&history.length>=80){
   const model=train(history,new Date(period+'T00:00:00Z'));
   const foldAgg=accumulator();
   for(const r of test){
    const league=r.league_key,profile=model?.leagues?.[league];
    const data=estimate({league_key:league,home:r.home_team,away:r.away_team},model);
    const pred=modeledProbs(data);
    const baseline=profile||model?.global;const base=baseline?referenceProbs(poisson(baseline.hmean,baseline.amean)):null;
    addScore(aggregate,pred,base,r.home_score,r.away_score,data?.tier);
    addScore(foldAgg,pred,base,r.home_score,r.away_score,data?.tier);
    if(!perLeague.has(league))perLeague.set(league,accumulator());
    addScore(perLeague.get(league),pred,base,r.home_score,r.away_score,data?.tier);
   }
   folds.push({start:period,end_exclusive:last,training_matches:history.length,...summarize(foldAgg)});
  }else skipped+=test.length;
  period=next;foldCount++;
 }
 const leagues=Object.fromEntries([...perLeague].map(([k,v])=>[k,summarize(v)]));
 return {method:'monthly_expanding_window',source:'openfootball_cc0',model_version:config.model_version||'tiki-hierarchical-poisson-coverage-v5',
  created_at:new Date(now).toISOString(),start,end_exclusive:period,
  embargo_days:3,training_only_before_test:true,
  evaluated_months:folds.length,skipped_untrained_fixtures:skipped,
  total_available_finished_rows:rows.length,metrics:summarize(aggregate),
  folds,leagues,provisional:true,
  note:'Retrospective time-split evaluation of all evidence tiers; low-confidence league priors are not team-specific estimates. Not prospective accuracy or betting advice. No bookmaker odds used.'};
}
export {sanitizeFinishedScores,modeledProbs,evaluateWalkForward};
