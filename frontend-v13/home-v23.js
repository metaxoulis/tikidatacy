/* Tiki-Data v23 — SportAPI.ai only. No legacy API and no client-side secrets. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function verifiedLeagueLogo(name){const t=String(name||'').toLowerCase();const l=window.TIKI_LOGO_CATALOG?.leagues||{};const key=/(?:premier league|english premier)/i.test(t)?'epl':/bundesliga/i.test(t)?'bundesliga':/(?:la liga|laliga|primera divisi)/i.test(t)?'laliga':/serie a/i.test(t)?'seriea':/(?:ligue 1|ligue1)/i.test(t)?'ligue1':/(?:super league.*gree|greek super|greece.*super)/i.test(t)?'greece':null;return key?l[key]||null:null;}
const leagueEmblem=(name,explicit,key=null)=>{const l=window.TIKI_LOGO_CATALOG?.leagues||{};const trusted=x=>typeof x==='string'&&/^https:\/\/media\.api-sports\.io\/football\/leagues\/\d+\.png$/.test(x)?x:null;const u=safeLogo(explicit)||trusted(l[key])||verifiedLeagueLogo(name);return u?'<img class="home-league-logo" src="'+esc(u)+'" alt="" loading="lazy" decoding="async">':'';};
if(!$('featuredContent'))return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const initial=x=>String(x||'FC').trim().split(/\s+/).filter(w=>!/(?:FC|CF|AC|SC|AFC)$/i.test(w)).slice(0,2).map(x=>x[0]||'').join('').slice(0,3).toUpperCase()||'FC';
const safeLogo=x=>typeof x==='string'&&(/^\/api\/logo\/team\/\d{1,13}\?sig=[0-9a-f]{64}$/.test(x)||/^https:\/\/(?:apiv2\.)?allsportsapi\.com\/logo\/[a-zA-Z0-9_./%-]{1,180}\.(?:png|jpe?g|webp)$/i.test(x))?x:null;

const hNorm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
const hMap=new Map(Object.entries(window.TIKI_LOGO_CATALOG?.teams||{}).map(([key,value])=>[hNorm(key),value]));
const hAliases=new Map([
 ['bayern munich','fc bayern munchen'],['bayern münchen','fc bayern munchen'],
 ['valencia','valencia cf'],['real madrid','real madrid cf'],['sevilla','sevilla fc'],
 ['sunderland','sunderland afc'],['bournemouth','afc bournemouth'],
 ['olympiacos','olympiakos piraeus'],['olympiacos piraeus','olympiakos piraeus'],
 ['panathinaikos','panathinaikos'],['panetolikos','panetolikos'],
 ['athletic bilbao','athletic club'],['athletic club','athletic club'],
 ['rb leipzig','rb leipzig'],['asteras tripolis','asteras tripolis']
]);
const hSafeCatalog=x=>typeof x==='string'&&/^https:\/\/raw\.githubusercontent\.com\//.test(x)?x:null;
function hKnownTeamLogo(name){const key=hNorm(name);const target=hAliases.get(key)||key;return hSafeCatalog(hMap.get(target)||hMap.get(key))||null;}
document.addEventListener('error',e=>{const im=e.target;if(im?.tagName==='IMG'&&(im.classList.contains('home-crest-logo')||im.classList.contains('home-league-logo')))im.remove();},true);
const num=n=>typeof n==='number'&&Number.isFinite(n)?n:null;
const pct=n=>num(n)===null?'—':n.toLocaleString('el-GR',{maximumFractionDigits:1})+'%';
const fmtDate=new Intl.DateTimeFormat('el-GR',{weekday:'short',day:'numeric',month:'short'});
const fmtTime=new Intl.DateTimeFormat('el-GR',{hour:'2-digit',minute:'2-digit',hour12:false});
const isLive=m=>['LIVE','1H','2H','HT','ET','BREAK'].includes(m?.status);
const isDone=m=>['FT','AET','PEN','FINISHED','FULL_TIME'].includes(m?.status);
function crest(m,side){const name=m[side]||'Ομάδα';const url=safeLogo(m.logos?.[side]),known=hKnownTeamLogo(name);
  return '<span class="crest fallback">'+(known?'<img class="home-crest-logo" loading="lazy" decoding="async" src="'+esc(known)+'" alt="Έμβλημα '+esc(name)+'">':'')+(url?'<img class="home-crest-logo" loading="lazy" decoding="async" src="'+esc(url)+'" alt="Έμβλημα '+esc(name)+'">':'')+'<span>'+esc(initial(name))+'</span></span>';}
function when(m){const d=new Date(m.date);return Number.isNaN(d.getTime())?'Ώρα μη διαθέσιμη':fmtDate.format(d)+' · '+fmtTime.format(d);}
function score(m){return num(m.home_score)!==null&&num(m.away_score)!==null&&(isLive(m)||isDone(m))?m.home_score+' – '+m.away_score:'VS';}
function market(label,n){return '<div class="odd-row"><div class="odd-values"><span>'+esc(label)+'</span><b>'+pct(n)+'</b></div><div class="prob-bar"><span style="width:'+Math.max(0,Math.min(100,Number(n)||0))+'%"></span></div></div>';}
function markets(m){
 const p=m.model;
 if(!p)return '<div class="unavailable">Η στατιστική εκτίμηση δεν είναι διαθέσιμη.</div>';
 const vals=[p.p1,p.px,p.p2],best=vals.indexOf(Math.max(...vals));
 return '<div class="side-label">ΥΠΟΛΟΓΙΣΜΕΝΕΣ ΠΙΘΑΝΟΤΗΤΕΣ</div><div class="triple">'+['1','Χ','2'].map((n,i)=>'<div'+(i===best?' class="best"':'')+'><small>'+n+'</small><b>'+pct(vals[i])+'</b></div>').join('')+'</div><div class="other-markets"><div><small>OVER 2.5</small><b>'+pct(p.over25)+'</b></div><div><small>GG / BTTS</small><b>'+pct(p.btts)+'</b></div></div>'+
 '<div class="forecast-result"><span>Πιθανότερο σκορ (εκτίμηση)</span><strong>'+esc(p.most_likely_score?.score||'—')+'</strong><small>'+pct(p.most_likely_score?.probability)+'</small></div>'+ '<p class="model-note">'+(p.method==='openfootball_cc0_fitted_venue_poisson'?'Πειραματικό μοντέλο από καταγεγραμμένα ιστορικά αποτελέσματα · '+esc(p.data_points)+' αγώνες · στοιχεία έως '+esc(p.history_latest):'Πολύ χαμηλή αξιοπιστία: δεν υπάρχουν επιβεβαιωμένα ιστορικά στοιχεία των δύο ομάδων. Χρησιμοποιείται γενικό υπόδειγμα, όχι εξατομικευμένη πρόβλεψη.')+' Καμία εκτίμηση δεν έχει πιστοποιημένη ακρίβεια.</p>';
}
function featured(m){
 if(!m){$('featuredContent').innerHTML='<div class="loading">Δεν υπάρχουν επερχόμενοι αγώνες με επαρκή τεκμηριωμένα ιστορικά στοιχεία για το επόμενο τριήμερο.</div>';return;}
 $('featuredContent').innerHTML='<div class="feature-top"><b>'+leagueEmblem(m.league,m.league_logo,m.league_key)+esc(m.league)+'</b><span>'+(isLive(m)?'● LIVE':isDone(m)?'ΤΕΛΙΚΟ':'ΕΠΟΜΕΝΟΣ ΑΓΩΝΑΣ')+' · '+esc(when(m))+'</span></div>'+
 '<div class="feature-grid"><div class="feature-main"><div class="featured-teams"><div class="ft-team">'+crest(m,'home')+'<b>'+esc(m.home)+'</b></div><div class="vs"><strong>'+esc(score(m))+'</strong>'+(isLive(m)?'LIVE':'FOOTBALL')+'</div><div class="ft-team">'+crest(m,'away')+'<b>'+esc(m.away)+'</b></div></div><div class="feat-bottom"><span class="f-league">'+leagueEmblem(m.league,m.league_logo,m.league_key)+esc(m.league)+'</span><a href="/predictions" class="feat-details">Πλήρη στοιχεία αγώνα →</a></div></div><aside class="feature-side">'+markets(m)+'</aside></div>';
 $('featuredContent').setAttribute('aria-busy','false');
}
function upcoming(matches){
 const wrap=$('upcomingGrid'),items=Array.isArray(matches)?matches.slice(0,6):[];document.querySelector('.upcoming-heading').hidden=!items.length;wrap.hidden=!items.length;
 if(!items.length){wrap.replaceChildren();}
 else wrap.innerHTML=items.map(m=>'<article class="upcoming-card"><div class="up-meta"><span>'+leagueEmblem(m.league,m.league_logo,m.league_key)+esc(m.league)+'</span><span>'+esc(when(m))+'</span></div><div class="up-match"><div class="up-team">'+crest(m,'home')+'<b>'+esc(m.home)+'</b></div><span class="up-versus">'+esc(score(m))+'</span><div class="up-team">'+crest(m,'away')+'<b>'+esc(m.away)+'</b></div></div><div class="up-footer"><span>'+(m.model?'1 '+pct(m.model.p1)+' · Χ '+pct(m.model.px)+' · 2 '+pct(m.model.p2)+'<br><small>'+esc(m.model.method==='openfootball_cc0_fitted_venue_poisson'?'Ιστορικό Poisson · πειραματικό':'Γενικό Poisson · πολύ χαμηλή αξιοπιστία')+'</small>':'Χωρίς εκτίμηση')+'</span><a href="/predictions">Στοιχεία ↗</a></div></article>').join('');
 wrap.setAttribute('aria-busy','false');
}
let controller=null,fetching=false;
async function load(){
 if(fetching)return;fetching=true;controller=new AbortController();
 try{
  const res=await fetch('/api/home-focus',{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!res.ok)throw new Error(res.status===429?'quota':'feed');
  const data=await res.json();if(!Array.isArray(data.upcoming)||!data.coverage)throw Error('invalid_feed');
  $('metricMatches').textContent=String(data.coverage?.matches??'—');
  $('metricLeagues').textContent=String(data.coverage?.competitions??'—');
  featured(data.featured);upcoming(data.upcoming);
  $('metricSource').textContent=String(data.model?.historical_matches??'—');
  const t=new Date(data.updated_at);
  $('refreshStatus').textContent='Ενημερώθηκε '+(Number.isNaN(t.getTime())?'πρόσφατα':fmtTime.format(t));
 }catch{
  $('featuredContent').innerHTML='<div class="loading">Τα δεδομένα των επιλεγμένων πρωταθλημάτων δεν είναι διαθέσιμα αυτή τη στιγμή.</div>';
  $('featuredContent').setAttribute('aria-busy','false');
  $('upcomingGrid').hidden=true;document.querySelector('.upcoming-heading').hidden=true;$('upcomingGrid').innerHTML='';
  $('upcomingGrid').setAttribute('aria-busy','false');
  $('refreshStatus').textContent='Η ενημέρωση δεν είναι διαθέσιμη';
 }finally{fetching=false;}
}
$('year').textContent=String(new Date().getFullYear());
void load();
setInterval(()=>{if(!document.hidden)void load()},180000);
})();