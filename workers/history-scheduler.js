/* Tiki-Data scheduled licensed fixture history backfill.
 * Deployed to a separate Cloudflare Worker: tiki-data-history-scheduler.
 * Cron: 0 *\/4 * * * (UTC), configured in Cloudflare Workers.
 * No Sportmonks credentials or provider responses are handled here.
 */
addEventListener('fetch',event=>{
 event.respondWith(new Response('Scheduled sync only',{status:403}));
});
addEventListener('scheduled',event=>{
 event.waitUntil((async()=>{
  const r=await fetch('https://tiki-data.pages.dev/api/home-focus?scheduled=1',{
   headers:{Accept:'application/json','User-Agent':'Tiki-Data-History-Scheduler/1.0'}
  });
  if(!r.ok)throw new Error('Tiki-Data history sync '+r.status);
  await r.arrayBuffer();
 })());
});
