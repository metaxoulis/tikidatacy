// Tiki-Data v9 Pages advanced-mode gateway. No tokens or model inference in this frontend Worker.
// Keep MATCHIQ_CACHE binding. /api/fixtures remains the existing football-data.org-backed service.
const PREFIX='tiki-v9-';
const MIME={'/assets/style.css':'text/css;charset=utf-8','/assets/app.js':'text/javascript;charset=utf-8','/assets/components.js':'text/javascript;charset=utf-8','/assets/data.js':'text/javascript;charset=utf-8','/assets/pages.js':'text/javascript;charset=utf-8'};
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405,headers:{'Allow':'GET, HEAD'}});
  if(path==='/api/fixtures'){
   const target=new URL('/api/fixtures'+url.search,'https://matchiq-preview.pages.dev');
   try{
    const upstream=await fetch(target.toString(),{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
    const headers=new Headers(upstream.headers);
    headers.set('Cache-Control','no-store');headers.set('X-Tiki-Data-Origin','matchiq-preview');headers.set('X-Robots-Tag','noindex,nofollow');
    headers.set('X-Content-Type-Options','nosniff');
    return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers});
   }catch{
    return new Response(JSON.stringify({error:'api_unavailable',message:'Προσωρινή αδυναμία φόρτωσης αγώνων. Δοκίμασε ξανά.'}),{status:503,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
   }
  }
  if(!env.MATCHIQ_CACHE)return new Response('Storage unavailable',{status:503});
  let key,type;
  if(path==='/'||path==='/index.html'||path==='/predictions'||path==='/predictions/'){key=PREFIX+'index.html';type='text/html;charset=utf-8';}
  else if(Object.hasOwn(MIME,path)){key=PREFIX+path.slice(1);type=MIME[path];}
  else return new Response('Not found',{status:404});
  const body=await env.MATCHIQ_CACHE.get(key);
  if(body===null)return new Response('Resource unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
  return new Response(request.method==='HEAD'?null:body,{status:200,headers:{'Content-Type':type,'Cache-Control':path==='/'||path==='/predictions'||path==='/predictions/'?'public,max-age=60':'public,max-age=180','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'}});
 }
};
