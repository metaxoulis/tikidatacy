// Multinomial logistic calibration. Separate temporal train/validation/test sets.
// Only forecasts genuinely recorded before kickoff may enter supervised learning.
const classes=['H','D','A'];
export function probabilities(p,w){
 const x=[1,...p.map(v=>Math.log(Math.max(1e-6,v)))];
 const z=w.map(row=>row.reduce((s,v,j)=>s+v*x[j],0));
 const max=Math.max(...z),e=z.map(v=>Math.exp(v-max)),sum=e.reduce((a,b)=>a+b,0);
 return e.map(v=>v/sum);
}
const identity=()=>[[0,1,0,0],[0,0,1,0],[0,0,0,1]];
export function fit(rows,ridge){
 const w=identity(),prior=identity();
 for(let epoch=0;epoch<300;epoch++){
  const g=Array.from({length:3},()=>[0,0,0,0]);
  for(const r of rows){const p=probabilities(r.p,w),x=[1,...r.p.map(v=>Math.log(Math.max(v,1e-6)))];
   for(let k=0;k<3;k++)for(let j=0;j<4;j++)g[k][j]+=(p[k]-(r.y===k?1:0))*x[j]/rows.length;
  }
  for(let k=0;k<3;k++)for(let j=0;j<4;j++)w[k][j]-=.03*(g[k][j]+ridge*(w[k][j]-prior[k][j]));
 }
 return w;
}
export function metrics(rows,w){
 if(!rows.length)return {n:0,brier:null,log_loss:null,accuracy:null};
 let brier=0,loss=0,hit=0;
 for(const r of rows){const p=w?probabilities(r.p,w):r.p;brier+=p.reduce((s,v,k)=>s+(v-(r.y===k?1:0))**2,0);loss-=Math.log(Math.max(p[r.y],1e-12));hit+=p.indexOf(Math.max(...p))===r.y?1:0;}
 return {n:rows.length,brier:brier/rows.length,log_loss:loss/rows.length,accuracy:hit/rows.length};
}
export function prepare(logs){
 const byFixture=new Map();
 for(const r of logs){
  const match=r.fixture_key?.match(/^sportmonks-\d+:(.+)$/);if(!match)continue;
  const kickoff=Date.parse(match[1]),stamp=Date.parse(r.created_at.replace(' ','T')+'Z'),p=[r.ph,r.pd,r.pa];
  if(!Number.isFinite(kickoff)||!(stamp<kickoff)||!classes.includes(r.outcome)||!p.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||Math.abs(p.reduce((a,b)=>a+b,0)-1)>.01)continue;
  const old=byFixture.get(r.fixture_key);
  if(!old||stamp>old.stamp)byFixture.set(r.fixture_key,{key:r.fixture_key,stamp,kickoff,p,y:classes.indexOf(r.outcome)});
 }
 return [...byFixture.values()].sort((a,b)=>a.kickoff-b.kickoff||a.key.localeCompare(b.key));
}
export function trainCalibration(logs,version){
 const rows=prepare(logs.filter(r=>r.model_version===version));
 const days=[...new Set(rows.map(r=>new Date(r.kickoff).toISOString().slice(0,10)))];
 const a=days[Math.floor(days.length*.6)],b=days[Math.floor(days.length*.8)];
 const day=r=>new Date(r.kickoff).toISOString().slice(0,10);
 // Whole dates stay in one split. No same-day results cross the split boundary.
 const train=rows.filter(r=>day(r)<a),validation=rows.filter(r=>day(r)>=a&&day(r)<b),test=rows.filter(r=>day(r)>=b);
 const report={family:'multinomial_logistic_calibration_v1',base_model:version,status:'BLOCKED',trained_at:new Date().toISOString(),n:rows.length,splits:{train:train.length,validation:validation.length,test:test.length},reasons:[],weights:null};
 if(train.length<30||!validation.length||!test.length){report.reasons.push('Insufficient dated outcomes for three chronological splits');return report;}
 const candidates=[.01,.1,1].map(ridge=>{const weights=fit(train,ridge);return {ridge,weights,score:metrics(validation,weights)};}).sort((a,b)=>a.score.log_loss-b.score.log_loss);
 const chosen=candidates[0];report.weights=chosen.weights;report.ridge=chosen.ridge;
 report.validation={baseline:metrics(validation),candidate:chosen.score};report.holdout={baseline:metrics(test),candidate:metrics(test,chosen.weights)};
 if(train.length<200||validation.length<50||test.length<100)report.reasons.push('Need at least 200 training, 50 validation and 100 untouched test forecasts from this exact base model');
 for(const [label,r] of [['validation',report.validation],['holdout',report.holdout]])if(r.baseline.brier-r.candidate.brier<.002||r.baseline.log_loss-r.candidate.log_loss<.002)report.reasons.push('No joint Brier/log-loss improvement on '+label);
 report.status=report.reasons.length?'BLOCKED':'SHADOW_READY';
 // Never claim this proves improvement over other model versions or UEFA cohorts.
 return report;
}
export async function learnCalibration(db){
 const versions=await db.prepare('SELECT DISTINCT model_version FROM prospective_forecast_log WHERE outcome IS NOT NULL ORDER BY model_version').all();
 const reports=[];
 for(const {model_version} of versions.results){
  const data=await db.prepare('SELECT fixture_key,created_at,model_version,ph,pd,pa,outcome FROM prospective_forecast_log WHERE model_version=?1 AND outcome IS NOT NULL ORDER BY created_at DESC LIMIT 10000').bind(model_version).all();
  const report=trainCalibration(data.results,model_version);
  await db.prepare('INSERT INTO ml_calibration_candidates (base_model,payload_json,trained_at) VALUES (?1,?2,?3) ON CONFLICT(base_model) DO UPDATE SET payload_json=excluded.payload_json,trained_at=excluded.trained_at').bind(model_version,JSON.stringify(report),report.trained_at).run();
  reports.push({base_model:model_version,n:report.n,status:report.status});
 }
 return reports;
}
