// Finite, checkpointed export work. Training retains its existing schedule.
export async function runArchiveBatch(env){
 const report={event:'sportmonks_archive_export',pages:0,records:0};
 for(let i=0;i<24;i++){
  const response=await fetch('https://tiki-data.pages.dev/api/internal/sportmonks-archive',{
   method:'POST',headers:{Authorization:'Bearer '+env.MODEL_TRAINING_TOKEN,'Content-Type':'application/json'},
   body:JSON.stringify({action:'step',pages:12}),signal:AbortSignal.timeout(120000)
  });
  if(!response.ok)throw Error('Archive endpoint HTTP '+response.status);
  const result=await response.json();
  report.pages+=result.pages||0;report.records+=result.records||0;
  if(result.paused){report.paused=result.paused;break;}
  if(result.tasks){report.complete=result.complete;report.blocked=result.tasks.filter(t=>t.status==='blocked').map(t=>t.task);break;}
  if(result.error){report.last_error=result.error;if(result.status==='retry')break;}
 }
 console.log(JSON.stringify(report));return report;
}

// The minute trigger now keeps live data current: the Sportmonks export it used to drive is complete. Until this
// worker is redeployed, its archive call above reaches the same heartbeat on the Pages side.
export async function runLiveHeartbeat(env){
 const response=await fetch('https://tiki-data.pages.dev/api/internal/live-refresh',{method:'POST',
  headers:{Authorization:'Bearer '+env.MODEL_TRAINING_TOKEN},signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error('Live heartbeat HTTP '+response.status);
 const report={event:'live_heartbeat',...await response.json()};
 console.log(JSON.stringify(report));return report;
}
