(()=>{
'use strict';
const IS_PREDICTIONS=location.pathname.startsWith('/predictions');
if(!IS_PREDICTIONS)return; // this controller must never initialize homepage-only DOM.
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ICON_PATHS={"star":"<path d=\"m12 2 3.1 6.5 7.2 1-5.2 5 1.2 7-6.3-3.5-6.3 3.5 1.2-7-5.2-5 7.2-1z\"/>","calendarOff":"<path d=\"M10 3v4M17 3v4M3 10h18\"/><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"m3 3 18 18\"/>","info":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 11v6M12 7h.01\"/>","shield":"<path d=\"M12 2 4 6v6c0 5 3.8 8 8 10 4.2-2 8-5 8-10V6z\"/><path d=\"m9 12 2 2 4-4\"/>","layers":"<path d=\"m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5\"/>","alert":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 7v6m0 4h.01\"/>","check":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m7 12 3.3 3.3L17 9\"/>","chevron":"<path d=\"m9 18 6-6-6-6\"/>"};
function icon(name,extra=''){return '<svg class="ui-icon'+(extra?' '+extra:'')+'" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICON_PATHS[name]||ICON_PATHS.info)+'</svg>'}
function skel(cls){return '<span class="skel '+cls+'" aria-hidden="true"></span>'}
function pairPreferred(a,b){return num(a)!==null&&num(b)!==null&&a>=0&&a<=100&&b>=0&&b<=100&&a!==b?(a>b?0:1):-1}
function renderLoading(){
  document.body.classList.add('is-loading');
  const side=$('#sidebarLeagues'),mobile=$('#mobileLeagues'),dates=$('#dateTabs');
  if(IS_PREDICTIONS){
    if(side){side.setAttribute('aria-busy','true');side.innerHTML=Array.from({length:6},()=>'<div class="skel-league">'+skel('skel-circle')+skel('skel-line')+'</div>').join('')}
    if(mobile){mobile.setAttribute('aria-busy','true');mobile.innerHTML=Array.from({length:4},()=>skel('skel-tab')).join('')}
    if(dates){dates.setAttribute('aria-busy','true');dates.innerHTML=Array.from({length:5},()=>skel('skel-date')).join('')}
    if($('#matchesCount'))$('#matchesCount').innerHTML=skel('skel-line');
    const rows=$('#matchRows');
    if(rows){rows.innerHTML=Array.from({length:6},()=>'<tr class="skel-table-row"><td>'+skel('skel-time')+'</td><td>'+skel('skel-small-circle')+'</td><td><div class="skel-team-group">'+skel('skel-small-circle')+skel('skel-fixture')+'</div></td>'+Array.from({length:6},()=>'<td>'+skel('skel-probcell')+'</td>').join('')+'<td>'+skel('skel-small-circle')+'</td></tr>').join('');rows.setAttribute('aria-busy','true')}
    if($('#loadMore'))$('#loadMore').hidden=true;
    if($('#feedStatus'))$('#feedStatus').innerHTML=skel('skel-line');
  }else{
    for(const id of ['metricMatches','metricLeagues','metricAnalyses']){const el=$('#'+id);if(el)el.innerHTML=skel('skel-metric')}
    for(const id of ['spotLeague','spotDate','spotLabel']){const el=$('#'+id);if(el)el.innerHTML=skel('skel-line')}
    for(const id of ['spotHome','spotAway']){const el=$('#'+id);if(el)el.innerHTML=skel('skel-crest')+skel('skel-team')}
    if($('#spotForm'))$('#spotForm').innerHTML='<div class="form-empty-inner">'+skel('skel-line')+'</div>';
    if($('#spotPred'))$('#spotPred').innerHTML=Array.from({length:3},()=>'<div class="feature-prob skel-prob">'+skel('skel-line')+skel('skel-num')+skel('skel-track')+'</div>').join('');
    if($('#spotMarkets'))$('#spotMarkets').innerHTML=Array.from({length:4},()=>'<div class="market skel-market">'+skel('skel-line')+skel('skel-num')+'</div>').join('');
    if($('#statsHome'))$('#statsHome').innerHTML=skel('skel-line');
    if($('#statsAway'))$('#statsAway').innerHTML=skel('skel-line');
    if($('#statsCompare'))$('#statsCompare').innerHTML=Array.from({length:3},()=>'<div class="skel-stat">'+skel('skel-value')+skel('skel-label')+skel('skel-value')+'</div>').join('');
    const upcoming=$('#upcomingGrid');
    if(upcoming){upcoming.innerHTML=Array.from({length:3},()=>'<div class="upcoming-card upcoming-skeleton"><div class="upcoming-card-head">'+skel('skel-line')+skel('skel-time')+'</div><div class="upcoming-teams">'+skel('skel-circle')+skel('skel-fixture')+skel('skel-circle')+'</div>'+skel('skel-probcell')+'</div>').join('');upcoming.setAttribute('aria-busy','true')}
    if($('#spotDetails'))$('#spotDetails').disabled=true;
    if($('#statsAnalyze'))$('#statsAnalyze').disabled=true;
  }
  for(const id of ['featured','statsCompare','spotPred','spotMarkets'])$('#'+id)?.setAttribute('aria-busy','true');
}
function finishLoading(){document.body.classList.remove('is-loading');for(const id of ['sidebarLeagues','mobileLeagues','dateTabs','matchRows','featured','statsCompare','spotPred','spotMarkets','upcomingGrid'])$('#'+id)?.setAttribute('aria-busy','false')}
function formEmpty(){return '<div class="form-empty-inner" role="status">'+icon('calendarOff')+'<span>Δεν υπάρχουν διαθέσιμα στοιχεία πρόσφατης φόρμας</span></div>'}

const LEAGUES={ucl:['UEFA Champions League','UCL'],uel:['UEFA Europa League','UEL'],uecl:['UEFA Conference League','UECL'],epl:['Premier League','PL'],laliga:['La Liga','LL'],bundesliga:['Bundesliga','BL'],seriea:['Serie A','SA'],ligue1:['Ligue 1','L1'],greece:['Greek Super League','GSL'],cyprus:['Cyprus First Division','CYP']};
const CRESTS={'Chelsea FC':61,'Everton FC':62,'Liverpool FC':64,'Manchester City FC':65,'Manchester United FC':66,'Arsenal FC':57,'Tottenham Hotspur FC':73,'Newcastle United FC':67,'Aston Villa FC':58,'West Ham United FC':563,'Borussia Dortmund':4,'FC Bayern München':5,'Bayer 04 Leverkusen':3,'RB Leipzig':721,'VfB Stuttgart':10,'Eintracht Frankfurt':19,'SSC Napoli':113,'AC Milan':98,'Juventus FC':109,'FC Internazionale Milano':108,'AS Roma':100,'FC Barcelona':81,'Real Madrid CF':86,'Club Atlético de Madrid':78,'Paris Saint-Germain FC':524,'Olympique de Marseille':516,'Olympique Lyonnais':523,'AS Monaco FC':548};
const STORAGE='tiki-data-favorites-v13';
function readFavorites(){try{return new Set(JSON.parse(localStorage.getItem(STORAGE)||'[]').map(String))}catch{return new Set()}}
const params=new URLSearchParams(location.search);
const allowedFilters=new Set(['all','predicted','favorites']);
const initialSource='verified';
const isoDateShift=n=>{const x=new Date();x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const state={all:[],source:initialSource,apiDate:/^\d{4}-\d{2}-\d{2}$/.test(params.get('date')||'')?params.get('date'):isoDateShift(0),leagueImages:new Map(),requestId:0,league:'all',day:'all',mode:IS_PREDICTIONS&&allowedFilters.has(params.get('filter'))?params.get('filter'):'all',query:IS_PREDICTIONS?String(params.get('q')||'').trim().toLocaleLowerCase():'',limit:100,selectedId:null,featuredId:null,feed:'loading',error:'',favorites:readFavorites(),modalRestore:null};
const lname=s=>LEAGUES[s]?.[0]||String(s||'Άλλη διοργάνωση').replace(/[-_]/g,' ');
const labbr=s=>LEAGUES[s]?.[1]||String(s||'').slice(0,3).toUpperCase();
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const pct=v=>num(v)===null?'—':v.toLocaleString('el-GR',{maximumFractionDigits:1})+'%';
const kt=d=>{const x=new Date(d);return Number.isNaN(+x)?'unknown':x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const dateFmt=(d,mode='short')=>new Intl.DateTimeFormat('el-GR',mode==='full'?{weekday:'long',day:'numeric',month:'long'}:mode==='weekday'?{weekday:'short',day:'numeric',month:'short'}:{day:'2-digit',month:'2-digit'}).format(new Date(d));
const clock=d=>new Intl.DateTimeFormat('el-GR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
function valid(m){return [m.p1,m.px,m.p2].every(v=>num(v)!==null&&v>=0&&v<=100)&&Math.abs(m.p1+m.px+m.p2-100)<2}
/* Club/league image catalog is built from already verified D1 mappings. */
const LOGO_CATALOG=window.TIKI_LOGO_CATALOG||{teams:{},leagues:{}};
const safeSignedLogo=u=>typeof u==='string'&&/^\/api\/logo\/team\/\d{1,13}\?sig=[0-9a-f]{64}$/.test(u)?u:null;
function verifiedLeagueLogo(name){const t=String(name||'').toLowerCase();const l=window.TIKI_LOGO_CATALOG?.leagues||{};const key=/(?:premier league|english premier)/i.test(t)?'epl':/bundesliga/i.test(t)?'bundesliga':/(?:la liga|laliga|primera divisi)/i.test(t)?'laliga':/serie a/i.test(t)?'seriea':/(?:ligue 1|ligue1)/i.test(t)?'ligue1':/(?:super league.*gree|greek super|greece.*super)/i.test(t)?'greece':null;return key?l[key]||null:null;}
const logoNorm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
const safeLogo=u=>typeof u==='string'&&/^https:\/\/(?:raw\.githubusercontent\.com|media\.api-sports\.io|cdn\.sportmonks\.com)\//.test(u)?u:null;
const sportmonksLogo=u=>typeof u==='string'&&/^https:\/\/cdn\.sportmonks\.com\/images\/[a-zA-Z0-9/_%.\-]+\.(?:png|jpe?g|svg|webp)$/i.test(u)?u:null;
const allSportsLogo=u=>typeof u==='string'&&/^https:\/\/(?:apiv2\.)?allsportsapi\.com\/logo\/[a-zA-Z0-9_./%-]{1,180}\.(?:png|jpe?g|webp)$/i.test(u)?u:null;
const teamImages=new Map(),shortImages=new Map();
const shorten=s=>logoNorm(s).replace(/\b(?:fc|afc|cf|sc|ac)\b/g,'').replace(/\s+/g,' ').trim();
for(const [name,href] of Object.entries(LOGO_CATALOG.teams||{})){const u=safeLogo(href);if(!u)continue;teamImages.set(logoNorm(name),u);const short=shorten(name);if(shortImages.has(short)&&shortImages.get(short)!==u)shortImages.set(short,null);else if(!shortImages.has(short))shortImages.set(short,u)}
const teamAliases=new Map([['olympiacos piraeus','olympiakos piraeus'],['olympiacos','olympiakos piraeus'],['bayern munich','fc bayern munchen'],['bayern münchen','fc bayern munchen'],['valencia','valencia cf'],['real madrid','real madrid cf'],['sevilla','sevilla fc'],['sunderland','sunderland afc'],['bournemouth','afc bournemouth'],['athletic bilbao','athletic club'],['panathinaikos fc','panathinaikos'],['asteras tripolis fc','asteras tripolis'],['panetolikos fc','panetolikos']]);
function realTeamLogo(name){const key=logoNorm(name);return teamImages.get(key)||teamImages.get(teamAliases.get(key))||shortImages.get(shorten(name))||null}
function logoImage(url,cls='logo-image'){return '<img class="'+esc(cls)+'" src="'+esc(url)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'}
function crest(name,cls='table-crest',providerURL=null){
 const n=String(name||''),initials=n.replace(/\b(fc|cf|sc|ac|afc|sv|club)\b/gi,'').trim().split(/\s+/).slice(0,2).map(a=>a[0]||'').join('').toUpperCase()||'FC';
 const verified=realTeamLogo(n),provider=sportmonksLogo(providerURL),hasReal=!!(verified||provider);
 return '<span class="'+esc(cls)+(hasReal?' has-team-logo':' team-no-logo')+'" title="'+esc(n)+'" aria-label="Έμβλημα '+esc(n)+'"><span class="team-initials">'+esc(initials)+'</span>'
 +(verified?logoImage(verified,'logo-image team-logo-image'):'')
 +(provider&&provider!==verified?logoImage(provider,'logo-image team-logo-image'):'')+'</span>';
}
function competition(s,cls='small-league',key=null){const logo=sportmonksLogo(state.leagueImages.get(s))||safeLogo(LOGO_CATALOG.leagues?.[key]||LOGO_CATALOG.leagues?.[s]||verifiedLeagueLogo(s));const short=labbr(s);return '<span class="'+esc(cls)+(logo?' has-real-logo':'')+'" title="'+esc(lname(s))+'" data-short="'+esc(short)+'">'+(logo?logoImage(logo,'logo-image league-image'):'<span class="league-fallback">'+esc(short)+'</span>')+'</span>'}
function filteredBase(){let list=state.all.filter(m=>(state.league==='all'||m.league===state.league)&&(state.mode!=='predicted'||(valid(m)&&m.coverage!=='no_team_specific_evidence'))&&(state.mode!=='favorites'||state.favorites.has(String(m.id)))&&(!state.query||(m.home+' '+m.away+' '+lname(m.league)).toLocaleLowerCase().includes(state.query)));return list}
function filtered(){return filteredBase().filter(m=>state.day==='all'||kt(m.date)===state.day)}
function hasFilters(){return state.league!=='all'||state.day!=='all'||state.mode!=='all'||!!state.query}
function syncSearch(){for(const s of ['#globalSearch','#fixtureSearch']){const el=$(s);if(el&&el.value!==state.query)el.value=state.query}}
function resetAllFilters(){
 state.league='all';state.day='all';state.mode='all';state.query='';state.limit=100;
 try{history.replaceState(null,'',location.pathname)}catch{}
 syncSearch();update();
}
function setMode(next){if(!IS_PREDICTIONS){location.href='/predictions?filter='+encodeURIComponent(next);return}if(next==='all'){resetAllFilters();return}state.mode=next;state.limit=100;state.day='all';update()}
function setLeague(next){if(!IS_PREDICTIONS){location.href='/predictions';return}if(next==='all'){resetAllFilters();return}state.league=next;state.mode='all';state.day='all';state.query='';state.limit=100;syncSearch();update()}
function setDay(next){state.day=next;state.limit=100;update()}
function renderFilterNotice(){
 const panel=$('#filterNotice');if(!panel)return;
 panel.hidden=!hasFilters();if(panel.hidden)return;
 const parts=[];if(state.league!=='all')parts.push(lname(state.league));
 if(state.mode==='favorites')parts.push('Αγαπημένα');else if(state.mode==='predicted')parts.push('Με ιστορικά');
 if(state.day!=='all')parts.push('Συγκεκριμένη ημέρα');
 if(state.query)parts.push('Αναζήτηση: '+state.query);
 $('#filterNoticeText').textContent='Ενεργά φίλτρα: '+parts.join(' · ');
}
function renderLeagues(){if(!IS_PREDICTIONS)return;if($('#sideFavCount'))$('#sideFavCount').textContent=String(state.favorites.size);const leagues=[...new Set(state.all.map(m=>m.league))].sort((a,b)=>lname(a).localeCompare(lname(b),'el'));const total=state.all.length;
$('#sidebarLeagues').innerHTML='<button class="side-league'+(state.league==='all'?' selected':'')+'" data-league="all" aria-pressed="'+(state.league==='all')+'"><span class="league-badge">ALL</span><span class="lname">Όλες οι διοργανώσεις</span><span class="side-count">'+total+'</span></button>'+leagues.map(s=>'<button class="side-league'+(state.league===s?' selected':'')+'" data-league="'+esc(s)+'" aria-pressed="'+(state.league===s)+'">'+competition(s,'league-badge',state.all.find(m=>m.league===s)?.league_key)+'<span class="lname">'+esc(lname(s))+'</span><span class="side-count">'+state.all.filter(m=>m.league===s).length+'</span></button>').join('');
const scroller=$('#mobileLeagues'),scroll=scroller.scrollLeft;
scroller.innerHTML='<button class="league-tab'+(state.league==='all'?' selected':'')+'" data-league="all" aria-pressed="'+(state.league==='all')+'"><span class="tab-league">ALL</span> Όλες <small>'+total+'</small></button>'+leagues.map(s=>'<button class="league-tab'+(state.league===s?' selected':'')+'" data-league="'+esc(s)+'" aria-pressed="'+(state.league===s)+'">'+competition(s,'tab-league',state.all.find(m=>m.league===s)?.league_key)+' '+esc(lname(s))+' <small>'+state.all.filter(m=>m.league===s).length+'</small></button>').join('');
scroller.scrollLeft=scroll;
}
function renderDates(){if(!IS_PREDICTIONS)return;const base=filteredBase();const days=[...new Map(base.map(m=>[kt(m.date),m.date])).entries()].filter(x=>x[0]!=='unknown').sort((a,b)=>a[0].localeCompare(b[0]));const old=$('#dateTabs').scrollLeft;$('#dateTabs').innerHTML='<button class="day-btn'+(state.day==='all'?' selected':'')+'" data-day="all" aria-pressed="'+(state.day==='all')+'"><strong>Όλες</strong>οι ημέρες</button>'+days.map(([key,raw])=>'<button class="day-btn'+(state.day===key?' selected':'')+'" data-day="'+esc(key)+'" aria-pressed="'+(state.day===key)+'"><strong>'+esc(dateFmt(raw,'weekday'))+'</strong>'+base.filter(m=>kt(m.date)===key).length+' αγώνες</button>').join('');$('#dateTabs').scrollLeft=old}
function drawMode(){ $$('[data-quick]').forEach(el=>{const on=el.dataset.quick===state.mode;el.classList.toggle('is-active',on);el.classList.toggle('active',on);el.classList.toggle('selected',on)});$$('[data-nav]').forEach(el=>el.classList.toggle('nav-current',el.dataset.nav===(IS_PREDICTIONS?'predictions':'home')))}
function renderStatsSummary(){if(IS_PREDICTIONS)return;const ready=state.all.filter(valid).length;$('#metricMatches').textContent=String(state.all.length);$('#metricLeagues').textContent=String(new Set(state.all.map(m=>m.league)).size);$('#metricAnalyses').textContent=String(ready);if($('#sideFavCount'))$('#sideFavCount').textContent=String(state.favorites.size)}
function marketPill(title,p,highlight=false){return '<div class="market'+(highlight?' strongest':'')+'"><small>'+esc(title)+'</small><b>'+esc(pct(p))+'</b></div>'}
function renderFeatured(){if(IS_PREDICTIONS)return;$('#spotForm').innerHTML=formEmpty();const a=state.all.filter(m=>Date.parse(m.date)>=Date.now());const selected=a.find(x=>String(x.id)===String(state.featuredId))||a.find(valid)||a[0];if(!selected){$('#spotLabel').textContent='NO UPCOMING MATCH';$('#spotLeague').textContent='Χωρίς αγώνα';$('#spotHome').innerHTML=crest('','featured-crest')+'<b>—</b>';$('#spotAway').innerHTML=crest('','featured-crest')+'<b>—</b>';$('#spotDate').textContent='—';$('#spotPred').innerHTML='<div class="feature-prob muted">'+icon('info')+' Δεν υπάρχει διαθέσιμος αγώνας.</div>';$('#spotMarkets').innerHTML='';$('#statsHome').textContent='HOME';$('#statsAway').textContent='AWAY';$('#statsCompare').innerHTML='';$('#spotDetails').disabled=true;$('#statsAnalyze').disabled=true;return}
state.featuredId=String(selected.id);$('#spotDetails').disabled=false;$('#statsAnalyze').disabled=false;
$('#spotLeague').innerHTML=competition(selected.league,'small-league',selected.league_key)+'<span>'+esc(lname(selected.league))+'</span>';$('#spotDate').textContent=dateFmt(selected.date,'weekday')+' · '+clock(selected.date);$('#spotLabel').textContent=valid(selected)?'MODEL AVAILABLE':'UPCOMING';$('#spotHome').innerHTML=crest(selected.home,'featured-crest')+'<b>'+esc(selected.home)+'</b>';$('#spotAway').innerHTML=crest(selected.away,'featured-crest')+'<b>'+esc(selected.away)+'</b>';
const probs=[selected.p1,selected.px,selected.p2];const best=valid(selected)?Math.max(...probs):null;
$('#spotPred').innerHTML=valid(selected)?probs.map((p,i)=>'<div class="feature-prob'+(p===best?' best strongest':'')+'"><div><small>'+['1','X','2'][i]+'</small><b>'+esc(pct(p))+'</b></div><span class="track"><i style="width:'+Math.max(0,Math.min(p,100))+'%"></i></span></div>').join(''):'<div class="feature-prob muted">Δεν υπάρχουν επαρκή δεδομένα για πρόβλεψη 1Χ2.</div>';
const ouBest=pairPreferred(selected.over25,selected.under25),bttsBest=pairPreferred(selected.btts,selected.no_btts);$('#spotMarkets').innerHTML=marketPill('Over 2.5',selected.over25,ouBest===0)+marketPill('Under 2.5',selected.under25,ouBest===1)+marketPill('BTTS · Ναι',selected.btts,bttsBest===0)+marketPill('BTTS · Όχι',selected.no_btts,bttsBest===1);
$('#statsHome').textContent=selected.home;$('#statsAway').textContent=selected.away;
const stats=[['Αναμενόμενα γκολ',selected.mu_home,selected.mu_away],['Κατοχή μπάλας',null,null],['Σουτ στον στόχο',null,null]];
$('#statsCompare').innerHTML=stats.map(([lab,l,r])=>{const have=num(l)!==null&&num(r)!==null,sum=have?l+r:0,L=sum>0?Math.round(l/sum*100):50;return '<div class="stat-row"><span class="stat-val">'+(have?l.toFixed(2):'—')+'</span><div class="stat-row-mid"><span>'+esc(lab)+'</span><div class="stat-track"><i style="width:'+(have?L:0)+'%"></i><b style="width:'+(have?100-L:0)+'%"></b></div></div><span class="stat-val">'+(have?r.toFixed(2):'—')+'</span></div>'}).join('');
}
function outcome(value,best){const v=num(value);return '<span class="pct'+(v===null?' na':best?' best strongest':'')+'"'+(best?' title="Υψηλότερη πιθανότητα στην κατηγορία"':'')+'>'+esc(pct(v))+'</span>'}
function matchLine(m){const p=valid(m)?[m.p1,m.px,m.p2]:[null,null,null],max=p.every(x=>x!==null)?Math.max(...p):null,bt=num(m.btts),nb=num(m.no_btts),o=num(m.over25),u=num(m.under25),ouBest=pairPreferred(o,u),btBest=pairPreferred(bt,nb),fav=state.favorites.has(String(m.id));const quality=valid(m)?'Ιστορικά αποτελέσματα ομάδων · πειραματική εκτίμηση':'Αναμονή στατιστικών στοιχείων ομάδων';
const mobile='<article class="td-mobile-card"><div class="td-mobile-meta">'+competition(m.league,'small-league',m.league_key)+'<span class="td-mobile-league">'+esc(lname(m.league))+'</span><time>'+esc(clock(m.date))+'</time></div>'
+'<div class="td-mobile-teams"><div class="td-mobile-team">'+crest(m.home,'table-crest',m.logos?.home)+'<span class="td-mobile-name">'+esc(m.home)+'</span></div><span class="td-mobile-vs">VS</span><div class="td-mobile-team">'+crest(m.away,'table-crest',m.logos?.away)+'<span class="td-mobile-name">'+esc(m.away)+'</span></div></div>'
+'<div class="td-mobile-probs"><span>1 <b>'+pct(m.p1)+'</b></span><span>Χ <b>'+pct(m.px)+'</b></span><span>2 <b>'+pct(m.p2)+'</b></span></div><div class="td-mobile-extras"><span>Over 2.5 <b>'+pct(m.over25)+'</b></span><span>GG <b>'+pct(m.btts)+'</b></span></div>'
+'<div class="td-mobile-foot"><small>'+esc(quality)+'</small><div class="td-mobile-actions"><button class="td-mobile-detail" data-open="'+esc(m.id)+'" aria-label="Ανάλυση '+esc(m.home)+' εναντίον '+esc(m.away)+'">Ανάλυση →</button><button class="favorite-btn'+(fav?' is-fav':'')+'" data-favorite="'+esc(m.id)+'" aria-label="'+(fav?'Αφαίρεση':'Προσθήκη')+' στα αγαπημένα" aria-pressed="'+fav+'">'+icon('star')+'</button></div></div></article>';
return '<tr class="match-line" data-match="'+esc(m.id)+'"><td class="kickoff">'+esc(clock(m.date))+'</td><td><span class="league-logo">'+competition(m.league,'small-league',m.league_key)+'</span></td><td class="fixture"><button class="fixture-link" data-open="'+esc(m.id)+'" aria-label="Ανάλυση '+esc(m.home)+' εναντίον '+esc(m.away)+'"><span class="fixture-teams"><span class="fixture-team home"><span class="text">'+esc(m.home)+'</span>'+crest(m.home,'table-crest',m.logos?.home)+'</span><span class="vs">VS</span><span class="fixture-team away">'+crest(m.away,'table-crest',m.logos?.away)+'<span class="text">'+esc(m.away)+'</span></span></span><small class="fixture-quality">'+esc(quality)+(m.retrospective?' · εκ των υστέρων':'')+'</small></button></td><td>'+outcome(p[0],p[0]!==null&&p[0]===max)+'</td><td>'+outcome(p[1],p[1]!==null&&p[1]===max)+'</td><td>'+outcome(p[2],p[2]!==null&&p[2]===max)+'</td><td>'+outcome(o,ouBest===0)+'</td><td>'+outcome(u,ouBest===1)+'</td><td>'+outcome(bt,btBest===0)+'</td><td><button class="favorite-btn'+(fav?' is-fav':'')+'" data-favorite="'+esc(m.id)+'" aria-label="'+(fav?'Αφαίρεση':'Προσθήκη')+' στα αγαπημένα" aria-pressed="'+fav+'">'+icon('star')+'</button></td><td class="mobile-match-cell">'+mobile+'</td></tr>'}

/* Home teaser: always the three chronologically next fixtures. Never invent form or fixtures. */
function renderUpcoming(){
  const root=$('#upcomingGrid');if(!root)return;
  const soon=state.all.filter(m=>Date.parse(m.date)>=Date.now()).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(0,3);
  if(!soon.length){root.innerHTML='<div class="upcoming-empty" role="status">'+icon('info')+'<span>'+(state.error?'Το πρόγραμμα δεν είναι διαθέσιμο αυτή τη στιγμή.':'Δεν υπάρχουν καταχωρισμένοι προσεχείς αγώνες.')+'</span><a href="/predictions">Άνοιγμα προγράμματος</a></div>';return}
  root.innerHTML=soon.map(m=>{
    const highest=valid(m)?Math.max(m.p1,m.px,m.p2):null;
    const winner=highest===null?'Δεν υπάρχει ανάλυση':(['1','X','2'][[m.p1,m.px,m.p2].indexOf(highest)]+' · '+pct(highest));
    return '<button class="upcoming-card" data-open="'+esc(m.id)+'" type="button" aria-label="Προβολή ανάλυσης '+esc(m.home)+' εναντίον '+esc(m.away)+'">'+
      '<span class="upcoming-card-head"><span class="upcoming-competition">'+competition(m.league,'small-league')+'<span>'+esc(lname(m.league))+'</span></span><time datetime="'+esc(m.date)+'">'+esc(dateFmt(m.date,'weekday'))+' · '+esc(clock(m.date))+'</time></span>'+
      '<span class="upcoming-teams"><span class="upcoming-side">'+crest(m.home,'table-crest')+'<b>'+esc(m.home)+'</b></span><span class="upcoming-vs">VS</span><span class="upcoming-side away">'+crest(m.away,'table-crest')+'<b>'+esc(m.away)+'</b></span></span>'+
      '<span class="upcoming-card-foot"><span>Εκτίμηση μοντέλου</span><strong class="'+(highest===null?'no-prediction':'')+'">'+esc(winner)+'</strong><span class="upcoming-arrow">'+icon('chevron')+'</span></span></button>'
  }).join('');
}

function renderTable(){if(!IS_PREDICTIONS)return;const list=filtered(),shown=list.slice(0,state.limit);renderFilterNotice();$('#matchesCount').textContent=list.length+' αγώνες';$('#loadMore').hidden=state.limit>=list.length;if(!shown.length){const message=state.error?'Δεν είναι διαθέσιμα τα δεδομένα. '+esc(state.error):state.feed==='loading'?'Φόρτωση προγράμματος…':state.all.length&&hasFilters()?'Υπάρχουν '+state.all.length+' καταχωρισμένοι αγώνες, αλλά τα ενεργά φίλτρα δεν εμφανίζουν κανέναν. <button class="reset-empty" type="button" data-reset-filters>Εμφάνιση όλων των αγώνων</button>':'Δεν υπάρχουν καταχωρισμένοι επερχόμενοι αγώνες για αυτή την περίοδο.';$('#matchRows').innerHTML='<tr><td colspan="10" class="loading-cell">'+message+'</td></tr>';return}
let prev=null,html='';for(const m of shown){const k=kt(m.date);if(k!==prev){html+='<tr class="day-divider"><td colspan="10">'+icon('calendar')+esc(dateFmt(m.date,'full'))+' <small>· '+list.filter(x=>kt(x.date)===k).length+' αγώνες</small></td></tr>';prev=k}html+=matchLine(m)}$('#matchRows').innerHTML=html}
function update(){drawMode();if(state.feed==='loading'){renderLoading();return}finishLoading();if(IS_PREDICTIONS){renderLeagues();renderDates();renderTable()}else{renderFeatured();renderStatsSummary();renderUpcoming()}}
function persistFav(){try{localStorage.setItem(STORAGE,JSON.stringify([...state.favorites]))}catch{}}
function toggleFavorite(id){if(state.favorites.has(String(id)))state.favorites.delete(String(id));else state.favorites.add(String(id));persistFav();update()}
async function fetchFixtures(){const requestId=++state.requestId;state.feed='loading';state.error='';update();try{const url='/api/home-focus';const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});const json=await r.json();if(requestId!==state.requestId)return;if(!r.ok||!Array.isArray(json.matches))throw new Error(json?.message||'Δεν είναι διαθέσιμο το πρόγραμμα αγώνων.');state.all=json.matches.filter(m=>m&&m.id!=null&&m.home&&m.away&&m.date&&Number.isFinite(Date.parse(m.date))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));state.leagueImages=new Map(state.all.filter(m=>sportmonksLogo(m.league_logo)).map(m=>[m.league,m.league_logo]));state.feed='ready';$('.status-dot')?.classList.add('connected');if($('#feedStatus'))$('#feedStatus').textContent='Δεδομένα συνδεδεμένα';update()}catch(e){if(state.requestId===requestId){state.all=[];state.error=String(e?.message||e).slice(0,120);state.feed='error';$('.status-dot')?.classList.remove('connected');if($('#feedStatus'))$('#feedStatus').textContent='Σφάλμα δεδομένων';update()}}}
function evidenceNote(m){return 'Προσαρμογή Poisson σε καταγεγραμμένα τελικά αποτελέσματα με στοιχεία έδρας των δύο ομάδων. Τελευταίο ιστορικό αποτέλεσμα στη βάση: '+String(m.history_latest||'μη διαθέσιμο')+'. Δεν έχει επικυρωμένη προγνωστική ακρίβεια.'}
function showModal(id){const m=state.all.find(x=>String(x.id)===String(id));if(!m)return;state.modalRestore=document.activeElement;const p=valid(m)?[m.p1,m.px,m.p2]:[null,null,null],max=p.every(x=>x!==null)?Math.max(...p):null;const label=(key,val)=>'<div class="modal-cell"><small>'+esc(key)+'</small><b>'+esc(pct(val))+'</b></div>';
$('#modalMount').innerHTML='<div class="modal-backdrop" data-close-backdrop="1"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><div><span class="section-kicker">'+esc(lname(m.league))+'</span><h2 id="modalTitle">Ανάλυση αγώνα</h2></div><button class="modal-close" data-close-modal="1" aria-label="Κλείσιμο">×</button></div><div class="modal-body"><div class="modal-teams"><div class="modal-team">'+crest(m.home,'featured-crest',m.logos?.home)+esc(m.home)+'</div><span class="modal-vs">VS</span><div class="modal-team">'+crest(m.away,'featured-crest',m.logos?.away)+esc(m.away)+'</div></div><div class="modal-date">'+esc(dateFmt(m.date,'full'))+' · '+esc(clock(m.date))+'</div><div class="modal-section">ΠΙΘΑΝΟΤΗΤΕΣ 1 / Χ / 2</div><div class="modal-probs">'+p.map((v,i)=>'<div class="modal-cell'+(v!==null&&v===max?' best':'')+'"><small>'+['1 · Γηπεδούχος','X · Ισοπαλία','2 · Φιλοξενούμενος'][i]+'</small><b>'+esc(pct(v))+'</b></div>').join('')+'</div><div class="modal-section">ΑΝΑΛΥΣΗ ΓΚΟΛ</div><div class="modal-other">'+label('Over 2.5',m.over25)+label('Under 2.5',m.under25)+label('BTTS Ναι',m.btts)+label('BTTS Όχι',m.no_btts)+'<div class="modal-cell"><small>λ γκολ γηπεδούχου</small><b>'+(num(m.mu_home)===null?'—':m.mu_home.toFixed(2))+'</b></div><div class="modal-cell"><small>λ γκολ φιλοξενούμενου</small><b>'+(num(m.mu_away)===null?'—':m.mu_away.toFixed(2))+'</b></div>'+'</div>'+(Array.isArray(m.scorelines)&&m.scorelines.length?'<div class="modal-section">ΠΙΘΑΝΑ ΣΚΟΡ</div><div class="modal-other">'+m.scorelines.slice(0,4).map(s=>label(s.score,s.prob)).join('')+'</div>':'')+'<p class="modal-disclaimer">'+esc(valid(m)?evidenceNote(m):'Δεν υπάρχει επαρκές αντιστοιχισμένο ιστορικό για αυτή την αναμέτρηση. Δεν εμφανίζονται υπολογισμένες πιθανότητες.')+(m.retrospective?' Πρόκειται για εκ των υστέρων υπολογισμό, όχι αρχειοθετημένη πρόβλεψη πριν τον αγώνα.':'')+' Πιθανότητες πειραματικού Poisson — όχι στοιχηματική σύσταση, χωρίς τεκμηριωμένο backtest.</p></div></section></div>';document.body.style.overflow='hidden';$('[data-close-modal]').focus()}
function closeModal(){if(!$('#modalMount').innerHTML)return;$('#modalMount').innerHTML='';document.body.style.overflow='';state.modalRestore?.focus?.({preventScroll:true})}
let popTimeout=0;function notice(title,body){const el=$('#actionPopover');el.innerHTML='<strong>'+esc(title)+'</strong><p>'+esc(body)+'</p>';el.hidden=!el.hidden}
document.addEventListener('click',e=>{const l=e.target.closest('[data-league]');if(l){setLeague(l.dataset.league);return}const d=e.target.closest('[data-day]');if(d){setDay(d.dataset.day);return}const q=e.target.closest('[data-quick]');if(q){setMode(q.dataset.quick);return}const f=e.target.closest('[data-favorite]');if(f){toggleFavorite(f.dataset.favorite);return}const o=e.target.closest('[data-open]');if(o){showModal(o.dataset.open);return}if(e.target.closest('#spotDetails')||e.target.closest('#statsAnalyze')){showModal(state.featuredId);return}if(e.target.closest('[data-reset-filters]')){resetAllFilters();return}if(e.target.closest('#refreshBtn')){fetchFixtures();return}if(e.target.closest('#loadMore')){state.limit+=100;renderTable();return}if(e.target.closest('#todayBtn')){const first=filteredBase()[0];setDay(first?kt(first.date):'all');return}if(e.target.closest('#notifyBtn')){notice('Ειδοποιήσεις','Δεν έχει συνδεθεί υπηρεσία ειδοποιήσεων. Οι προβλέψεις ενημερώνονται με βάση τα διαθέσιμα ιστορικά δεδομένα.');return}if(e.target.closest('#profileBtn')){notice('Guest access','Μπορείς να δεις αγώνες και να κρατήσεις αγαπημένα σε αυτή τη συσκευή, χωρίς σύνδεση.');return}if(e.target.hasAttribute('data-close-modal')||e.target.hasAttribute('data-close-backdrop')){closeModal();return}});
const searchInput=$('#globalSearch');if(searchInput){searchInput.value=IS_PREDICTIONS?String(params.get('q')||''):'';if(IS_PREDICTIONS){searchInput.addEventListener('input',e=>{state.query=e.target.value.trim().toLocaleLowerCase();state.day='all';state.limit=100;syncSearch();update()})}else{searchInput.placeholder='Αναζήτηση στις προβλέψεις…';searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&searchInput.value.trim()){location.href='/predictions?q='+encodeURIComponent(searchInput.value.trim())}})}}
const visibleSearch=$('#fixtureSearch');if(visibleSearch){
 visibleSearch.value=state.query;
 visibleSearch.addEventListener('input',e=>{state.query=e.target.value.trim().toLocaleLowerCase();state.day='all';state.limit=100;syncSearch();update()});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#actionPopover').hidden=true}else if(e.key==='Tab'&&$('#modalMount').innerHTML){const nodes=$$('button:not(:disabled)', $('#modalMount'));if(!nodes.length)return;if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus()}else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus()}}});
document.addEventListener('error',e=>{const im=e.target;if(!im||im.tagName!=='IMG')return;if(im.classList.contains('league-image')){const p=im.parentElement;if(p){p.classList.remove('has-real-logo');if(!p.querySelector('.league-fallback')){const f=document.createElement('span');f.className='league-fallback';f.textContent=p.dataset.short||'⚽';p.append(f);}}im.remove();return;}if(im.classList.contains('team-logo-image')){const parent=im.parentElement;im.remove();if(parent&&!parent.querySelector('img.team-logo-image')){parent.classList.remove('has-team-logo');parent.classList.add('team-no-logo')}return;}if(im.classList.contains('logo-image'))im.remove();else if(im.classList.contains('logo-fallback'))im.replaceWith(document.createTextNode('⚽'))},true);
if(IS_PREDICTIONS)$('a[href="/predictions"]', $('.bottom-nav'))?.setAttribute('aria-current','page');else $('a[href="/"]', $('.bottom-nav'))?.setAttribute('aria-current','page');
$('#year').textContent=String(new Date().getFullYear());
update();fetchFixtures();
})();