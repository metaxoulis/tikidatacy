/* Tiki-Data Match Center: D1 verified team/league images without changing the OpenFootball UI. */
(()=>{
  'use strict';
  const ui=window.TikiUI;
  if(!ui||typeof ui.emblem!=='function'||!ui.logos)return;
  const original=ui.emblem;
  const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
  const aliases=new Map([
    ['olympiacos piraeus','olympiakos piraeus'],
    ['olympiacos','olympiakos piraeus']
  ]);
  const allowedHosts=new Set(['raw.githubusercontent.com','media.api-sports.io']);
  const safeUrl=u=>{
    try{const x=new URL(u);return x.protocol==='https:'&&allowedHosts.has(x.hostname)?x.href:null}
    catch{return null}
  };
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const maps={teams:new Map(),leagues:new Map()};
  function resolve(kind,name){
    const key=normalize(name),target=aliases.get(key)||key;
    return maps[kind]?.get(target)||maps[kind]?.get(key)||null;
  }
  function applyToExisting(){
    document.querySelectorAll('.emblem[data-logo-name]').forEach(node=>{
      const kind=node.getAttribute('data-logo-kind')==='leagues'?'leagues':'teams';
      const name=node.getAttribute('data-logo-name');
      const src=resolve(kind,name);
      if(!src)return;
      const image=node.querySelector('img');
      if(image){
        if(image.src!==src)image.src=src;
        return;
      }
      const img=document.createElement('img');
      img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
      img.src=src;
      img.addEventListener('error',()=>img.remove(),{once:true});
      node.appendChild(img);
    });
  }
  ui.emblem=(name,kind='teams',size='')=>{
    const category=kind==='leagues'?'leagues':'teams';
    const src=resolve(category,name);
    if(src)ui.logos[category][name]=src;
    const markup=original(name,kind,size);
    return markup.replace('<span class="emblem ','<span data-logo-name="'+escape(name)+'" data-logo-kind="'+category+'" class="emblem ');
  };
  async function load(){
    try{
      const resp=await fetch('/api/logos',{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(!resp.ok)throw new Error('logos endpoint '+resp.status);
      const data=await resp.json();
      if(!data.ok)throw new Error(data.error||'logo data unavailable');
      for(const kind of ['teams','leagues']){
        for(const item of data[kind]||[]){
          const src=safeUrl(item.logo_url);
          if(!src||!item.display_name)continue;
          maps[kind].set(normalize(item.display_name),src);
          if(item.entity_key)maps[kind].set(normalize(item.entity_key),src);
          ui.logos[kind][item.display_name]=src;
          if(item.entity_key)ui.logos[kind][item.entity_key]=src;
        }
      }
      for(const [alias,target] of aliases){
        const url=maps.teams.get(target);
        if(url)maps.teams.set(alias,url);
      }
      applyToExisting();
      window.dispatchEvent(new CustomEvent('tiki:logos-loaded',{detail:{teams:maps.teams.size,leagues:maps.leagues.size}}));
    }catch(error){
      console.warn('Match Center crests unavailable. Retaining local emblems:',String(error?.message||error));
    }
  }
  // The app script runs normally while logos load. The existing SVG placeholders remain visible until
  // the verified D1 image URLs arrive, avoiding layout shift or an API dependency for fixture display.
  void load();
})();