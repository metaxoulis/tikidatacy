/* Tiki-Data Match Center: independently versioned Pages advanced-mode Worker.
 * Keeps existing immutable reviewed Match Center backend/HTML as upstream.
 * Fetches verified logo mappings LIVE from the D1 binding DB.
 */
const UPSTREAM='https://4751cad8.tiki-data-matchcenter.pages.dev';
const LOGO_SCRIPT="/* Tiki-Data Match Center: D1 verified team/league images without changing the OpenFootball UI. */\n(()=>{\n  'use strict';\n  const ui=window.TikiUI;\n  if(!ui||typeof ui.emblem!=='function'||!ui.logos)return;\n  const original=ui.emblem;\n  const normalize=s=>String(s||'').normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^\\p{L}\\p{N}]+/gu,' ').trim().toLowerCase();\n  const aliases=new Map([\n    ['olympiacos piraeus','olympiakos piraeus'],\n    ['olympiacos','olympiakos piraeus']\n  ]);\n  const allowedHosts=new Set(['raw.githubusercontent.com','media.api-sports.io']);\n  const safeUrl=u=>{\n    try{const x=new URL(u);return x.protocol==='https:'&&allowedHosts.has(x.hostname)?x.href:null}\n    catch{return null}\n  };\n  const escape=s=>String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\n  const maps={teams:new Map(),leagues:new Map()};\n  function resolve(kind,name){\n    const key=normalize(name),target=aliases.get(key)||key;\n    return maps[kind]?.get(target)||maps[kind]?.get(key)||null;\n  }\n  function applyToExisting(){\n    document.querySelectorAll('.emblem[data-logo-name]').forEach(node=>{\n      const kind=node.getAttribute('data-logo-kind')==='leagues'?'leagues':'teams';\n      const name=node.getAttribute('data-logo-name');\n      const src=resolve(kind,name);\n      if(!src)return;\n      const image=node.querySelector('img');\n      if(image){\n        if(image.src!==src)image.src=src;\n        return;\n      }\n      const img=document.createElement('img');\n      img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';\n      img.src=src;\n      img.addEventListener('error',()=>img.remove(),{once:true});\n      node.appendChild(img);\n    });\n  }\n  ui.emblem=(name,kind='teams',size='')=>{\n    const category=kind==='leagues'?'leagues':'teams';\n    const src=resolve(category,name);\n    if(src)ui.logos[category][name]=src;\n    const markup=original(name,kind,size);\n    return markup.replace('<span class=\"emblem ','<span data-logo-name=\"'+escape(name)+'\" data-logo-kind=\"'+category+'\" class=\"emblem ');\n  };\n  async function load(){\n    try{\n      const resp=await fetch('/api/logos',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000)});\n      if(!resp.ok)throw new Error('logos endpoint '+resp.status);\n      const data=await resp.json();\n      if(!data.ok)throw new Error(data.error||'logo data unavailable');\n      for(const kind of ['teams','leagues']){\n        for(const item of data[kind]||[]){\n          const src=safeUrl(item.logo_url);\n          if(!src||!item.display_name)continue;\n          maps[kind].set(normalize(item.display_name),src);\n          if(item.entity_key)maps[kind].set(normalize(item.entity_key),src);\n          ui.logos[kind][item.display_name]=src;\n          if(item.entity_key)ui.logos[kind][item.entity_key]=src;\n        }\n      }\n      for(const [alias,target] of aliases){\n        const url=maps.teams.get(target);\n        if(url)maps.teams.set(alias,url);\n      }\n      applyToExisting();\n      window.dispatchEvent(new CustomEvent('tiki:logos-loaded',{detail:{teams:maps.teams.size,leagues:maps.leagues.size}}));\n    }catch(error){\n      console.warn('Match Center crests unavailable. Retaining local emblems:',String(error?.message||error));\n    }\n  }\n  // The app script runs normally while logos load. The existing SVG placeholders remain visible until\n  // the verified D1 image URLs arrive, avoiding layout shift or an API dependency for fixture display.\n  void load();\n})();";

