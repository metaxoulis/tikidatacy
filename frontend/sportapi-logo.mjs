/* Authenticated logo streaming from SportAPI.ai only.
 * Tokens are HMAC links to IDs present in a public fixture response.
 * Never expose Cloudflare SPORTAPI_AI_KEY to users or GitHub.
 */
const tdLogoId=s=>/^\d{1,13}$/.test(String(s??''))?String(s):null;
async function tdLogoKey(secret){return crypto.subtle.importKey('raw',new TextEncoder().encode('tiki-logo-v1:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function tdSignedLogo(secret,id){id=tdLogoId(id);if(!id)return null;const key=await tdLogoKey(secret);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('sportapi-team:'+id)));const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return '/api/logo/team/'+id+'?sig='+hex;}
async function tdServeLogo(req,env,ctx,url){
 const id=tdLogoId(url.pathname.split('/').at(-1)),sig=url.searchParams.get('sig');
 if(!id||!sig||!/^[0-9a-f]{64}$/.test(sig)||!env?.SPORTAPI_AI_KEY)return new Response('Not Found',{status:404});
 const key=await tdLogoKey(env.SPORTAPI_AI_KEY);const raw=new Uint8Array(sig.match(/../g).map(x=>parseInt(x,16)));
 if(!await crypto.subtle.verify('HMAC',key,raw,new TextEncoder().encode('sportapi-team:'+id)))return new Response('Forbidden',{status:403});
 const cacheReq=new Request('https://tiki-logo-cache.local/team/'+id);
 try{const cached=await caches.default.match(cacheReq);if(cached)return cached;}catch{}
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),6500);
 try{
  const r=await fetch('https://sportapi.ai/api/teams/'+id+'/logo',{headers:{'X-Api-Key':env.SPORTAPI_AI_KEY,Accept:'image/png,image/webp,image/jpeg,image/svg+xml'},redirect:'manual',signal:c.signal});
  if(!r.ok)return new Response('Image unavailable',{status:r.status===429?429:404,headers:{'Cache-Control':'no-store'}});
  const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
  const allowed=['image/png','image/jpeg','image/webp','image/svg+xml'];
  if(!allowed.includes(type)||Number(r.headers.get('content-length')||0)>260000)return new Response('Unsupported image',{status:415});
  const bytes=await r.arrayBuffer();if(bytes.byteLength>260000||bytes.byteLength<32)return new Response('Invalid image',{status:415});
  const h=new Headers({'Content-Type':type,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});
  const response=new Response(bytes,{status:200,headers:h});try{ctx?.waitUntil?.(caches.default.put(cacheReq,response.clone()))}catch{}
  return response;
 }catch{return new Response('Logo temporarily unavailable',{status:503});}finally{clearTimeout(timer)}
}
export {tdSignedLogo,tdServeLogo};