export default {
 async fetch(){return new Response('Scheduled training only',{status:403});},
 async scheduled(event,env,ctx){
  ctx.waitUntil((async()=>{
   const response=await fetch('https://tiki-data.pages.dev/api/internal/train',{method:'POST',headers:{Authorization:'Bearer '+env.MODEL_TRAINING_TOKEN,Accept:'application/json'}});
   const result=await response.json();
   if(!response.ok||result.status!=='success')throw Error('Model training incomplete: '+response.status);
   console.log(JSON.stringify({event:'model_trained',trained_at:result.last_success,records:result.historical_matches}));
  })());
 }
};