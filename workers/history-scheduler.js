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
 console.log(JSON.stringify({...report,failures}));
 if(failures.length)throw Error(failures.join('; '));
 return report;
}
export default {
 async fetch(){return new Response('Scheduled pipeline only',{status:403});},
 async scheduled(event,env,ctx){ctx.waitUntil(runPipeline(env));}
};
