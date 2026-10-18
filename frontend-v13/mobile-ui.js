(()=>{'use strict';
const deepCache=new Map(),deepLoading=new Set();
const favKey='tiki.followedTeams.v2',params=new URLSearchParams(location.search),state={view:location.pathname.includes('/predictions')?'matches':'home',previous:'matches',mode:params.get('filter')==='live'?'live':'all',league:['ucl','uel','uecl'].includes(params.get('league'))?params.get('league'):'all',day:'all',query:'',tab:'info',id:'',matches:[],loading:true,error:'',fromCache:false,visible:42,liveUpdatedAt:'',livePending:false};
let followed=[];try{const f=JSON.parse(localStorage.getItem(favKey)||'[]');if(Array.isArray(f))followed=f.filter(v=>typeof v==='string')}catch{}
const uefaStageById=new Map();
const stageLabel=m=>Number.isSafeInteger(m?.stage_id)?uefaStageById.get(m.stage_id)||null:null;
const SITE_FOOTER="<footer class=\"tdm-site-footer\" aria-label=\"Σχετικά και πολιτικές\"><span>© 2026 Tiki-Data · Στατιστικές εκτιμήσεις, όχι στοιχηματικές αποδόσεις</span><nav aria-label=\"Πληροφορίες\"><a href=\"/about\">Σχετικά</a><a href=\"/privacy\">Απόρρητο</a><a href=\"/terms\">Όροι</a><a href=\"/cookies\">Cookies</a><a href=\"/contact\">Επικοινωνία</a></nav></footer>";
const root=document.createElement('div');root.id='td-mobile-root';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').toLocaleLowerCase('el').trim(),isFav=v=>followed.some(x=>norm(x)===norm(v));
const icon={home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',matches:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 4v4m8-4v4"/>',live:'<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10"/>',teams:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.6l-5.7 2.9 1.1-6.3-4.6-4.5 6.4-.9z"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'};
const ico=k=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon[k]+'</svg>';
const when=x=>{try{return new Date(x).toLocaleString('el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch{return '—'}};
const live=m=>['LIVE','1H','2H','1ST','2ND','HT','ET'].includes(String(m?.status||'').toUpperCase());
const score=m=>Number.isInteger(m?.home_score)&&Number.isInteger(m?.away_score)?m.home_score+' : '+m.away_score:'VS';
const pct=x=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('el-GR',{maximumFractionDigits:1})+'%':'—';
const trusted=x=>typeof x==='string'&&/^https:\/\/(cdn\.sportmonks\.com|raw\.githubusercontent\.com|d2ol7oe51mr4n9\.cloudfront\.net)\//.test(x);
const badge=(name,url)=>trusted(url)?'<img src="'+E(url)+'" loading="lazy" alt="'+E(name)+'">':'<span class="tdm-team-avatar">'+E(String(name).slice(0,2).toUpperCase())+'</span>';
const club=(n,l)=>'<div class="tdm-team">'+badge(n,l)+'<strong>'+E(n)+'</strong></div>';
const UEFA_FILTERS=[['ucl','Champions League','UCL'],['uel','Europa League','UEL'],['uecl','Conference League','UECL']];
const source=m=>({team:'Ιστορικό ομάδων',partial_team:'Μερικό ιστορικό',league:'Μέσοι όροι λίγκας',cross_league:'Γενική βάση · χαμηλή βεβαιότητα'})[m.prediction_tier]||'Πειραματική ανάλυση';
const pr=m=>{const p=live(m)?m.live_outlook||m.live_prediction:m;return p&&typeof p.p1==='number'&&typeof p.px==='number'&&typeof p.p2==='number'?p:null};
const is29=n=>/(omoni|ομον)/i.test(String(n||''))&&/29/.test(String(n||''))&&/(mai|may|μα[ιΐ]|maio)/i.test(String(n||''));
const logoH=m=>is29(m.home)?"https://d2ol7oe51mr4n9.cloudfront.net/user_3KbDlDrtS3WJpvJUdX17ksOLOSL/753375b7-7137-4e56-99bc-b3ca04d2249c.jpg":m.logos?.home||m.home_logo,logoA=m=>is29(m.away)?"https://d2ol7oe51mr4n9.cloudfront.net/user_3KbDlDrtS3WJpvJUdX17ksOLOSL/753375b7-7137-4e56-99bc-b3ca04d2249c.jpg":m.logos?.away||m.away_logo;
const stamp=m=>live(m)?'<span class="tdm-live">● LIVE '+(Number.isInteger(m.minute)?m.minute+'′':'')+'</span>':E(when(m.date));
const row=(a,b)=>'<div class="tdm-row"><span>'+E(a)+'</span><b>'+E(b??'—')+'</b></div>';
const title=(a,link,v)=>'<div class="tdm-section"><h2>'+E(a)+'</h2>'+(link?'<button class="tdm-link" data-view="'+v+'">'+E(link)+' →</button>':'')+'</div>';
const lead=(h,p)=>'<span class="tdm-kicker">TIKI-DATA · FOOTBALL INTELLIGENCE</span><h1>'+E(h)+'</h1><p class="tdm-lead">'+E(p)+'</p>';
const kpis=()=>'<div class="tdm-kpis">'+[['Αγώνες',state.matches.length],['Live',state.matches.filter(live).length],['Με εκτίμηση',state.matches.filter(m=>!!pr(m)).length]].map(([x,y],i)=>'<div class="tdm-kpi '+(i===1?'live':'')+'"><b>'+y+'</b><span>'+x+'</span></div>').join('')+'</div>';
const liveUpdateLabel=()=>state.liveUpdatedAt||state.livePending?'<div class="tdm-live-status">'+(state.liveUpdatedAt?'● Live ενημέρωση '+E(when(state.liveUpdatedAt)):'Επεξεργασία live στοιχείων στο Cloudflare…')+(state.livePending?' · αναμονή νεότερων δεδομένων':'')+'</div>':'';
const dayKey=d=>{const x=new Date(d);if(!Number.isFinite(+x))return '';return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const miniProb=m=>{const p=pr(m);return '<span class="tdm-central-probs" aria-label="Πιθανότητες 1 Χ 2">'+['1','Χ','2'].map((t,i)=>'<span><small>'+t+'</small><b>'+pct(p?[p.p1,p.px,p.p2][i]:null)+'</b></span>').join('')+'</span>'};
const missingUefaEvidence=m=>['ucl','uel','uecl'].includes(m.league_key)&&!pr(m)?'<span class="tdm-older-estimate">Αναμονή επαληθευμένων ιστορικών δεδομένων UEFA · δεν παρέχεται εκτίμηση</span>':'';
const olderEstimateTag=m=>{
 if(!live(m)||!pr(m)||!(m.live_probability_stale||state.livePending))return '';
 const saved=m.live_probability_updated_at||state.liveUpdatedAt;
 const recorded=Array.isArray(m.live_probability_score)?m.live_probability_score:null;
 const scoreChanged=recorded&&Number.isInteger(recorded[0])&&Number.isInteger(recorded[1])&&
   (recorded[0]!==m.home_score||recorded[1]!==m.away_score);
 return '<span class="tdm-older-estimate">◷ Προηγούμενη εκτίμηση'+(saved?' · '+E(when(saved)):'')+
  (scoreChanged?' · πριν την αλλαγή σκορ':'')+'</span>';
};
const dateChips=()=>{const days=[...new Set(state.matches.map(m=>dayKey(m.date)))].filter(Boolean).sort(),today=dayKey(new Date()),tomorrow=dayKey(Date.now()+86400000);return '<div class="tdm-chips tdm-day-chips" aria-label="Φίλτρο ανά ημέρα"><button data-day="all" class="tdm-chip '+(state.day==='all'?'active':'')+'">Όλες</button>'+days.map(k=>'<button data-day="'+k+'" class="tdm-chip '+(state.day===k?'active':'')+'">'+(k===today?'Σήμερα':k===tomorrow?'Αύριο':E(new Date(k+'T12:00:00').toLocaleDateString('el-GR',{weekday:'short',day:'numeric',month:'short'})))+'</button>').join('')+'</div><label class="tdm-date-control">Ημερομηνία <input type="date" data-pick-day value="'+(state.day==='all'?'':E(state.day))+'" aria-label="Επιλογή συγκεκριμένης ημέρας"></label>'};
/* Live measurements are sourced from Sportmonks, not from the probability model. */
function liveStatsBlock(m,compact=false){
 if(!live(m))return '';
 const rows=Array.isArray(m.live_stats)?m.live_stats:[],show=(compact?['shots','on_target','corners','possession']:['shots','on_target','possession','corners','fouls','yellow','red']);
 const relevant=show.map(k=>rows.find(x=>x.key===k)).filter(Boolean);
 if(!relevant.length)return compact?'<p class="tdm-live-stat-hint">Live στατιστικά: δεν διατίθενται ακόμη από το Sportmonks.</p>':
 '<section class="tdm-panel"><h3>Live στατιστικά · Sportmonks</h3><p class="tdm-lead">Δεν υπάρχουν διαθέσιμες επαληθευμένες μετρήσεις αυτή τη στιγμή.</p></section>';
 const stats=relevant.slice(0,compact?3:7).map(v=>'<div class="tdm-stat-dual-row"><b>'+E(v.home)+(v.unit||'')+'</b><span>'+E(v.label)+'</span><b>'+E(v.away)+(v.unit||'')+'</b></div>').join('');
 if(compact)return '<div class="tdm-live-stat-brief"><span class="tdm-live-proof">● LIVE STATS · Sportmonks</span><div class="tdm-live-stats-grid">'+stats+'</div></div>';
 return '<section class="tdm-panel tdm-live-panel"><h3>Πραγματικά live στατιστικά · Sportmonks</h3><div class="tdm-live-stats-grid">'+stats+
 '</div><p class="tdm-note">Μετρήσεις για την τρέχουσα αναμέτρηση, όχι εκτιμήσεις ή μέσοι όροι. Η διαθεσιμότητα αλλάζει ανά παιχνίδι και συνδρομή.</p></section>';
}
function recentFormBlock(m){
 if(!live(m))return '';
 const form=m.recent_form||{},panel=(x,team)=>{
  if(!x?.verified)return '<div class="tdm-team-form"><strong>'+E(team)+'</strong><p>Χωρίς επιβεβαιωμένο πρόσφατο δείγμα.</p></div>';
  return '<div class="tdm-team-form"><strong>'+E(team)+'</strong><small>'+E(x.matches)+' ιστορικά παιχνίδια · W '+E(x.wins)+' / D '+E(x.draws)+' / L '+E(x.losses)+'</small>'+
   '<div class="tdm-form-figures"><span>Γκολ/αγώνα <b>'+E(x.goals_per_match)+'</b></span><span>Δέχεται/αγώνα <b>'+E(x.conceded_per_match)+'</b></span></div></div>';
 };
 return '<section class="tdm-panel tdm-form-panel"><h3>Πρόσφατη φόρμα · ιστορική βάση D1</h3><div class="tdm-form-pair">'+panel(form.home,m.home)+panel(form.away,m.away)+'</div>'+
  '<p class="tdm-note">Επαληθευμένα τελικά σκορ από εγχώριες και ευρωπαϊκές διοργανώσεις · τελευταίοι έως 8 αγώνες. Δεν αποτελούν ζωντανές μετρήσεις ή αξιολογημένες πιθανότητες.</p></section>';
}
const liveMethodNote=m=>live(m)&&m.live_outlook?.source==='recent_form_live_poisson'?
 '<p class="tdm-live-method-note">Πειραματική πιθανότητα από ιστορική φόρμα και τρέχον σκορ/λεπτό. Χαμηλή βεβαιότητα · όχι εγγύηση.</p>':
 live(m)&&m.live_outlook?'<p class="tdm-live-method-note">Πειραματικό live Poisson από επαληθευμένες ιστορικές επιδόσεις.</p>':
 live(m)&&m.live_prediction?'<p class="tdm-live-method-note">Πιθανότητες από Sportmonks Live Predictions.</p>':'';

const card=m=>{const p=pr(m),vals=p?[p.p1,p.px,p.p2]:[null,null,null];
 const highest=p?Math.max(...vals):null;
 const inner='<div class="tdm-core-prob" aria-label="Πιθανότητες 1 Χ 2">'+['1','Χ','2'].map((k,i)=>'<span class="tdm-core-cell'+(vals[i]!==null&&vals[i]===highest?' winner':'')+'"><small>'+k+'</small><b>'+pct(vals[i])+'</b></span>').join('')+'</div>';
 return '<article class="tdm-card tdm-match-compact" role="button" tabindex="0" data-open="'+E(m.id)+'"><div class="tdm-card-top"><b class="tdm-league-name">'+(trusted(m.league_logo)?'<img class="tdm-league-emblem" loading="lazy" src="'+E(m.league_logo)+'" alt="">':'')+E(m.league||m.league_key)+'</b><span>'+stamp(m)+'</span></div>'+
 (stageLabel(m)?'<p class="tdm-stage-label">'+E(stageLabel(m))+'</p>':'')+'<div class="tdm-teams">'+club(m.home,logoH(m))+'<div class="tdm-centre">'+inner+(live(m)?'<span class="tdm-live-score">'+E(score(m))+'</span>':'')+'</div>'+club(m.away,logoA(m))+'</div>'+
 liveStatsBlock(m,true)+liveMethodNote(m)+olderEstimateTag(m)+missingUefaEvidence(m)+'<div class="tdm-card-bottom"><b>'+(live(m)?'Live αναμέτρηση':'Πιθανότητες 1Χ2')+'</b><small>Ανάλυση αγώνα ↗</small></div></article>'};
const empty=x=>'<div class="tdm-empty">'+E(x)+'</div>';
function home(){const future=state.matches.filter(m=>!live(m));return lead('Τα γήπεδα, στην οθόνη σου.','Όλοι οι αγώνες, live ενημερώσεις και ανάλυση Tiki-Data σε μία εμπειρία.')+
'<section class="tdm-hero"><span class="tdm-kicker">MATCH INTELLIGENCE</span><h2>Δεδομένα που<br>αφηγούνται τον αγώνα.</h2><p>Προγνωστικά 1Χ2, γκολ και live σενάρια με επιβεβαιωμένη προέλευση.</p><button class="tdm-accent-btn" data-view="matches">Εξερεύνησε αγώνες ↗</button></section>'+
kpis()+liveUpdateLabel()+'<section class="tdm-uefa-section"><h3>Ευρωπαϊκές διοργανώσεις</h3><div class="tdm-uefa-links">'+UEFA_FILTERS.map(([key,label,short])=>'<a href="/predictions?league='+key+'"><b>'+short+'</b><span>'+label+'</span><span aria-hidden="true">↗</span></a>').join('')+'</div></section>'+title('Στο επίκεντρο','Όλοι','matches')+(state.matches[0]?card(state.matches[0]):empty('Αναμονή πραγματικών αγώνων'))+
title('Επόμενοι αγώνες','Περισσότερα','matches')+'<div class="tdm-list">'+future.slice(1,5).map(card).join('')+'</div>'+
'<section class="tdm-panel"><h3>Οι δικές σου ομάδες</h3><p class="tdm-lead">Επίλεξε τα αγαπημένα σωματεία σου για γρήγορη πρόσβαση.</p><button class="tdm-accent-btn" data-view="teams">Follow Teams ★</button></section>'}
function teams(){const map=new Map();for(const m of state.matches)for(const [n,url] of [[m.home,logoH(m)],[m.away,logoA(m)]])if(!map.has(norm(n)))map.set(norm(n),{n,url});const arr=[...map.values()].filter(x=>norm(x.n).includes(norm(state.query))).sort((a,b)=>Number(isFav(b.n))-Number(isFav(a.n))||a.n.localeCompare(b.n,'el'));return lead('Follow Teams','Διάλεξε τις ομάδες που σε ενδιαφέρουν. Θα αποθηκευτούν μόνο στη συσκευή σου.')+
searchInput()+title('Επίλεξε τις ομάδες σου')+'<div class="tdm-grid">'+arr.map(x=>'<button class="tdm-tile '+(isFav(x.n)?'active':'')+'" data-team="'+E(x.n)+'" aria-pressed="'+isFav(x.n)+'"><span class="tdm-star">'+(isFav(x.n)?'★':'☆')+'</span>'+badge(x.n,x.url)+'<strong>'+E(x.n)+'</strong></button>').join('')+'</div>'+(arr.length?'':empty('Δεν βρέθηκαν ομάδες στο διαθέσιμο επταήμερο.'))}
function searchInput(){return '<label class="tdm-search">'+ico('search')+'<input data-search type="search" value="'+E(state.query)+'" placeholder="Αναζήτηση ομάδας ή αγώνα…" aria-label="Αναζήτηση"></label>'}
function fixtures(){const f=state.matches.filter(m=>(state.view==='live'?live(m):state.mode==='live'?live(m):state.mode==='favorites'?isFav(m.home)||isFav(m.away):true)&&(state.league==='all'||state.league===m.league_key)&&(state.day==='all'||dayKey(m.date)===state.day)&&(!state.query||norm(m.home+' '+m.away+' '+m.league).includes(norm(state.query))));const grouped=[...new Map(state.matches.map(m=>[m.league_key,m.league||m.league_key])).entries()];const leagues=[...UEFA_FILTERS.map(([k,n])=>[k,n]),...grouped.filter(([k])=>!UEFA_FILTERS.some(([key])=>key===k))];return lead(state.view==='live'?'Live Scores':'Αγώνες & Προβλέψεις','Πραγματικά παιχνίδια, οργανωμένα στοιχεία και αναλυτικό Match Center.')+
kpis()+liveUpdateLabel()+title(state.view==='live'?'Αγώνες σε εξέλιξη':'Πρόγραμμα')+(state.view!=='live'?'<div class="tdm-chips">'+[['all','Όλοι'],['favorites','★ Αγαπημένα'],['live','● Live']].map(([x,y])=>'<button data-mode="'+x+'" class="tdm-chip '+(x===state.mode?'active':'')+'">'+y+'</button>').join('')+'</div>':'')+
'<div class="tdm-chips"><button data-league="all" class="tdm-chip '+(state.league==='all'?'active':'')+'">Όλες οι λίγκες</button>'+leagues.map(([x,y])=>'<button data-league="'+E(x)+'" class="tdm-chip '+(x===state.league?'active':'')+'">'+E(y)+'</button>').join('')+'</div>'+
dateChips()+searchInput()+'<div class="tdm-list">'+f.slice(0,state.visible).map(card).join('')+(f.length>state.visible?'<button class="tdm-more" data-more>Εμφάνιση περισσότερων ('+(f.length-state.visible)+') ↓</button>':'')+'</div>'+(f.length?'':empty(state.loading?'Φόρτωση πραγματικών αγώνων…':UEFA_FILTERS.some(([k])=>k===state.league)?'Δεν υπάρχουν διαθέσιμοι αγώνες από το Sportmonks στο τρέχον επταήμερο για αυτή τη διοργάνωση.':'Δεν υπάρχουν αγώνες με τα συγκεκριμένα φίλτρα.'))+'<p class="tdm-note">Οι αριθμητικές εκτιμήσεις είναι πειραματικές και δεν αποτελούν εγγυημένα αποτελέσματα.</p>'}
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

const shortSurname=n=>String(n||'').trim().split(/\s+/).filter(Boolean).slice(-1)[0]||'—';
function lineupPitch(m,team,side,formation){
 const people=team||{starters:[],bench:[]},players=Array.isArray(people.starters)?people.starters:[],bench=Array.isArray(people.bench)?people.bench:[];
 const lines=String(formation||'').split('-').map(Number);
 const validFormation=lines.length>=2&&lines.length<=5&&lines.every(n=>Number.isInteger(n)&&n>0&&n<=5)&&lines.reduce((a,b)=>a+b,0)===10;
 const raw=m?.team_colors?.[side]?.primary||m?.[side+'_color']||'',officialColor=typeof raw==='string'&&/^#[a-f0-9]{6}$/i.test(raw)?raw:null;
 const kit=officialColor||'#365a6b',name=side==='home'?m.home:m.away;
 const player=p=>'<div class="tdm-pitch-player" title="'+E(p.name)+'"><span class="tdm-jersey" style="--kit:'+kit+'"><b>'+E(p.number??'·')+'</b></span><strong>'+E(shortSurname(p.name))+'</strong></div>';
 let field='';
 if(players.length===11&&validFormation){
  const sorted=[...players].sort((a,b)=>(a.order??50)-(b.order??50));
  // Sportmonks can place the keeper anywhere in the list; use a supplied role or 1:1 field first.
  const keeper=sorted.find(p=>p.is_goalkeeper||p.position==='1:1'||/^(gk|goalkeeper|keeper)$/i.test(String(p.role||'')))||sorted.find(p=>p.order===1)||sorted[0];
  const outfield=sorted.filter(p=>p!==keeper);
  let offset=0;const parts=[];
  for(const n of lines){parts.push(outfield.slice(offset,offset+n));offset+=n}
  parts.reverse().push([keeper]);
  field='<div class="tdm-pitch" role="group" aria-label="Σχηματισμός '+E(name)+' '+E(formation)+'"><div class="tdm-pitch-mid"></div><div class="tdm-pitch-circle"></div><div class="tdm-pitch-area top"></div><div class="tdm-pitch-area bottom"></div><div class="tdm-pitch-players">'+parts.map((row,i)=>'<div class="tdm-pitch-row'+(i===parts.length-1?' gk-row':'')+'">'+row.map(player).join('')+'</div>').join('')+'</div></div>';
 }else field='<div class="tdm-pitch-pending">Δεν διατίθενται και οι 11 παίκτες με έγκυρο σχηματισμό, ώστε να εμφανιστούν αξιόπιστα στο γήπεδο.</div>';
 const rows=p=>'<div class="tdm-player"><span class="tdm-shirt">'+E(p.number??'·')+'</span><b>'+E(p.name)+'</b></div>';
 return '<section class="tdm-panel tdm-pitch-card"><div class="tdm-pitch-title">'+badge(name,side==='home'?logoH(m):logoA(m))+'<div><h3>'+E(name)+'</h3><span>'+E(formation||'Σχηματισμός μη διαθέσιμος')+'</span></div></div>'+field+
 (players.length&&!(players.length===11&&validFormation)?'<div class="tdm-lineup-rows">'+players.map(rows).join('')+'</div>':'')+
 (bench.length?'<details class="tdm-bench"><summary>Αναπληρωματικοί ('+bench.length+')</summary><div class="tdm-lineup-rows">'+bench.map(rows).join('')+'</div></details>':'')+
 (!officialColor?'<p class="tdm-kit-note">Ουδέτερη εμφάνιση — δεν υπάρχει επαληθευμένο χρώμα φανέλας.</p>':'')+'</section>';
}
function uefaFormBlock(m){
 if(!['ucl','uel','uecl'].includes(m.league_key))return '';
 const data=m.european_form;
 if(!data)return '<section class="tdm-panel"><h3>Επαληθευμένο UEFA ιστορικό</h3><p class="tdm-lead">Το αναλυτικό ιστορικό δεδομένων δεν είναι διαθέσιμο αυτή τη στιγμή.</p></section>';
 const pane=(s,name)=>{
  if(!s?.verified)return '<div class="tdm-uefa-form-card"><strong>'+E(name)+'</strong><p>Δεν υπάρχουν επαρκή καταγεγραμμένα παιχνίδια UEFA πριν από την αναμέτρηση.</p></div>';
  return '<div class="tdm-uefa-form-card"><strong>'+E(name)+'</strong><p>'+E(s.matches)+' πρόσφατοι αγώνες UEFA · '+E(s.wins)+' νίκες / '+E(s.draws)+' ισοπαλίες / '+E(s.losses)+' ήττες</p>'+
    row('Γκολ υπέρ / κατά',s.goals_for+' / '+s.goals_against)+
    row('Μ.Ο. σουτ',s.avg_shots===null?'—':s.avg_shots)+
    row('Μ.Ο. σουτ στην εστία',s.avg_shots_on_target===null?'—':s.avg_shots_on_target)+
    row('Μ.Ο. κατοχής',s.avg_possession===null?'—':s.avg_possession+'%')+'</div>';
 };
 return '<section class="tdm-panel"><h3>Επαληθευμένο UEFA ιστορικό · D1</h3><div class="tdm-uefa-form-grid">'+pane(data.home,m.home)+pane(data.away,m.away)+'</div>'+
 '<p class="tdm-note">Αποκλειστικά πραγματικά αποτελέσματα και διαθέσιμα στατιστικά από το Sportmonks. Περιλαμβάνονται προκριματικοί. Δεν υπολογίζονται πλασματικά xG ή προγνωστική βελτίωση από σουτ/κατοχή.</p></section>';
}

function details(){
 const m=state.matches.find(x=>String(x.id)===String(state.id));if(!m)return empty('Ο αγώνας δεν βρέθηκε');
 const is=live(m),d=deepCache.get(state.id),valid=d&&!d.error;
 const p=!is&&valid&&d.context_prediction?d.context_prediction:pr(m),g=is?m.live_outlook:p||m;
 let content='';
 if(state.tab==='info')content='<section class="tdm-panel"><h3>Πληροφορίες αγώνα</h3>'+row('Διοργάνωση',m.league||m.league_key)+(stageLabel(m)?row('Φάση UEFA',stageLabel(m)):'')+row('Ημερομηνία',when(m.date))+row('Κατάσταση',is?'LIVE':m.status)+row('Πηγή','Sportmonks')+row('Ποιότητα μοντέλου',source(m))+(valid&&d.venue?row('Γήπεδο',d.venue):'')+'</section>'+
 uefaFormBlock(m)+'<section class="tdm-panel"><h3>Ιστορικό τεκμηρίωσης</h3>'+row('Γηπεδούχος εντός',m.analysis?.home_venue_matches??m.historical_sample?.home)+row('Φιλοξενούμενη εκτός',m.analysis?.away_venue_matches??m.historical_sample?.away)+'</section>';
 if(state.tab==='summary')content=liveStatsBlock(m)+recentFormBlock(m)+'<section class="tdm-panel"><h3>Πιθανότητες τελικού αποτελέσματος</h3>'+(p?'<div class="tdm-probs tdm-probs-featured">'+metric('1 · '+m.home,p.p1)+metric('Χ · Ισοπαλία',p.px)+metric('2 · '+m.away,p.p2)+'</div>':empty('Δεν υπάρχουν διαθέσιμα αριθμητικά δεδομένα.'))+'</section>'+
 uefaFormBlock(m)+'<section class="tdm-panel"><h3>Σενάρια γκολ</h3><div class="tdm-large-stats">'+row('Over 2.5',pct(g?.over25))+row('Under 2.5',pct(g?.under25))+row('GG / BTTS',pct(g?.btts))+row('Πιθανότερο σκορ',is?g?.most_likely_final?.score:m.most_likely_score?.score)+'</div></section>'+
 '<section class="tdm-panel"><h3>Expected Goals (xG) · Sportmonks</h3>'+
 (valid&&d.xg?.available?'<div class="tdm-xg"><div><small>'+E(m.home)+'</small><b>'+E(d.xg.home===null?'—':d.xg.home.toFixed(2))+'</b></div><span>xG</span><div><small>'+E(m.away)+'</small><b>'+E(d.xg.away===null?'—':d.xg.away.toFixed(2))+'</b></div></div>':deepNote(d)||'<p class="tdm-lead">Δεν υπάρχουν xG για τον αγώνα ή δεν περιλαμβάνονται στη συνδρομή.</p>')+
 '<p class="tdm-note">Το xG αφορά ποιότητα ευκαιριών, όχι πρόβλεψη τελικών γκολ. Διαθεσιμότητα ανά διοργάνωση και πακέτο.</p></section>';
 if(state.tab==='lineups')content=deepNote(d)+(valid?'<div class="tdm-confirmation '+(d.lineup_status==='confirmed'?'confirmed':'')+'">'+
 (d.lineup_status==='confirmed'?'✓ Επίσημες ενδεκάδες – επιβεβαιωμένες':d.lineup_status==='predicted_by_provider'?'◇ Πιθανές ενδεκάδες Sportmonks – όχι επιβεβαιωμένες':d.lineup_status==='unconfirmed'?'Η επιβεβαίωση της ενδεκάδας δεν είναι διαθέσιμη':'Δεν έχουν δημοσιευτεί ενδεκάδες')+'</div>'+
 '<div class="tdm-pitch-grid">'+lineupPitch(m,d.lineups?.home,'home',d.formations?.home)+lineupPitch(m,d.lineups?.away,'away',d.formations?.away)+'</div>':'')+
 '<p class="tdm-note">Η ένδειξη επιβεβαίωσης προέρχεται αποκλειστικά από το metadata του παρόχου. Προβλεπόμενες ενδεκάδες ενδέχεται να αλλάξουν.</p>';
 if(state.tab==='history')content=deepNote(d)+(valid?gameHistory('Πρόσφατοι αγώνες · '+m.home,d.history?.home)+gameHistory('Πρόσφατοι αγώνες · '+m.away,d.history?.away)+gameHistory('Μεταξύ τους αναμετρήσεις',d.history?.head_to_head):'')+
 '<p class="tdm-note">Αποτελέσματα προηγούμενων αγώνων από την ιστορική βάση OpenFootball και Sportmonks· τα φιλτράρουμε ώστε να προηγούνται χρονικά από τον αγώνα.</p>';
 if(state.tab==='stats'){
  const ev=Array.isArray(m.events)?m.events:[],stats=valid?d.statistics:[],st=Array.isArray(m.statistics)?m.statistics:[];
  const display=stats?.length?stats:st.map(x=>({type:x.type,side:null,value:x.value??'—'}));
  content=liveStatsBlock(m)+'<section class="tdm-panel"><h3>Λεπτομερή στατιστικά αγώνα</h3>'+
  (display?.length?'<div class="tdm-big-stat-list">'+display.slice(0,30).map(x=>'<div class="tdm-row"><span>'+E(x.type)+(x.side?' · '+(x.side==='home'?m.home:m.away):'')+'</span><b>'+E(x.value)+'</b></div>').join('')+'</div>':deepNote(d)||empty('Το Sportmonks δεν διαθέτει αναλυτικά στατιστικά προς το παρόν.'))+'</section>'+
  '<section class="tdm-panel"><h3>Χρονολόγιο</h3>'+(ev.length?ev.slice(-15).reverse().map(x=>row((x.minute??'—')+'′',x.type+(x.player?' · '+x.player:''))).join(''):empty('Δεν έχουν δημοσιευτεί γεγονότα.'))+'</section>';
 }
 if(state.tab==='analysis'){
  const n=m.live_outlook?.next_goal;
  content=recentFormBlock(m)+liveStatsBlock(m)+'<section class="tdm-panel"><h3>Tiki-Data · Στατιστική ανάλυση</h3><p class="tdm-lead">'+E(m.analysis?.explanation||'Στατιστική εκτίμηση με βάση επαληθευμένα ιστορικά αποτελέσματα.')+'</p>'+
 row('Μοντέλο',is?(m.live_outlook?.source==='recent_form_live_poisson'?'Πειραματικό Poisson βάσει φόρμας':m.live_outlook?'Live Poisson':m.live_prediction?'Sportmonks Live':'Χωρίς ποσοστά'):source(m))+
 row('Αναμενόμενα γκολ γηπεδούχου',m.mu_home??m.live_outlook?.remaining_expected_goals?.home)+
 row('Αναμενόμενα γκολ φιλοξενούμενης',m.mu_away??m.live_outlook?.remaining_expected_goals?.away)+'</section>'+
 (n?'<section class="tdm-panel"><h3>Επόμενο γκολ</h3><div class="tdm-probs">'+metric(m.home,n.home)+metric(m.away,n.away)+metric('Κανένα',n.none)+'</div></section>':'')+
 (valid&&d.player_xg?.length?'<section class="tdm-panel"><h3>xG παικτών · Sportmonks</h3>'+d.player_xg.slice(0,15).map(x=>row(x.player_name||'Παίκτης #'+(x.player_id||'—'),x.xg.toFixed(2))).join('')+'</section>':'')+
 '<p class="tdm-note">Οι προηγούμενοι ευρωπαϊκοί αγώνες με επαληθευμένα xG συμπεριλαμβάνονται στην πειραματική προσαρμογή όπου υπάρχει επαρκές δείγμα. Η συνέχεια της ενδεκάδας χρησιμοποιείται μόνο για επιβεβαιωμένες XI. Δεν πρόκειται για επικυρωμένη πρόβλεψη.</p>'+((!is&&d?.context_prediction)?'<section class="tdm-panel"><h3>Πραγματικά δεδομένα που επηρέασαν την εκτίμηση</h3>'+row('xG ιστορικών αγώνων – γηπεδούχος',d.context_prediction.context?.observed_xg?.home)+row('xG ιστορικών αγώνων – φιλοξενούμενη',d.context_prediction.context?.observed_xg?.away)+row('Ευρωπαϊκοί αγώνες στο δείγμα – γηπεδούχος',d.context_prediction.context?.european_matches?.home)+row('Ευρωπαϊκοί αγώνες στο δείγμα – φιλοξενούμενη',d.context_prediction.context?.european_matches?.away)+'</section>':'');
 }
 return '<button class="tdm-back" data-back>← Πίσω στους αγώνες</button><div class="tdm-scoreboard"><div class="tdm-card-top"><b>'+E(m.league||m.league_key)+'</b><span>'+stamp(m)+'</span></div><div class="tdm-teams">'+club(m.home,logoH(m))+'<div class="tdm-versus">'+E(score(m))+'</div>'+club(m.away,logoA(m))+'</div><div class="tdm-scoreboard-caption">'+(is?'● LIVE':'MATCH INTELLIGENCE')+'</div></div>'+
 olderEstimateTag(m)+'<div class="tdm-tabs">'+[['info','Info'],['summary','Ανάλυση'],['lineups','Ενδεκάδες'],['history','Ιστορικό'],['stats','Stats'],['analysis','AI Analysis']].map(([x,y])=>'<button data-tab="'+x+'" class="tdm-tab '+(state.tab===x?'active':'')+'">'+y+'</button>').join('')+'</div>'+content;
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
function render(focus=false){const pos=focus?root.querySelector('[data-search]')?.selectionStart:null;root.innerHTML='<div class="tdm-wrap"><header class="tdm-top"><a href="/" class="tdm-brand"><img src="/brand.svg" alt="Tiki-Data"></a><button data-view="teams" class="tdm-icon-btn" aria-label="Αγαπημένες ομάδες">'+ico('teams')+'</button></header><main>'+
(state.fromCache?'<div class="tdm-cache-note">Προσωρινά αποθηκευμένοι αγώνες · ανανέωση σε εξέλιξη</div>':'')+(state.error?'<div class="tdm-empty">'+E(state.error)+' <button data-retry class="tdm-link">Ξανά</button></div>':'')+
(state.view==='home'?home():state.view==='teams'?teams():state.view==='detail'?details():fixtures())+'</main>'+SITE_FOOTER+'</div><nav class="tdm-bottom">'+[['home','Αρχική'],['matches','Αγώνες'],['live','Live'],['teams','Ομάδες']].map(([x,y])=>'<button data-view="'+x+'" '+(state.view===x?'class="active" aria-current="page"':'')+'>'+ico(x)+'<span>'+y+'</span></button>').join('')+'</nav>';
if(window.matchMedia('(min-width:781px)').matches){const nav=root.querySelector('.tdm-bottom'),header=root.querySelector('.tdm-top');if(nav&&header)header.after(nav);}
 if(focus){const i=root.querySelector('[data-search]');if(i){i.focus();try{i.setSelectionRange(pos,pos)}catch{}}}}
function navigate(v){state.visible=42;state.previous=state.view==='detail'?state.previous:state.view;state.view=v;state.query='';state.league='all';if(v!=='detail')state.id='';render();window.scrollTo(0,0)}
root.addEventListener('click',e=>{const b=e.target.closest('[data-team],[data-view],[data-back],[data-open],[data-mode],[data-league],[data-day],[data-tab],[data-retry],[data-more]');if(!b)return;const a=n=>b.getAttribute('data-'+n);
if(b.hasAttribute('data-team')){const v=a('team');followed=isFav(v)?followed.filter(x=>norm(x)!==norm(v)):[...followed,v];try{localStorage.setItem(favKey,JSON.stringify(followed))}catch{}render();return}
if(b.hasAttribute('data-view'))return navigate(a('view'));if(b.hasAttribute('data-back'))return navigate(state.previous==='detail'?'matches':state.previous);
if(b.hasAttribute('data-open')){state.previous=state.view;state.id=a('open');state.view='detail';state.tab='summary';render();void fetchDeep(state.id);window.scrollTo(0,0);return}
if(b.hasAttribute('data-more')){state.visible+=42;render();return}if(b.hasAttribute('data-mode')){state.mode=a('mode');state.visible=42;render();return}if(b.hasAttribute('data-league')){state.league=a('league');render();return}if(b.hasAttribute('data-day')){state.day=a('day');render();return}if(b.hasAttribute('data-tab')){state.tab=a('tab');render();if(!deepCache.has(state.id))void fetchDeep(state.id);return}if(b.hasAttribute('data-retry'))refresh()});
root.addEventListener('change',e=>{if(e.target.matches('[data-pick-day]')){state.day=/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)?e.target.value:'all';render()}});
root.addEventListener('input',e=>{if(e.target.matches('[data-search]')){state.query=e.target.value;render(true)}});root.addEventListener('keydown',e=>{if(e.target.matches('[data-open]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click()}});
/* Show the most recent verified public fixture snapshot immediately on return visits.
 * Cache lifetime is 5 minutes; network refresh runs independently of live events. */
const warmKey='tiki.mobile.fixture.snapshot.v1';
function rememberFixtures(){
 try{
  const fields=['id','home','away','date','league','league_key','status','minute','home_score','away_score','p1','px','p2','logos','home_logo','away_logo','prediction_tier','live_outlook','live_prediction','over25','under25','btts','mu_home','mu_away','most_likely_score'];
  const recent=state.matches.slice(0,150).map(m=>Object.fromEntries(fields.filter(k=>Object.prototype.hasOwnProperty.call(m,k)).map(k=>[k,m[k]])));
  localStorage.setItem(warmKey,JSON.stringify({saved:Date.now(),matches:recent}));
 }catch{}
}
function restoreFixtures(){
 try{
  const c=JSON.parse(localStorage.getItem(warmKey)||'null');
  if(!c||!Number.isFinite(c.saved)||Date.now()-c.saved>21600000||c.saved>Date.now()+60000||!Array.isArray(c.matches))return;
  state.matches=c.matches.filter(x=>x&&x.id&&x.home&&x.away&&Number.isFinite(Date.parse(x.date))&&Date.parse(x.date)>Date.now()-21600000).slice(0,150);state.fromCache=true;
  if(state.matches.length)state.loading=false;
 }catch{}
}

/* Two independent streams: slow 7-day fixture updates and fast lightweight
 * completed live snapshots from the backend. The browser NEVER runs forecasts. */
let updating=false,liveUpdating=false,baseMatches=[],liveMatches=[];
function paintMatches(){
 const all=new Map(baseMatches.map(x=>[String(x.id),x]));
 const oldShown=new Map(state.matches.map(x=>[String(x.id),x]));
 const valid=p=>p&&[p.p1,p.px,p.p2].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100);
 for(const game of liveMatches){
  if(!game?.id||!game.home||!game.away||!Number.isFinite(Date.parse(game.date)))continue;
  const old=all.get(String(game.id));
  all.set(String(game.id),old?{...old,...game,logos:{...(old.logos||{}),...(game.logos||{})}}:game);
 }
 // A partially available provider snapshot must not erase the previously shown live percentages.
 for(const [id,m] of all){
  if(!live(m)||valid(m.live_outlook)||valid(m.live_prediction))continue;
  const prev=oldShown.get(id);
  if(!prev||prev.home_id!==m.home_id||prev.away_id!==m.away_id||prev.date!==m.date)continue;
  const estimate=valid(prev.live_outlook)?'live_outlook':valid(prev.live_prediction)?'live_prediction':null;
  if(!estimate)continue;
  all.set(id,{...m,[estimate]:prev[estimate],live_probability_stale:true,
   live_probability_updated_at:prev.live_probability_updated_at||state.liveUpdatedAt||null,
   live_probability_score:prev.live_probability_score||[prev.home_score,prev.away_score],
   live_probability_minute:prev.live_probability_minute??prev.minute??null});
 }
 state.matches=[...all.values()].filter(x=>x?.id&&x.home&&x.away&&Number.isFinite(Date.parse(x.date)))
  .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 rememberFixtures();render();
}
async function refresh(){
 if(updating)return;updating=true;
 try{
  const controller=new AbortController(),abort=setTimeout(()=>controller.abort(),16000);
  let payload;
  try{const response=await fetch('/api/home-focus',{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
   if(!response.ok)throw Error('fixture_api');payload=await response.json()}
  finally{clearTimeout(abort)}
  if(!Array.isArray(payload?.matches))throw Error('fixture_shape');
  baseMatches=payload.matches.filter(x=>x?.id&&x.home&&x.away&&Number.isFinite(Date.parse(x.date)));
  state.loading=false;state.error='';state.fromCache=false;paintMatches();
 }catch{state.loading=false;if(!state.matches.length)state.error='Προσωρινό πρόβλημα σύνδεσης δεδομένων.';render()}
 finally{updating=false}
}
async function refreshLive(){
 if(liveUpdating||document.hidden)return;liveUpdating=true;
 try{
  const controller=new AbortController(),abort=setTimeout(()=>controller.abort(),18000);
  let snapshot;
  try{const response=await fetch('/api/live',{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
   if(!response.ok)throw Error('live_backend_unavailable');snapshot=await response.json()}
  finally{clearTimeout(abort)}
  if(!Array.isArray(snapshot?.matches)){
   state.livePending=true;render();return;
  }
  const timestamp=Date.parse(snapshot.updated_at);
  if(!Number.isFinite(timestamp)||timestamp>Date.now()+60000||Date.now()-timestamp>900000){
   state.livePending=true;render();return;
  }
  liveMatches=snapshot.matches;
  state.liveUpdatedAt=snapshot.updated_at;state.livePending=!!(snapshot.refreshing||snapshot.stale||snapshot.pending);
  paintMatches();
 }catch{state.livePending=true;render()}
 finally{liveUpdating=false}
}
async function loadUefaStages(){try{const r=await fetch('/api/uefa/stages',{headers:{Accept:'application/json'}});if(!r.ok)return;const d=await r.json();if(!Array.isArray(d?.leagues))return;for(const league of d.leagues)for(const stage of league.stages||[]){if(Number.isSafeInteger(stage.id)&&typeof stage.name==='string')uefaStageById.set(stage.id,stage.name)}if(uefaStageById.size)render();}catch{}}
function init(){document.body.appendChild(root);document.documentElement.classList.add('td-mobile-ready');restoreFixtures();baseMatches=state.matches.slice();render();void refresh();void refreshLive();void loadUefaStages();setInterval(()=>{if(!document.hidden)void refresh()},300000);setInterval(()=>{if(!document.hidden)void refreshLive()},20000)}
window.matchMedia('(min-width:781px)').addEventListener('change',()=>{if(root.isConnected)render()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();