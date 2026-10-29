import {runArchiveBatch} from './archive-scheduler.mjs';
import {learnCalibration} from './ml-calibration.mjs';
// Keep training, prospective capture and settlement observable and independent.
export function settlement(m) {
 if(m.final!==true||m.prediction_status!=='recorded'||!Number.isSafeInteger(m.log_id))return null;
 if(!Number.isInteger(m.home_score)||!Number.isInteger(m.away_score)||m.home_score<0||m.away_score<0)return null;
 if(!(Date.parse(m.captured_at)<Date.parse(m.kickoff)))return null;
 const p=m.probabilities;
 if(!Array.isArray(p)||p.length!==3||!p.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||Math.abs(p.reduce((a,b)=>a+b,0)-1)>0.01)return null;
 return {id:m.log_id,outcome:m.home_score>m.away_score?'H':m.home_score<m.away_score?'A':'D'};
}
async function json(url,options={}) {
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error('Pipeline HTTP '+response.status);
 return response.json();
}
export function captureRows(feed,now=Date.now()) {
 if(feed.stale||feed.partial||now-Date.parse(feed.updated_at)>600000)return [];
 return (feed.matches||[]).filter(m=>m.forecast_source==='published_trained_model'&&m.forecast_calculated_at===feed.model?.trained_at&&m.status==='NS'&&Date.parse(m.date)>now+60000&&m.model?.tier==='team'&&[m.model.p1,m.model.px,m.model.p2].every(p=>typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=100)&&Math.abs(m.model.p1+m.model.px+m.model.p2-100)<0.1);
}
export async function runPipeline(env) {
 const failures=[];const report={event:'forecast_pipeline'};
 try {
  const result=await json('https://tiki-data.pages.dev/api/internal/train',{method:'POST',headers:{Authorization:'Bearer '+env.MODEL_TRAINING_TOKEN,Accept:'application/json'}});
  if(result.status!=='success')throw Error('Training incomplete');
  report.trained_at=result.last_success;
 }catch(e){failures.push('training: '+e.message);}
 // The existing feed records only publishable forecasts, before kickoff.
 try {
  const result=await json('https://tiki-data.pages.dev/api/home-focus');
  report.predictions_available=result.model_predictions_available??result.coverage?.with_prediction??0;
  const snapshot=await env.TIKI_DB.prepare('SELECT model_key FROM focus_model_snapshots WHERE trained_at=?1').bind(result.model?.trained_at||'').all();
  if(snapshot.results.length!==1)throw Error('Ambiguous published model identity');
  const rows=captureRows(result);
  let captured=0;
  for(let i=0;i<rows.length;i+=50) {
   const writes=await env.TIKI_DB.batch(rows.slice(i,i+50).map(m=>env.TIKI_DB.prepare("INSERT OR IGNORE INTO prospective_forecast_log (fixture_key,created_at,model_version,data_cutoff,source_sync_at,ph,pd,pa) VALUES (?1,datetime('now'),?2,?3,?4,?5,?6,?7)").bind(m.id+':'+m.date,snapshot.results[0].model_key,result.model.historical_cutoff,result.updated_at,m.model.p1/100,m.model.px/100,m.model.p2/100)));
   captured+=writes.reduce((n,r)=>n+(r.meta?.changes||0),0);
  }
  report.captured=captured;
 }catch(e){failures.push('capture: '+e.message);}
 try {
  if(!env.TIKI_DB)throw Error('Settlement database binding missing');
  const today=new Date().toISOString().slice(0,10);
  const pending=await env.TIKI_DB.prepare("SELECT fixture_key FROM prospective_forecast_log WHERE outcome IS NULL ORDER BY created_at LIMIT 1000").all();
  const days=[...new Set(pending.results.map(r=>r.fixture_key.match(/:(\d{4}-\d{2}-\d{2})T/)?.[1]).filter(d=>d&&d>='2026-10-18'&&d<=today))].sort();
  // Bound API usage; each page includes up to 28 days and is cached by Pages.
  let start=days[0];let settled=0;
  for(let page=0;start&&page<4;page++) {
   const result=await json('https://tiki-data.pages.dev/api/transparency?start='+start+'&end='+today);
   if(result.partial||result.stale)throw Error('Incomplete result audit');
   const rows=(result.matches||[]).map(settlement).filter(Boolean);
   for(let i=0;i<rows.length;i+=50) {
    const batch=rows.slice(i,i+50);
    const written=await env.TIKI_DB.batch(batch.map(r=>env.TIKI_DB.prepare("UPDATE prospective_forecast_log SET outcome=?1,evaluated_at=datetime('now') WHERE id=?2 AND outcome IS NULL").bind(r.outcome,r.id)));
    settled+=written.reduce((n,r)=>n+(r.meta?.changes||0),0);
   }
   start=result.next;
  }
  report.settled=settled;
 }catch(e){failures.push('settlement: '+e.message);}
 try {report.ml=await learnCalibration(env.TIKI_DB);}catch(e){failures.push('ml: '+e.message);}
 console.log(JSON.stringify({...report,failures}));
 if(failures.length)throw Error(failures.join('; '));
 return report;
}
export default {
 async fetch(){return new Response('Scheduled pipeline only',{status:403});},
 async scheduled(event,env,ctx){ctx.waitUntil(event.cron==='* * * * *'?runArchiveBatch(env):runPipeline(env));}
};