const LOGO_CSS="/* Tiki-Data Match Center v15 — safe contrast treatment for transparent crests.\n * The actual logo pixels are never recolored; only their presentation backing changes.\n */\n.emblem{\n  background:linear-gradient(145deg,#f3f7fa 0%,#d4e2e9 100%)!important;\n  border:1px solid #9bbcca!important;\n  color:#286074!important;\n  box-shadow:inset 0 1px 2px #ffffffaf,0 3px 10px #07172552;\n  isolation:isolate;\n}\n.emblem svg{color:#246479;filter:drop-shadow(0 1px 0 #ffffff8f)}\n.emblem img{\n  inset:0;\n  width:100%;\n  height:100%;\n  object-fit:contain;\n  background:transparent!important;\n  padding:9%;\n  border-radius:inherit;\n  filter:drop-shadow(0 0 1.1px #152f3ca3) drop-shadow(0 1px 1px #0b273c70);\n}\n.emblem-small img,.league-btn .emblem img{padding:7%}\n.emblem-large img{padding:11%}\n.match-card:hover .emblem,.league-btn:hover .emblem{\n  border-color:#a9d6dc!important;\n  box-shadow:0 0 0 1px #87dbc355,0 3px 12px #04121e73;\n}\n@media(max-width:600px){\n  .emblem{box-shadow:inset 0 1px 2px #ffffffaf,0 2px 5px #06182b55}\n}\n";
function reply(body,status=200,headers={}){
  return new Response(body,{status,headers:{
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    ...headers
  }});
}
function json(data,status=200){
  return reply(JSON.stringify(data),status,{'Content-Type':'application/json; charset=utf-8'});
}
async function readLogoAssets(env){
  if(!env.DB)return {ok:false,error:'database_binding_missing'};
  try{
    const result=await env.DB.prepare('SELECT entity_type, entity_key, display_name, logo_url FROM logo_assets ORDER BY entity_type, entity_key').all();
    const teams=[],leagues=[];
    for(const row of result.results||[]){
      if(!row.logo_url||!row.display_name)continue;
      const item={entity_key:row.entity_key,display_name:row.display_name,logo_url:row.logo_url};
      if(row.entity_type==='team')teams.push(item);
      if(row.entity_type==='league')leagues.push(item);
    }
    return {ok:true,source:'tiki_data_lab.logo_assets',teams,leagues,counts:{teams:teams.length,league_seasons:leagues.length}};
  }catch(error){
    console.error('matchcenter.logo_assets D1 query failed',String(error?.message||error));
    return {ok:false,error:'logo_lookup_failed'};
  }
}
async function fromBaseline(request,url){
  const destination=new URL(url.pathname+url.search,UPSTREAM);
  // Pin backend and original static assets to the LAST reviewed immutable preview.
  return fetch(new Request(destination,request));
}
export default {
  async fetch(request,env){
    const u=new URL(request.url),path=u.pathname;
    if(!['GET','HEAD','OPTIONS'].includes(request.method))return json({ok:false,error:'read_only_matchcenter'},405);
    if(path==='/api/logos'){
      const result=await readLogoAssets(env);
      return json(result,result.ok?200:503);
    }
    if(path==='/logo-contrast.css')return reply(LOGO_CSS,200,{'Content-Type':'text/css; charset=utf-8','Cache-Control':'public,max-age=300'});
    if(path==='/logo-bridge.js'){
      return reply(LOGO_SCRIPT,200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'public, max-age=300'});
    }
    if(path==='/__tiki/health'){
      const logos=await readLogoAssets(env);
      let status='unavailable',upstreamStatus=0;
      try{
        const upstream=await fromBaseline(new Request(new URL('/api/summary',UPSTREAM),{method:'GET'}),new URL('/api/summary',UPSTREAM));
        upstreamStatus=upstream.status;
        status=upstream.ok?'connected':'upstream_error';
      }catch(e){console.error('Match Center API health check',String(e?.message||e))}
      const ok=status==='connected'&&logos.ok;
      return json({ok,service:'tiki-data-matchcenter',api:status,upstream_http:upstreamStatus,logos_ok:logos.ok,counts:logos.counts||null},ok?200:503);
    }
    let upstream;
    try{
      upstream=await fromBaseline(request,u);
    }catch(e){
      console.error('Match Center upstream request failed',path,String(e?.message||e));
      return json({ok:false,error:'matchcenter_upstream_unavailable'},502);
    }
    // Preserve the baseline CSS, JS and all existing /api routes exactly.
    // Insert our lightweight logo bridge in execution order: ui.js -> bridge -> app.js.
    if((path==='/'||path==='/index.html') && upstream.ok && (upstream.headers.get('content-type')||'').includes('text/html')){
      const headers=new Headers(upstream.headers);
      headers.set('Cache-Control','no-store');
      headers.delete('Content-Length');
      const html=new HTMLRewriter().on('head',{element(element){element.append('<link rel="stylesheet" href="/logo-contrast.css">',{html:true})}}).on('script[src="./app.js"]',{
        element(element){element.before('<script defer src="/logo-bridge.js"></script>',{html:true})}
      }).transform(new Response(upstream.body,{status:upstream.status,headers}));
      return html;
    }
    return upstream;
  }
};