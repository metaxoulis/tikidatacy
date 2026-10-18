(()=>{'use strict';if(!window.matchMedia('(max-width:780px)').matches)return;
const deepCache=new Map(),deepLoading=new Set();
const favKey='tiki.followedTeams.v2',state={view:location.pathname.includes('/predictions')?'matches':'home',previous:'matches',mode:new URLSearchParams(location.search).get('filter')==='live'?'live':'all',league:'all',query:'',tab:'info',id:'',matches:[],loading:true,error:''};
let followed=[];try{const f=JSON.parse(localStorage.getItem(favKey)||'[]');if(Array.isArray(f))followed=f.filter(v=>typeof v==='string')}catch{}
const root=document.createElement('div');root.id='td-mobile-root';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').toLocaleLowerCase('el').trim(),isFav=v=>followed.some(x=>norm(x)===norm(v));
const icon={home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',matches:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 4v4m8-4v4"/>',live:'<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10"/>',teams:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.6l-5.7 2.9 1.1-6.3-4.6-4.5 6.4-.9z"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'};
const ico=k=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon[k]+'</svg>';
const when=x=>{try{return new Date(x).toLocaleString('el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch{return '—'}};
const live=m=>['LIVE','1H','2H','1ST','2ND','HT','ET'].includes(String(m?.status||'').toUpperCase());
const score=m=>Number.isInteger(m?.home_score)&&Number.isInteger(m?.away_score)?m.home_score+' : '+m.away_score:'VS';
const pct=x=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('el-GR',{maximumFractionDigits:1})+'%':'—';
const trusted=x=>typeof x==='string'&&/^https:\/\/(cdn\.sportmonks\.com|raw\.githubusercontent\.com)\//.test(x);
const badge=(name,url)=>trusted(url)?'<img src="'+E(url)+'" loading="lazy" alt="'+E(name)+'">':'<span class="tdm-team-avatar">'+E(String(name).slice(0,2).toUpperCase())+'</span>';
const club=(n,l)=>'<div class="tdm-team">'+badge(n,l)+'<strong>'+E(n)+'</strong></div>';
const source=m=>({team:'Ιστορικό ομάδων',partial_team:'Μερικό ιστορικό',league:'Μέσοι όροι λίγκας',cross_league:'Γενική βάση · χαμηλή βεβαιότητα'})[m.prediction_tier]||'Πειραματική ανάλυση';
const pr=m=>{const p=live(m)?m.live_outlook||m.live_prediction:m;return p&&typeof p.p1==='number'&&typeof p.px==='number'&&typeof p.p2==='number'?p:null};
const logoH=m=>m.logos?.home||m.home_logo,logoA=m=>m.logos?.away||m.away_logo;
const stamp=m=>live(m)?'<span class="tdm-live">● LIVE '+(Number.isInteger(m.minute)?m.minute+'′':'')+'</span>':E(when(m.date));
const row=(a,b)=>'<div class="tdm-row"><span>'+E(a)+'</span><b>'+E(b??'—')+'</b></div>';
const title=(a,link,v)=>'<div class="tdm-section"><h2>'+E(a)+'</h2>'+(link?'<button class="tdm-link" data-view="'+v+'">'+E(link)+' →</button>':'')+'</div>';
const lead=(h,p)=>'<span class="tdm-kicker">TIKI-DATA · FOOTBALL INTELLIGENCE</span><h1>'+E(h)+'</h1><p class="tdm-lead">'+E(p)+'</p>';
const kpis=()=>'<div class="tdm-kpis">'+[['Αγώνες',state.matches.length],['Live',state.matches.filter(live).length],['Με εκτίμηση',state.matches.filter(m=>!!pr(m)).length]].map(([x,y],i)=>'<div class="tdm-kpi '+(i===1?'live':'')+'"><b>'+y+'</b><span>'+x+'</span></div>').join('')+'</div>';
const card=m=>{const p=pr(m);return '<article class="tdm-card" role="button" tabindex="0" data-open="'+E(m.id)+'"><div class="tdm-card-top"><b>'+E(m.league||m.league_key)+'</b><span>'+stamp(m)+'</span></div><div class="tdm-teams">'+club(m.home,logoH(m))+'<div class="tdm-versus">'+E(score(m))+'</div>'+club(m.away,logoA(m))+'</div><div class="tdm-card-bottom"><b>'+(p?'1 '+pct(p.p1)+' · X '+pct(p.px)+' · 2 '+pct(p.p2):'Live δεδομένα')+'</b><small>'+E(source(m))+'</small></div></article>'};
const empty=x=>'<div class="tdm-empty">'+E(x)+'</div>';
function home(){const future=state.matches.filter(m=>!live(m));return lead('Τα γήπεδα, στην οθόνη σου.','Όλοι οι αγώνες, live ενημερώσεις και ανάλυση Tiki-Data σε μία εμπειρία.')+
'<section class="tdm-hero"><span class="tdm-kicker">MATCH INTELLIGENCE</span><h2>Δεδομένα που<br>αφηγούνται τον αγώνα.</h2><p>Προγνωστικά 1Χ2, γκολ και live σενάρια με επιβεβαιωμένη προέλευση.</p><button class="tdm-accent-btn" data-view="matches">Εξερεύνησε αγώνες ↗</button></section>'+
kpis()+title('Στο επίκεντρο','Όλοι','matches')+(state.matches[0]?card(state.matches[0]):empty('Αναμονή πραγματικών αγώνων'))+
title('Επόμενοι αγώνες','Περισσότερα','matches')+'<div class="tdm-list">'+future.slice(1,5).map(card).join('')+'</div>'+
'<section class="tdm-panel"><h3>Οι δικές σου ομάδες</h3><p class="tdm-lead">Επίλεξε τα αγαπημένα σωματεία σου για γρήγορη πρόσβαση.</p><button class="tdm-accent-btn" data-view="teams">Follow Teams ★</button></section>'}
function teams(){const map=new Map();for(const m of state.matches)for(const [n,url] of [[m.home,logoH(m)],[m.away,logoA(m)]])if(!map.has(norm(n)))map.set(norm(n),{n,url});const arr=[...map.values()].filter(x=>norm(x.n).includes(norm(state.query))).sort((a,b)=>Number(isFav(b.n))-Number(isFav(a.n))||a.n.localeCompare(b.n,'el'));return lead('Follow Teams','Διάλεξε τις ομάδες που σε ενδιαφέρουν. Θα αποθηκευτούν μόνο στη συσκευή σου.')+
searchInput()+title('Επίλεξε τις ομάδες σου')+'<div class="tdm-grid">'+arr.map(x=>'<button class="tdm-tile '+(isFav(x.n)?'active':'')+'" data-team="'+E(x.n)+'" aria-pressed="'+isFav(x.n)+'"><span class="tdm-star">'+(isFav(x.n)?'★':'☆')+'</span>'+badge(x.n,x.url)+'<strong>'+E(x.n)+'</strong></button>').join('')+'</div>'+(arr.length?'':empty('Δεν βρέθηκαν ομάδες στο διαθέσιμο επταήμερο.'))}
function searchInput(){return '<label class="tdm-search">'+ico('search')+'<input data-search type="search" value="'+E(state.query)+'" placeholder="Αναζήτηση ομάδας ή αγώνα…" aria-label="Αναζήτηση"></label>'}
function fixtures(){const f=state.matches.filter(m=>(state.view==='live'?live(m):state.mode==='live'?live(m):state.mode==='favorites'?isFav(m.home)||isFav(m.away):true)&&(state.league==='all'||state.league===m.league_key)&&(!state.query||norm(m.home+' '+m.away+' '+m.league).includes(norm(state.query))));const leagues=[...new Map(state.matches.map(m=>[m.league_key,m.league||m.league_key])).entries()];return lead(state.view==='live'?'Live Scores':'Αγώνες & Προβλέψεις','Πραγματικά παιχνίδια, οργανωμένα στοιχεία και αναλυτικό Match Center.')+
kpis()+title(state.view==='live'?'Αγώνες σε εξέλιξη':'Πρόγραμμα')+(state.view!=='live'?'<div class="tdm-chips">'+[['all','Όλοι'],['favorites','★ Αγαπημένα'],['live','● Live']].map(([x,y])=>'<button data-mode="'+x+'" class="tdm-chip '+(x===state.mode?'active':'')+'">'+y+'</button>').join('')+'</div>':'')+
'<div class="tdm-chips"><button data-league="all" class="tdm-chip '+(state.league==='all'?'active':'')+'">Όλες οι λίγκες</button>'+leagues.map(([x,y])=>'<button data-league="'+E(x)+'" class="tdm-chip '+(x===state.league?'active':'')+'">'+E(y)+'</button>').join('')+'</div>'+
searchInput()+'<div class="tdm-list">'+f.map(card).join('')+'</div>'+(f.length?'':empty(state.loading?'Φόρτωση πραγματικών αγώνων…':'Δεν υπάρχουν αγώνες με τα συγκεκριμένα φίλτρα.'))+'<p class="tdm-note">Οι αριθμητικές εκτιμήσεις είναι πειραματικές και δεν αποτελούν εγγυημένα αποτελέσματα.</p>'}
const metric=(name,p)=>'<div class="tdm-prob"><small>'+E(name)+'</small><b>'+pct(p)+'</b><div class="tdm-bar"><i style="width:'+((typeof p==='number'&&p>=0&&p<=100)?p:0)+'%"></i></div></div>';
function deepNote(d){
 if(!d)return '<div class="tdm-quiet">'+(deepLoading.has(state.id)?'Φόρτωση πραγματικών στοιχείων Sportmonks…':'Τα επιπλέον στοιχεία δεν είναι διαθέσιμα για τον συγκεκριμένο αγώνα.')+'</div>';
 if(d.error)return '<div class="tdm-quiet">Ο πάροχος δεν διαθέτει αυτή τη στιγμή τα επιπλέον στοιχεία ή δεν περιλαμβάνονται στη συνδρομή.</div>';
 return '';
}
function historicalRow(g){return '<div class="tdm-history-row"><span>'+E(g.date||'')+'</span><strong>'+E(g.home)+' <b>'+E(g.home_score)+'–'+E(g.away_score)+'</b> '+E(g.away)+'</strong>'+(g.result?'<em class="tdm-form-'+E(g.result)+'">'+E(g.result)+'</em>':'')+'</div>'}
function gameHistory(title,rows){return '<section class="tdm-panel"><h3>'+E(title)+'</h3>'+(rows?.length?rows.map(historicalRow).join(''):'<p class="tdm-lead">Δεν βρέθηκαν καταγεγραμμένες αναμετρήσεις στην επαληθευμένη ιστορική βάση.</p>')+'</section>'}
function playerList(team,side,label){const people=team||{starters:[],bench:[]};return '<section class="tdm-panel tdm-lineup-side"><h3>'+E(label)+'</h3>'+
 '<div class="tdm-lineup-rows">'+(people.starters?.length?people.starters.map(p=>'<div class="tdm-player"><span class="tdm-shirt">'+E(p.number??'·')+'</span><b>'+E(p.name)+'</b>'+(p.position?'<small>'+E(p.position)+'</small>':'')+'</div>').join(''):'<p class="tdm-lead">Η ενδεκάδα δεν διατίθεται ακόμη.</p>')+'</div>'+
 (people.bench?.length?'<h4>Αναπληρωματικοί</h4>'+people.bench.map(p=>'<div class="tdm-player"><span class="tdm-shirt">'+E(p.number??'·')+'</span><b>'+E(p.name)+'</b></div>').join(''):'')+'</section>'}
function details(){
 const m=state.matches.find(x=>String(x.id)===String(state.id));if(!m)return empty('Ο αγώνας δεν βρέθηκε');
 const p=pr(m),is=live(m),g=is?m.live_outlook:m,d=deepCache.get(state.id),valid=d&&!d.error;
 let content='';
 if(state.tab==='info')content='<section class="tdm-panel"><h3>Πληροφορίες αγώνα</h3>'+row('Διοργάνωση',m.league||m.league_key)+row('Ημερομηνία',when(m.date))+row('Κατάσταση',is?'LIVE':m.status)+row('Πηγή','Sportmonks')+row('Ποιότητα μοντέλου',source(m))+(valid&&d.venue?row('Γήπεδο',d.venue):'')+'</section>'+
 '<section class="tdm-panel"><h3>Ιστορικό τεκμηρίωσης</h3>'+row('Γηπεδούχος εντός',m.analysis?.home_venue_matches??m.historical_sample?.home)+row('Φιλοξενούμενη εκτός',m.analysis?.away_venue_matches??m.historical_sample?.away)+'</section>';
 if(state.tab==='summary')content='<section class="tdm-panel"><h3>Πιθανότητες τελικού αποτελέσματος</h3>'+(p?'<div class="tdm-probs tdm-probs-featured">'+metric('1 · '+m.home,p.p1)+metric('Χ · Ισοπαλία',p.px)+metric('2 · '+m.away,p.p2)+'</div>':empty('Δεν υπάρχουν διαθέσιμα αριθμητικά δεδομένα.'))+'</section>'+
 '<section class="tdm-panel"><h3>Σενάρια γκολ</h3><div class="tdm-large-stats">'+row('Over 2.5',pct(g?.over25))+row('Under 2.5',pct(g?.under25))+row('GG / BTTS',pct(g?.btts))+row('Πιθανότερο σκορ',is?g?.most_likely_final?.score:m.most_likely_score?.score)+'</div></section>'+
 '<section class="tdm-panel"><h3>Expected Goals (xG) · Sportmonks</h3>'+
 (valid&&d.xg?.available?'<div class="tdm-xg"><div><small>'+E(m.home)+'</small><b>'+E(d.xg.home===null?'—':d.xg.home.toFixed(2))+'</b></div><span>xG</span><div><small>'+E(m.away)+'</small><b>'+E(d.xg.away===null?'—':d.xg.away.toFixed(2))+'</b></div></div>':deepNote(d)||'<p class="tdm-lead">Δεν υπάρχουν xG για τον αγώνα ή δεν περιλαμβάνονται στη συνδρομή.</p>')+
 '<p class="tdm-note">Το xG αφορά ποιότητα ευκαιριών, όχι πρόβλεψη τελικών γκολ. Διαθεσιμότητα ανά διοργάνωση και πακέτο.</p></section>';
 if(state.tab==='lineups')content=deepNote(d)+(valid?'<div class="tdm-confirmation '+(d.lineup_status==='confirmed'?'confirmed':'')+'">'+
 (d.lineup_status==='confirmed'?'✓ Επίσημες ενδεκάδες – επιβεβαιωμένες':d.lineup_status==='predicted_by_provider'?'◇ Πιθανές ενδεκάδες Sportmonks – όχι επιβεβαιωμένες':d.lineup_status==='unconfirmed'?'Η επιβεβαίωση της ενδεκάδας δεν είναι διαθέσιμη':'Δεν έχουν δημοσιευτεί ενδεκάδες')+'</div>'+
 playerList(d.lineups?.home,'home',m.home+(d.formations?.home?' · '+d.formations.home:''))+
 playerList(d.lineups?.away,'away',m.away+(d.formations?.away?' · '+d.formations.away:'')):'')+
 '<p class="tdm-note">Η ένδειξη επιβεβαίωσης προέρχεται αποκλειστικά από το metadata του παρόχου. Προβλεπόμενες ενδεκάδες ενδέχεται να αλλάξουν.</p>';
 if(state.tab==='history')content=deepNote(d)+(valid?gameHistory('Πρόσφατοι αγώνες · '+m.home,d.history?.home)+gameHistory('Πρόσφατοι αγώνες · '+m.away,d.history?.away)+gameHistory('Μεταξύ τους αναμετρήσεις',d.history?.head_to_head):'')+
 '<p class="tdm-note">Αποτελέσματα προηγούμενων αγώνων από την ιστορική βάση OpenFootball και Sportmonks· τα φιλτράρουμε ώστε να προηγούνται χρονικά από τον αγώνα.</p>';
 if(state.tab==='stats'){
  const ev=Array.isArray(m.events)?m.events:[],stats=valid?d.statistics:[],st=Array.isArray(m.statistics)?m.statistics:[];
  const display=stats?.length?stats:st.map(x=>({type:x.type,side:null,value:x.value??'—'}));
  content='<section class="tdm-panel"><h3>Στατιστικά αγώνα</h3>'+
  (display?.length?'<div class="tdm-big-stat-list">'+display.slice(0,30).map(x=>'<div class="tdm-row"><span>'+E(x.type)+(x.side?' · '+(x.side==='home'?m.home:m.away):'')+'</span><b>'+E(x.value)+'</b></div>').join('')+'</div>':deepNote(d)||empty('Το Sportmonks δεν διαθέτει αναλυτικά στατιστικά προς το παρόν.'))+'</section>'+
  '<section class="tdm-panel"><h3>Χρονολόγιο</h3>'+(ev.length?ev.slice(-15).reverse().map(x=>row((x.minute??'—')+'′',x.type+(x.player?' · '+x.player:''))).join(''):empty('Δεν έχουν δημοσιευτεί γεγονότα.'))+'</section>';
 }
 if(state.tab==='analysis'){
  const n=m.live_outlook?.next_goal;
  content='<section class="tdm-panel"><h3>Tiki-Data · Στατιστική ανάλυση</h3><p class="tdm-lead">'+E(m.analysis?.explanation||'Στατιστική εκτίμηση με βάση επαληθευμένα ιστορικά αποτελέσματα.')+'</p>'+
 row('Μοντέλο',is?(m.live_outlook?'Live Poisson':m.live_prediction?'Sportmonks Live':'Χωρίς ποσοστά'):source(m))+
 row('Αναμενόμενα γκολ γηπεδούχου',m.mu_home??m.live_outlook?.remaining_expected_goals?.home)+
 row('Αναμενόμενα γκολ φιλοξενούμενης',m.mu_away??m.live_outlook?.remaining_expected_goals?.away)+'</section>'+
 (n?'<section class="tdm-panel"><h3>Επόμενο γκολ</h3><div class="tdm-probs">'+metric(m.home,n.home)+metric(m.away,n.away)+metric('Κανένα',n.none)+'</div></section>':'')+
 (valid&&d.player_xg?.length?'<section class="tdm-panel"><h3>xG παικτών · Sportmonks</h3>'+d.player_xg.slice(0,15).map(x=>row(x.player_name||'Παίκτης #'+(x.player_id||'—'),x.xg.toFixed(2))).join('')+'</section>':'')+
 '<p class="tdm-note">Τα xG και οι ενδεκάδες είναι ξεχωριστά στοιχεία του παρόχου· δεν τροποποιούν αυτόματα τις πιθανότητες Poisson. Οι εκτιμήσεις δεν είναι βέβαια αποτελέσματα.</p>';
 }
 return '<button class="tdm-back" data-back>← Πίσω στους αγώνες</button><div class="tdm-scoreboard"><div class="tdm-card-top"><b>'+E(m.league||m.league_key)+'</b><span>'+stamp(m)+'</span></div><div class="tdm-teams">'+club(m.home,logoH(m))+'<div class="tdm-versus">'+E(score(m))+'</div>'+club(m.away,logoA(m))+'</div><div class="tdm-scoreboard-caption">'+(is?'● LIVE':'MATCH INTELLIGENCE')+'</div></div>'+
 '<div class="tdm-tabs">'+[['info','Info'],['summary','Ανάλυση'],['lineups','Ενδεκάδες'],['history','Ιστορικό'],['stats','Stats'],['analysis','AI Analysis']].map(([x,y])=>'<button data-tab="'+x+'" class="tdm-tab '+(state.tab===x?'active':'')+'">'+y+'</button>').join('')+'</div>'+content;
}
async function fetchDeep(id){
 if(!/^sportmonks-[1-9]\d{0,13}$/.test(id)||deepCache.has(id)||deepLoading.has(id))return;
 deepLoading.add(id);render();
 try{
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),30000);
  let result;
  try{const r=await fetch('/api/match/'+encodeURIComponent(id),{signal:ctrl.signal});
   if(!r.ok)throw Error('details_unavailable');result=await r.json()}
  finally{clearTimeout(timeout)}
  deepCache.set(id,result);
 }catch{deepCache.set(id,{error:'details_unavailable'})}
 finally{deepLoading.delete(id);if(state.view==='detail'&&state.id===id)render()}
}
function render(focus=false){const pos=focus?root.querySelector('[data-search]')?.selectionStart:null;root.innerHTML='<div class="tdm-wrap"><header class="tdm-top"><a href="/" class="tdm-brand"><img src="/favicon.svg" alt="">Tiki-Data<span style="color:#1eac8b">.</span></a><button data-view="teams" class="tdm-icon-btn" aria-label="Αγαπημένες ομάδες">'+ico('teams')+'</button></header><main>'+
(state.error?'<div class="tdm-empty">'+E(state.error)+' <button data-retry class="tdm-link">Ξανά</button></div>':'')+
(state.view==='home'?home():state.view==='teams'?teams():state.view==='detail'?details():fixtures())+'</main></div><nav class="tdm-bottom">'+[['home','Αρχική'],['matches','Αγώνες'],['live','Live'],['teams','Ομάδες']].map(([x,y])=>'<button data-view="'+x+'" '+(state.view===x?'class="active" aria-current="page"':'')+'>'+ico(x)+'<span>'+y+'</span></button>').join('')+'</nav>';
if(focus){const i=root.querySelector('[data-search]');if(i){i.focus();try{i.setSelectionRange(pos,pos)}catch{}}}}
function navigate(v){state.previous=state.view==='detail'?state.previous:state.view;state.view=v;state.query='';state.league='all';if(v!=='detail')state.id='';render();window.scrollTo(0,0)}
root.addEventListener('click',e=>{const b=e.target.closest('[data-team],[data-view],[data-back],[data-open],[data-mode],[data-league],[data-tab],[data-retry]');if(!b)return;const a=n=>b.getAttribute('data-'+n);
if(b.hasAttribute('data-team')){const v=a('team');followed=isFav(v)?followed.filter(x=>norm(x)!==norm(v)):[...followed,v];try{localStorage.setItem(favKey,JSON.stringify(followed))}catch{}render();return}
if(b.hasAttribute('data-view'))return navigate(a('view'));if(b.hasAttribute('data-back'))return navigate(state.previous==='detail'?'matches':state.previous);
if(b.hasAttribute('data-open')){state.previous=state.view;state.id=a('open');state.view='detail';state.tab='summary';render();void fetchDeep(state.id);window.scrollTo(0,0);return}
if(b.hasAttribute('data-mode')){state.mode=a('mode');render();return}if(b.hasAttribute('data-league')){state.league=a('league');render();return}if(b.hasAttribute('data-tab')){state.tab=a('tab');render();if(!deepCache.has(state.id))void fetchDeep(state.id);return}if(b.hasAttribute('data-retry'))refresh()});
root.addEventListener('input',e=>{if(e.target.matches('[data-search]')){state.query=e.target.value;render(true)}});root.addEventListener('keydown',e=>{if(e.target.matches('[data-open]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click()}});
async function refresh(){try{const timer=new AbortController();const id=setTimeout(()=>timer.abort(),16000);let fx,lv;try{[fx,lv]=await Promise.allSettled([fetch('/api/home-focus',{signal:timer.signal,cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()),fetch('/api/live',{signal:timer.signal,cache:'no-store'}).then(r=>r.ok?r.json():null)])}finally{clearTimeout(id)}
if(fx.status!=='fulfilled'||!Array.isArray(fx.value.matches))throw Error('Data unavailable');const m=new Map(fx.value.matches.map(x=>[String(x.id),x]));if(lv.status==='fulfilled'&&Array.isArray(lv.value?.matches))for(const l of lv.value.matches){const old=m.get(String(l.id));m.set(String(l.id),old?{...old,...l,logos:{...(old.logos||{}),...(l.logos||{})}}:l)}
state.matches=[...m.values()].filter(x=>x.id&&x.home&&x.away&&Number.isFinite(Date.parse(x.date))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));state.loading=false;state.error='';render()}
catch{state.loading=false;if(!state.matches.length)state.error='Προσωρινό πρόβλημα σύνδεσης δεδομένων.';render()}}
function init(){document.body.appendChild(root);document.documentElement.classList.add('td-mobile-ready');render();refresh();setInterval(()=>{if(!document.hidden)refresh()},30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();