/* Tiki-Data theme: light / dark mode with a header toggle.
   Loaded in <head> (not deferred) so the saved theme applies before first paint. */
(function () {
  var KEY = 'td-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function current() {
    return saved() || 'dark';
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#06080d' : '#ffffff');
    var btn = document.querySelector('.td-theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = btn.getAttribute('aria-label');
    }
  }

  apply(current());
  if (media && media.addEventListener) {
    media.addEventListener('change', function () { if (!saved()) apply(current()); });
  }

  var ICON =
    '<svg class="td-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>' +
    '<svg class="td-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';

  // mobile-ui.js re-renders the header, so the toggle is re-attached whenever it disappears.
  function mount() {
    var auth = document.querySelector('#td-mobile-root .tdm-top .tdm-auth-nav');
    if (!auth || auth.querySelector('.td-theme-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'td-theme-toggle';
    btn.innerHTML = ICON;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
    });
    auth.insertBefore(btn, auth.firstChild);
    apply(current());
  }

  // Loading feedback: mobile-ui.js renders "—" KPIs and a "Φόρτωση…/Loading…" message
  // while data is in flight; tag them so the stylesheet can show skeletons instead.
  var LOADING = /(\u03a6\u03cc\u03c1\u03c4\u03c9\u03c3\u03b7|Loading)/i;
  function markLoading() {
    var r = document.getElementById('td-mobile-root');
    if (!r) return;
    var kpis = r.querySelectorAll('.tdm-kpi b, .tdm-audit-kpis b');
    for (var i = 0; i < kpis.length; i++) kpis[i].classList.toggle('td-pending', kpis[i].textContent.trim() === '—');
    var empties = r.querySelectorAll('.tdm-empty');
    for (var j = 0; j < empties.length; j++) empties[j].classList.toggle('td-loading', LOADING.test(empties[j].textContent));
  }

  // Greek strings inside an English page: mark them lang="el" so uppercase headings drop
  // their accents (Greek typesetting) and screen readers use Greek pronunciation.
  var GREEK = /[\u0370-\u03ff\u1f00-\u1fff]/;
  function markGreek() {
    var r = document.getElementById('td-mobile-root');
    if (!r || (document.documentElement.lang || '').indexOf('el') === 0) return;
    var all = r.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.hasAttribute('lang')) continue;
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && GREEK.test(n.nodeValue)) { el.setAttribute('lang', 'el'); break; }
      }
    }
  }

  // Filter console (Matches page). The three chip rows become one panel: the mode chips form a
  // segmented switch and the league chips collapse behind a "Leagues" button. The app's own
  // buttons are moved, not recreated, so mobile-ui.js's delegated click handler keeps working.
  // The search field is never moved: the app re-focuses it after every keystroke.
  var leaguesOpen = false;
  var CHEVRON = '<svg class="td-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function setLeaguesOpen(open) {
    leaguesOpen = open;
    var bar = document.querySelector('#td-mobile-root .td-filterbar');
    if (!bar) return;
    bar.classList.toggle('is-open', open);
    var t = bar.querySelector('.td-league-toggle');
    if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function enhanceFilters() {
    var main = document.querySelector('#td-mobile-root main');
    var days = main && main.querySelector('.tdm-day-chips');
    if (!days || main.querySelector('.td-filterbar')) return;
    var modeBtn = main.querySelector('.tdm-chips [data-mode]');
    var leagueBtn = main.querySelector('.tdm-chips [data-league]');
    if (!modeBtn || !leagueBtn) return;
    var modeRow = modeBtn.parentNode;
    var leagueRow = leagueBtn.parentNode;

    var bar = document.createElement('section');
    bar.className = 'td-filterbar' + (leaguesOpen ? ' is-open' : '');
    bar.setAttribute('aria-label', 'Filters');
    main.insertBefore(bar, modeRow);

    var top = document.createElement('div');
    top.className = 'td-filterbar-top';
    modeRow.classList.add('td-seg');
    modeRow.setAttribute('role', 'group');
    top.appendChild(modeRow);

    var active = leagueRow.querySelector('[data-league].active') || leagueBtn;
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'td-league-toggle';
    toggle.setAttribute('aria-controls', 'td-league-panel');
    toggle.setAttribute('aria-expanded', leaguesOpen ? 'true' : 'false');
    if (active.getAttribute('data-league') !== 'all') toggle.setAttribute('data-lg', active.getAttribute('data-league'));
    var crest = active.querySelector('img');
    if (crest) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = crest.getAttribute('src');
      toggle.appendChild(img);
    }
    var label = document.createElement('span');
    label.className = 'td-league-label';
    label.textContent = active.textContent.trim();
    toggle.appendChild(label);
    toggle.insertAdjacentHTML('beforeend', CHEVRON);
    toggle.addEventListener('click', function () { setLeaguesOpen(!leaguesOpen); });
    top.appendChild(toggle);
    bar.appendChild(top);

    leagueRow.id = 'td-league-panel';
    leagueRow.classList.add('td-league-panel');
    // Picking a league closes the panel; the app then re-renders with the new filter.
    leagueRow.addEventListener('click', function (e) { if (e.target.closest('[data-league]')) leaguesOpen = false; });
    bar.appendChild(leagueRow);
    bar.appendChild(days);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && leaguesOpen) setLeaguesOpen(false); });
  document.addEventListener('click', function (e) {
    if (leaguesOpen && !e.target.closest('.td-filterbar')) setLeaguesOpen(false);
  });

  // Match page: read the numbers the app rendered to draw head-to-head bars for live stats,
  // flag the favourite 1X2 tile, and add a bar to percentage rows in goal scenarios.
  function num(el) {
    var v = parseFloat(String((el && el.textContent) || '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return isFinite(v) ? v : null;
  }
  function enhanceMatch() {
    var r = document.getElementById('td-mobile-root');
    if (!r || !r.querySelector('.tdm-match-content')) return;
    // The sticky section tabs sit directly under the sticky header, whatever its height.
    var top = r.querySelector('.tdm-top');
    if (top) document.documentElement.style.setProperty('--mx-header-h', top.offsetHeight + 'px');
    var rows = r.querySelectorAll('.tdm-stat-grid-row:not(.tdm-stat-grid-head)');
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i].querySelectorAll('b');
      if (b.length < 2) continue;
      var h = num(b[0]), a = num(b[1]);
      if (h === null || a === null) continue;
      var total = h + a;
      rows[i].style.setProperty('--h', total ? (h / total).toFixed(3) : '0');
      rows[i].style.setProperty('--a', total ? (a / total).toFixed(3) : '0');
      rows[i].classList.add('td-h2h');
      b[0].classList.toggle('td-lead', h > a);
      b[1].classList.toggle('td-lead', a > h);
    }
    var groups = r.querySelectorAll('.tdm-probs');
    for (var g = 0; g < groups.length; g++) {
      var tiles = groups[g].querySelectorAll('.tdm-prob'), best = null, top = -1;
      for (var k = 0; k < tiles.length; k++) {
        var v = num(tiles[k].querySelector('b'));
        tiles[k].classList.remove('td-fav');
        if (v !== null && v > top) { top = v; best = tiles[k]; }
      }
      if (best) best.classList.add('td-fav');
    }
    var scen = r.querySelectorAll('.tdm-large-stats .tdm-row');
    for (var s = 0; s < scen.length; s++) {
      var val = scen[s].querySelector('b'), p = val && /%/.test(val.textContent) ? num(val) : null;
      scen[s].classList.toggle('td-pbar', p !== null);
      if (p !== null) scen[s].style.setProperty('--p', (Math.max(0, Math.min(100, p)) / 100).toFixed(3));
    }
  }

  // Keep the tab title in step with in-app navigation (the server sets the same titles on load).
  var TITLES = {
    home: ['Football predictions & live 1X2 probabilities', 'Ποδοσφαιρικά προγνωστικά & πιθανότητες 1Χ2'],
    matches: ['Football fixtures & 1X2 predictions today', 'Πρόγραμμα αγώνων & προγνωστικά 1Χ2 σήμερα'],
    live: ['Live football scores & in-play probabilities', 'Live ποδόσφαιρο: σκορ & πιθανότητες σε πραγματικό χρόνο'],
    transparency: ['Prediction accuracy & transparency report', 'Ακρίβεια προβλέψεων & διαφάνεια']
  };
  function updateTitle() {
    var r = document.getElementById('td-mobile-root');
    if (!r) return;
    var el = window.__tdLocale === 'el', title = null;
    var teams = r.querySelectorAll('.tdm-match-team h1');
    if (teams.length === 2) {
      var a = teams[0].textContent.trim(), b = teams[1].textContent.trim();
      if (a && b) title = el ? 'Προγνωστικό ' + a + ' - ' + b : a + ' vs ' + b + ' prediction';
    } else {
      var p = location.pathname, q = new URLSearchParams(location.search);
      var key = p.indexOf('/transparency') === 0 ? 'transparency' : p.indexOf('/predictions') === 0 ? (q.get('filter') === 'live' ? 'live' : 'matches') : p === '/' ? 'home' : null;
      if (key && !q.get('league')) title = TITLES[key][el ? 1 : 0];
    }
    if (title) {
      title += ' | Tiki-Data';
      if (document.title !== title) document.title = title;
    }
  }

  var queued = false;
  function refresh() {
    // Synchronous: MutationObserver callbacks run before paint, so the filter console and
    // match bars are in place before the re-rendered page is drawn (no flash).
    enhanceFilters();
    enhanceMatch();
    if (queued) return;
    queued = true;
    // A timer, not requestAnimationFrame: rAF is paused in background tabs.
    setTimeout(function () { queued = false; mount(); markLoading(); markGreek(); updateTitle(); }, 30);
  }

  function start() {
    // Entrance animations are for the first paint only; mobile-ui.js re-renders on every
    // live refresh and would otherwise replay them (content blinking out and back in).
    setTimeout(function () { root.classList.add('td-booted'); }, 1400);
    enhanceFilters();
    enhanceMatch();
    mount();
    markLoading();
    markGreek();
    new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true, characterData: true });
    // Installable app: the service worker only provides an offline screen (no data caching).
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

(()=>{'use strict';
const deepCache=new Map(),deepLoading=new Set();
const favKey='tiki.followedTeams.v2',params=new URLSearchParams(location.search),state={view:params.get('account')==='1'?'account':location.pathname.startsWith('/transparency')?'transparency':location.pathname.includes('/predictions')?(params.get('match')&&/^(?:sportmonks|football-api(?:-fixture)?)-[1-9]\d{0,13}$/.test(params.get('match'))?'detail':params.get('filter')==='live'?'live':'matches'):'home',previous:['home','matches','live','teams'].includes(params.get('from'))?params.get('from'):params.get('filter')==='live'?'live':'matches',mode:params.get('filter')==='live'?'live':'all',league:['ucl','uel','uecl'].includes(params.get('league'))?params.get('league'):'all',day:'all',query:'',tab:'summary',id:/^(?:sportmonks|football-api(?:-fixture)?)-[1-9]\d{0,13}$/.test(params.get('match')||'')?params.get('match'):'',matches:[],loading:true,error:'',fromCache:false,visible:42,liveUpdatedAt:'',livePending:false};
let followed=[];try{const f=JSON.parse(localStorage.getItem(favKey)||'[]');if(Array.isArray(f))followed=f.filter(v=>typeof v==='string')}catch{}
let guestFollowed=followed.slice(),accountUser=null,accountCsrf='',loginEnabled=null,accountLeagues=[],accountError='';let saving=Promise.resolve();
let accountLoaded=false,accountLoading=false;
const authResult=(new URLSearchParams(location.search)).get('signin')||'';
const authText={success:'Η Google επιβεβαίωσε τη σύνδεση. Φορτώνονται οι ρυθμίσεις σου…',start_error:'Δεν ξεκίνησε η σύνδεση. Ελέγξτε τη σύνδεση Cloudflare και δοκιμάστε ξανά.',google_denied:'Η Google δεν επέτρεψε τη σύνδεση. Αν η εφαρμογή βρίσκεται σε Testing, πρόσθεσε το Google email σου στους Test users.',flow_error:'Η αίτηση σύνδεσης έληξε ή το cookie ελέγχου δεν βρέθηκε. Δοκίμασε ξανά από το ίδιο πρόγραμμα περιήγησης.',token_error:'Η Google δεν ολοκλήρωσε την ανταλλαγή του κωδικού OAuth. Έλεγξε το Client Secret και το Redirect URI.',identity_error:'Η ταυτότητα Google δεν επαληθεύτηκε. Δοκίμασε ξανά ή επικοινώνησε με τη διαχείριση.',storage_error:'Η σύνδεση Google προχώρησε, αλλά δεν αποθηκεύτηκε η συνεδρία στη βάση.',failed:'Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.'};
if(authText[authResult])accountError=authText[authResult];
if(authResult&&authText[authResult]&&state.view==='home')state.view='account';
const uefaStageById=new Map();
const stageLabel=m=>Number.isSafeInteger(m?.stage_id)?uefaStageById.get(m.stage_id)||null:null;
// Site footer. Built at render time (not at load) so it follows the active language:
// locale.js sets window.__tdLocale after this file has loaded.
const siteFooter=()=>{
 const en=window.__tdLocale==='en';
 const t=(el,eng)=>en?eng:el;
 const col=(head,links)=>'<div class="tdm-footer-col"><h4>'+head+'</h4>'+links.map(([href,label])=>'<a href="'+href+'">'+label+'</a>').join('')+'</div>';
 return '<footer class="tdm-site-footer tdm-footer-pro" aria-label="'+t('Σχετικά και πολιτικές','About and policies')+'">'+
  '<div class="tdm-footer-brand"><a href="/" class="tdm-footer-logo" aria-label="Tiki-Data"></a>'+
  '<p>'+t('Ποδοσφαιρικά δεδομένα: πραγματικοί αγώνες, live στατιστικά και διαφανείς εκτιμήσεις 1Χ2.','Football intelligence: real fixtures, live statistics and transparent 1X2 estimates.')+'</p></div>'+
  '<nav class="tdm-footer-cols" aria-label="'+t('Πληροφορίες','Information')+'">'+
  col(t('Πλατφόρμα','Platform'),[['/',t('Αρχική','Home')],['/predictions',t('Αγώνες','Matches')],['/predictions?filter=live','Live'],['/transparency',t('Διαφάνεια','Transparency')]])+
  col(t('Διοργανώσεις','Competitions'),UEFA_FILTERS.map(([key,label])=>['/predictions?league='+key,label]))+
  col(t('Εταιρεία','Company'),[['/about',t('Σχετικά','About')],['/contact',t('Επικοινωνία','Contact')]])+
  col(t('Νομικά','Legal'),[['/privacy',t('Απόρρητο','Privacy')],['/terms',t('Όροι','Terms')],['/cookies','Cookies']])+
  '</nav>'+
  '<div class="tdm-footer-bottom"><span>© 2026 Tiki-Data</span><span>'+t('Στατιστικές εκτιμήσεις, όχι στοιχηματικές αποδόσεις.','Statistical estimates, not betting odds.')+'</span></div>'+
  '</footer>';
};
// Templates concatenate SITE_FOOTER as a string; toString() renders it in the current language.
const SITE_FOOTER={toString:siteFooter};

let auditArchive={matches:[]},auditLoading=true,auditError='';
let auditLoaded=false,auditPromise=null;
let auditFilter='all',auditLeague='all',auditDay='all';
const auditDayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Nicosia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function auditOutcome(m){
 const p=m.probabilities,valid=Array.isArray(p)&&p.length===3&&p.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1)&&Math.abs(p.reduce((a,b)=>a+b,0)-1)<0.01;
 const top=valid?Math.max(...p):null,pick=valid?p.indexOf(top):-1;
 const final=m.final===true&&Number.isInteger(m.home_score)&&Number.isInteger(m.away_score);
 const actual=final?(m.home_score>m.away_score?0:m.home_score===m.away_score?1:2):-1;
 return {pick:pick<0?'—':['1','Χ','2'][pick],confidence:top===null?null:top*100,status:valid&&final&&p.filter(x=>x===top).length===1?(pick===actual?'hit':'miss'):'pending'};
}
const auditLeagueBadge=k=>{const url=auditArchive.matches.find(m=>m.league_key===k)?.league_logo;return url?'<img class="tdm-audit-league-logo" src="'+E(url)+'" loading="lazy" alt="">':''};
function transparency(){
 const all=auditArchive.matches.filter(m=>m.final===true&&Number.isInteger(m.home_score)&&Number.isInteger(m.away_score));
 const hits=all.filter(m=>auditOutcome(m).status==='hit').length,misses=all.filter(m=>auditOutcome(m).status==='miss').length;
 const rows=all.filter(m=>(auditLeague==='all'||m.league_key===auditLeague)&&(auditDay==='all'||auditDayKey(m.kickoff)===auditDay)&&(auditFilter==='all'||auditOutcome(m).status===auditFilter));
 const today=auditDayKey(Date.now());
 const local=x=>new Date(x).toLocaleString(window.__tdLocale==='el'?'el-GR':'en-GB',{timeZone:'Asia/Nicosia',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 return lead('Διαφάνεια','Οι προβλέψεις μας, δίπλα στα πραγματικά αποτελέσματα.')+
 '<section class="tdm-audit-intro"><span class="tdm-audit-date">Έλεγχος αγώνων · από 18 Οκτωβρίου 2026</span><h2>Κάθε αποτέλεσμα μετράει.</h2><p>Οι ολοκληρωμένοι αγώνες από 18/10/2026, με τις καταγεγραμμένες προβλέψεις και τα τελικά τους αποτελέσματα.</p><div class="tdm-audit-actions"><a href="/api/transparency" class="tdm-link">Δεδομένα ελέγχου ↗</a></div></section>'+
 '<div class="tdm-audit-kpis"><div><b>'+(auditLoading?'—':all.length)+'</b><span>Ολοκληρωμένοι αγώνες</span></div><div><b class="tdm-audit-green">'+(auditLoading?'—':hits)+'</b><span>Επιβεβαιώσεις</span></div><div><b class="tdm-audit-red">'+(auditLoading?'—':misses)+'</b><span>Απορρίψεις</span></div><div><b>'+(auditLoading?'—':pct(hits/(hits+misses)*100))+'</b><span>Γενικό ποσοστό επιτυχίας 1Χ2</span></div></div>'+
 '<details class="tdm-panel tdm-audit-method"><summary>Πώς γίνεται ο έλεγχος</summary><p>Τελευταία αποθηκευμένη πρόβλεψη αυστηρά πριν από τη σέντρα. Η επιτυχία αφορά μόνο μοναδική επιλογή 1Χ2 με τελικό σκορ κανονικής διάρκειας. Το γενικό ποσοστό περιλαμβάνει όλους τους αξιολογήσιμους αγώνες από 18/10 και δεν αλλάζει με τα φίλτρα ημέρας ή διοργάνωσης. Οι αγώνες χωρίς καταγραφή δεν προσμετρώνται. Το αρχείο περιλαμβάνει και παλιότερες εκδόσεις με μικτή προέλευση πιθανοτήτων. Δεν υπολογίζουμε αναδρομικές προβλέψεις. Ώρες Κύπρου.</p></details>'+
 '<div class="tdm-date-control tdm-audit-calendar"><button class="tdm-chip" data-audit-shift="-1" aria-label="Προηγούμενη ημέρα" '+(auditDay==='2026-10-18'?'disabled':'')+'>‹</button><label>Ημερομηνία <input type="date" data-audit-day min="2026-10-18" max="'+today+'" value="'+(auditDay==='all'?'':auditDay)+'" aria-label="Ημερομηνία αγώνων διαφάνειας"></label><button class="tdm-chip" data-audit-shift="1" aria-label="Επόμενη ημέρα" '+(auditDay===today?'disabled':'')+'>›</button><button class="tdm-chip" data-audit-all-days>Όλες οι ημέρες</button></div>'+
 '<div class="tdm-section"><h2>Αναλυτικά αποτελέσματα</h2><span>'+rows.length+' / '+all.length+' αγώνες</span></div><div class="tdm-chips">'+[['all','Όλοι'],['hit','Επιβεβαιώσεις'],['miss','Απορρίψεις']].map(([v,t])=>'<button data-audit-status="'+v+'" aria-pressed="'+(auditFilter===v)+'" class="tdm-chip '+(auditFilter===v?'active':'')+'">'+t+'</button>').join('')+'</div>'+
 '<div class="tdm-chips" aria-label="Φίλτρο διοργάνωσης">'+[['all','Όλες οι λίγκες'],...Array.from(new Map(all.map(m=>[m.league_key,m.league])).entries())].map(([k,n])=>'<button data-audit-league="'+E(k)+'" aria-pressed="'+(auditLeague===k)+'" class="tdm-chip '+(auditLeague===k?'active':'')+'">'+auditLeagueBadge(k)+E(n)+'</button>').join('')+'</div>'+
 '<p role="status">'+(auditLoading?'Φόρτωση όλων των αγώνων…':E(auditError))+'</p><div class="tdm-audit-grid">'+rows.map(m=>{const o=auditOutcome(m);return '<article class="tdm-panel tdm-audit-card"><div class="tdm-audit-card-top"><span>'+auditLeagueBadge(m.league_key)+E(m.league)+'</span><time datetime="'+E(m.kickoff)+'">'+E(local(m.kickoff))+'</time></div><div class="tdm-audit-score">'+club(m.home,logoH(m))+'<b>'+(m.home_score??'—')+' – '+(m.away_score??'—')+'</b>'+club(m.away,logoA(m))+'</div><div class="tdm-audit-verdict"><span>Πρόβλεψη <b>'+o.pick+'</b> · '+(o.confidence===null?'Χωρίς αποθηκευμένη πρόβλεψη':pct(o.confidence))+'</span><span class="tdm-audit-pill '+o.status+'">'+(o.status==='hit'?'✓ Επιβεβαίωση':o.status==='miss'?'× Απόρριψη':'Χωρίς αξιολόγηση')+'</span></div><details class="tdm-audit-proof"><summary>Καταγραφή & πιθανότητες</summary><p>1: '+pct((m.probabilities?.[0]??NaN)*100)+' · Χ: '+pct((m.probabilities?.[1]??NaN)*100)+' · 2: '+pct((m.probabilities?.[2]??NaN)*100)+'</p><p>Καταγράφηκε: '+(m.captured_at?E(local(m.captured_at)):'—')+' · Έκδοση '+E(m.model_version||'—')+'</p><small>'+E(m.fixture_id)+' · Log '+(m.log_id??'—')+'</small></details></article>'}).join('')+'</div>';
}

const root=document.createElement('div');root.id='td-mobile-root';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').toLocaleLowerCase('el').trim(),isFav=v=>followed.some(x=>norm(x)===norm(v));
const icon={transparency:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/>',account:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3" fill="currentColor" stroke="none"/><path d="M6.5 18a5.5 5.5 0 0 1 11 0" fill="currentColor" stroke="none"/>',home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',matches:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 4v4m8-4v4"/>',live:'<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10"/>',teams:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.6l-5.7 2.9 1.1-6.3-4.6-4.5 6.4-.9z"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'};
const ico=k=>'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon[k]+'</svg>';
const when=x=>{try{return new Date(x).toLocaleString(window.__tdLocale==='el'?'el-GR':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch{return '—'}};
const live=m=>['LIVE','1H','2H','1ST','2ND','HT','ET'].includes(String(m?.status||'').toUpperCase());
const score=m=>Number.isInteger(m?.home_score)&&Number.isInteger(m?.away_score)?m.home_score+' : '+m.away_score:'VS';
const pct=x=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString(window.__tdLocale==='el'?'el-GR':'en-GB',{maximumFractionDigits:1})+'%':'—';
const trusted=x=>typeof x==='string'&&(/^https:\/\/(cdn\.sportmonks\.com|cdn\.football-api\.com|raw\.githubusercontent\.com|d2ol7oe51mr4n9\.cloudfront\.net)\//.test(x)||/^\/badges\/[1-9]\d{0,9}\.png$/.test(x)||/^\/league-logos\/[a-z0-9][a-z0-9-]{1,79}\.png$/.test(x));
const badge=(name,url)=>trusted(url)?'<img src="'+E(url)+'" loading="lazy" alt="'+E(name)+'">':'<span class="tdm-team-avatar">'+E(String(name).slice(0,2).toUpperCase())+'</span>';
const club=(n,l)=>'<div class="tdm-team">'+badge(n,l)+'<strong>'+E(n)+'</strong></div>';
const UEFA_FILTERS=[['ucl','Champions League','UCL'],['uel','Europa League','UEL'],['uecl','Conference League','UECL']];
const source=m=>({team:'Ιστορικό ομάδων',partial_team:'Μερικό ιστορικό',league:'Μέσοι όροι λίγκας',cross_league:'Γενική βάση · χαμηλή βεβαιότητα'})[m.prediction_tier]||(m.prediction_tier==='provider'?'SportMonks · 1X2':'Πειραματική ανάλυση');
const valid123=p=>p&&[p.p1,p.px,p.p2].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100)&&Math.abs(p.p1+p.px+p.p2-100)<1;
const pr=m=>{if(live(m))return [m.live_outlook,m.live_prediction].find(valid123)||null;if(m.forecast_review?.status==='withheld')return valid123(m.experimental_preview)?m.experimental_preview:null;return valid123(m)?m:null};
const is29=n=>/(omoni|ομον)/i.test(String(n||''))&&/29/.test(String(n||''))&&/(mai|may|μα[ιΐ]|maio)/i.test(String(n||''));
const logoH=m=>is29(m.home)?"https://d2ol7oe51mr4n9.cloudfront.net/user_3KbDlDrtS3WJpvJUdX17ksOLOSL/753375b7-7137-4e56-99bc-b3ca04d2249c.jpg":m.logos?.home||m.home_logo,logoA=m=>is29(m.away)?"https://d2ol7oe51mr4n9.cloudfront.net/user_3KbDlDrtS3WJpvJUdX17ksOLOSL/753375b7-7137-4e56-99bc-b3ca04d2249c.jpg":m.logos?.away||m.away_logo;
const stamp=m=>live(m)?'<span class="tdm-live">● LIVE '+(Number.isInteger(m.minute)?m.minute+'′':'')+'</span>':E(when(m.date));
const row=(a,b)=>'<div class="tdm-row"><span>'+E(a)+'</span><b>'+E(b??'—')+'</b></div>';
const title=(a,link,v)=>'<div class="tdm-section"><h2>'+E(a)+'</h2>'+(link?'<button class="tdm-link" data-view="'+v+'">'+E(link)+' →</button>':'')+'</div>';
const lead=(h,p)=>'<span class="tdm-kicker">TIKI-DATA · FOOTBALL INTELLIGENCE</span><h1>'+E(h)+'</h1><p class="tdm-lead">'+E(p)+'</p>';
const kpis=()=>'<div class="tdm-kpis">'+[['Αγώνες',state.matches.length],['Live',state.matches.filter(coveredLive).length],['Με εκτίμηση',state.matches.filter(m=>!!pr(m)).length]].map(([x,y],i)=>'<div class="tdm-kpi '+(i===1?'live':'')+'"><b>'+(state.loading&&!state.matches.length?'—':y)+'</b><span>'+x+'</span></div>').join('')+'</div>';
const liveUpdateLabel=()=>state.liveUpdatedAt||state.livePending?'<div class="tdm-live-status">'+(state.liveUpdatedAt?'● Live ενημέρωση '+E(when(state.liveUpdatedAt)):'Επεξεργασία live στοιχείων στο Cloudflare…')+(state.livePending?' · αναμονή νεότερων δεδομένων':'')+'</div>':'';
const dayKey=d=>{const x=new Date(d);if(!Number.isFinite(+x))return '';return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const miniProb=m=>{const p=pr(m);return '<span class="tdm-central-probs" aria-label="Πιθανότητες 1 Χ 2">'+['1','Χ','2'].map((t,i)=>'<span><small>'+t+'</small><b>'+pct(p?[p.p1,p.px,p.p2][i]:null)+'</b></span>').join('')+'</span>'};
function cardEvidence(m){
 const en=window.__tdLocale==='en',t=(el,eng)=>en?eng:el,e=m.statistical_evidence;
 const value=x=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString(en?'en-GB':'el-GR',{maximumFractionDigits:1}):'—';
 const h=e?.home,a=e?.away,rows=[];
 const add=(label,hv,av)=>{if([hv,av].some(x=>typeof x==='number'&&Number.isFinite(x)))rows.push('<div class="tdm-evidence-row"><b>'+value(hv)+'</b><span>'+label+'</span><b>'+value(av)+'</b></div>')};
 if(h||a){
  add(t('Πρόσφατοι αγώνες','Recent matches'),h?.n,a?.n);
  add(t('Γκολ / αγώνα','Goals / match'),h?.for?.goals,a?.for?.goals);
  add(t('Γκολ κατά / αγώνα','Conceded / match'),h?.against?.goals,a?.against?.goals);
  add(t('Σουτ / αγώνα','Shots / match'),h?.for?.['shots-total'],a?.for?.['shots-total']);
  add(t('Κατοχή %','Possession %'),h?.for?.['ball-possession'],a?.for?.['ball-possession']);
 }
 add(t('Ιστορικό: εντός / εκτός','History: home / away'),m.historical_sample?.home,m.historical_sample?.away);
 if(!rows.length)return '<p class="tdm-note">'+t('Τα στατιστικά φορτώνονται στην ανάλυση αγώνα.','Open match analysis for available statistics.')+'</p>';
 return '<div class="tdm-card-evidence"><div class="tdm-evidence-heading">'+t('ΣΤΑΤΙΣΤΙΚΑ ΟΜΑΔΩΝ','TEAM STATISTICS')+'</div>'+rows.join('')+'<small>'+t('Αριστερά: γηπεδούχος · δεξιά: φιλοξενούμενη. Πρόσφατοι σταθμισμένοι μέσοι όροι από όλες τις διαθέσιμες διοργανώσεις.','Left: home team · right: away team. Recent weighted averages across available competitions.')+(e?.additional_statistics_stale?' · '+t('Το στιγμιότυπο χρειάζεται ανανέωση.','Snapshot needs refreshing.'):'')+'</small></div>';
}
const missingUefaEvidence=m=>m.forecast_review?.status==='withheld'?'<span class="tdm-older-estimate">'+(pr(m)?(document.documentElement.lang==='en'?'Experimental 1X2 · accuracy not independently verified':'Πειραματικό 1Χ2 · μη ανεξάρτητα επαληθευμένη ακρίβεια'):(document.documentElement.lang==='en'?'Probabilities unavailable: insufficient model evidence':'Δεν υπάρχουν επαρκή στοιχεία για αριθμητική εκτίμηση'))+'</span>':!live(m)&&pr(m)&&['partial_team','league','cross_league'].includes(m.prediction_tier)?'<span class="tdm-older-estimate">'+(m.prediction_tier==='partial_team'?'Περιορισμένο ιστορικό · χαμηλή βεβαιότητα':'Βασική στατιστική εκτίμηση · ανεπαρκές ιστορικό ομάδων')+'</span>':!live(m)&&!pr(m)?'<span class="tdm-older-estimate">Δεν υπάρχουν επαρκή επαληθευμένα δεδομένα για εκτίμηση</span>':'';
const olderEstimateTag=m=>{
 if(!live(m)||!pr(m)||(!valid123(m.live_outlook)&&!valid123(m.live_prediction))||!(m.live_probability_stale||state.livePending))return '';
 const saved=m.live_probability_updated_at||state.liveUpdatedAt;
 const recorded=Array.isArray(m.live_probability_score)?m.live_probability_score:null;
 const scoreChanged=recorded&&Number.isInteger(recorded[0])&&Number.isInteger(recorded[1])&&
   (recorded[0]!==m.home_score||recorded[1]!==m.away_score);
 return '<span class="tdm-older-estimate">◷ Προηγούμενη εκτίμηση'+(saved?' · '+E(when(saved)):'')+
  (scoreChanged?' · πριν την αλλαγή σκορ':'')+'</span>';
};
const calendarBadge=k=>{const d=new Date(k+'T12:00:00'),month=d.toLocaleDateString(window.__tdLocale==='el'?'el-GR':'en-GB',{month:'short'}).replace('.','');return '<span class="tdm-calendar-badge" aria-hidden="true"><small>'+E(month)+'</small><b>'+d.getDate()+'</b></span>'};
const leagueBadge=k=>{const url=state.matches.find(m=>m.league_key===k&&trusted(m.league_logo))?.league_logo||({ucl:'/league-logos/ucl.png',uel:'/league-logos/uel.png',uecl:'/league-logos/uecl.png'})[k];return trusted(url)?'<img class="tdm-tab-league-logo" src="'+E(url)+'" alt="" loading="lazy">':'<svg class="tdm-tab-league-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 12v7m-4 2h8"/></svg>'};
const coveredLive=m=>live(m)&&Date.now()-Date.parse(state.liveUpdatedAt)<85000&&liveMatches.some(x=>String(x.id)===String(m.id)&&Number.isInteger(x.home_score)&&Number.isInteger(x.away_score)&&(Number.isInteger(x.minute)||x.status==='HT'));
const matchesForFilters=()=>state.matches.filter(m=>(state.view==='live'?coveredLive(m):state.mode==='live'?coveredLive(m):state.mode==='favorites'?isFav(m.home)||isFav(m.away):true)&&(state.league==='all'||state.league===m.league_key)&&(!state.query||norm(m.home+' '+m.away+' '+m.league).includes(norm(state.query))));
const availableDays=()=>[...new Set(matchesForFilters().map(m=>dayKey(m.date)))].filter(Boolean).sort();
function ensureAvailableDay(){const days=availableDays();if(!days.length){state.day='all';return}if(state.day!=='all'&&days.includes(state.day))return;const today=dayKey(new Date());state.day=days.find(k=>k>=today)||days[days.length-1]}
const dateChips=()=>{const days=availableDays(),today=dayKey(new Date()),tomorrow=dayKey(Date.now()+86400000);return '<div class="tdm-chips tdm-day-chips" aria-label="Φίλτρο ανά ημέρα"><button data-day="all" class="tdm-chip '+(state.day==='all'?'active':'')+'">Όλες</button>'+days.map(k=>'<button data-day="'+k+'" aria-label="'+E(new Date(k+'T12:00:00').toLocaleDateString(window.__tdLocale==='el'?'el-GR':'en-GB',{weekday:'long',day:'numeric',month:'long'}))+'" class="tdm-chip tdm-calendar-chip '+(state.day===k?'active':'')+'">'+calendarBadge(k)+'<span>'+(k===today?'Σήμερα':k===tomorrow?'Αύριο':E(new Date(k+'T12:00:00').toLocaleDateString(window.__tdLocale==='el'?'el-GR':'en-GB',{weekday:'short'})))+'</span></button>').join('')+'</div>'};
const liveStatsLabels={on_target:'Σουτ στην εστία',shots:'Σουτ',dangerous:'Επικίνδυνες επιθέσεις',attacks:'Επιθέσεις',possession:'Κατοχή',corners:'Κόρνερ',red:'Κόκκινες κάρτες'};
function liveStatsModelNote(m,compact=false){
 if(!live(m)||!valid123(m.live_outlook))return '';
 if(m.source==='football-api.com'){
  const p=m.live_outlook,label=({team_history:'Ιστορικό ομάδων',league_average:'Μέσος όρος λίγκας',global_average:'Γενικός ιστορικός μέσος όρος',generic_assumption:'Γενική υπόθεση γκολ'})[p.prior_basis]||'Ιστορικό';
  const timing=p.time_basis==='halftime_45'?' · Ημίχρονο: υπολογισμός από 45′':p.time_basis==='one_minute_remaining_assumption'?' · Υπόθεση: απομένει τουλάχιστον 1′':'';
  return '<div class="tdm-live-model-note"><strong>Live predictor · '+E(label)+'</strong>'+(compact?'':'<p>Σκορ '+E(p.observed_score?.join('–'))+' · '+E(label)+E(timing)+'. Πειραματική εκτίμηση χωρίς live στατιστικά κατοχής, σουτ ή επιθέσεων.</p>')+'</div>';
 }
 const p=m.live_outlook,active=p.live_stats_applied===true,stale=!!(m.live_probability_stale||state.livePending);
 const metrics=(p.live_stats_adjustment?.metrics_used||[]).filter(k=>Object.hasOwn(liveStatsLabels,k)).map(k=>liveStatsLabels[k]);
 const title=stale?'Live εκτίμηση · αναμονή ενημέρωσης':active?'● Live stats στο μοντέλο':'Live μοντέλο · χωρίς διόρθωση stats';
 const explanation=stale?'Η ένδειξη αφορά την τελευταία διαθέσιμη εκτίμηση.':active?'Οι πιθανότητες συνυπολογίζουν '+metrics.join(', ')+', μαζί με ιστορικά στοιχεία, σκορ και λεπτό.':'Οι πιθανότητες βασίζονται σε ιστορικά στοιχεία, σκορ και λεπτό. Τα διαθέσιμα stats δεν αλλάζουν αυτή την εκτίμηση.';
 return '<div class="tdm-live-model-note'+(active&&!stale?' is-active':'')+'"><strong>'+E(title)+'</strong>'+(compact?'':'<p>'+E(explanation)+' Πειραματική διόρθωση με περιορισμένη βαρύτητα.</p>')+'</div>';
}
/* Live measurements are sourced from Sportmonks, not from the probability model. */
function liveStatsBlock(m,compact=false){
 if(!live(m))return '';
 // Football-API match statistics are shown in the match page's statistics table (from /api/match), not per live card.
 if(m.source==='football-api.com')return '';
 const rows=Array.isArray(m.live_stats)?m.live_stats:[],show=(compact?['shots','on_target','corners','possession']:['shots','on_target','off_target','blocked','possession','corners','attacks','dangerous','offsides','saves','throwins','goal_kicks','fouls','yellow','red']);
 const relevant=show.map(k=>rows.find(x=>x.key===k)).filter(Boolean);
 if(!relevant.length)return compact?'<p class="tdm-live-stat-hint">Δεν υπάρχουν ακόμη live μετρήσεις.</p>':'<section class="tdm-panel"><h3>LIVE · Tiki-Data Lab</h3><p class="tdm-lead">Δεν έχουν δημοσιευθεί πραγματικές μετρήσεις για αυτόν τον αγώνα.</p></section>';
 const stats=relevant.slice(0,compact?4:15).map(v=>'<div class="tdm-stat-grid-row"><strong>'+E(v.label)+'</strong><b>'+E(v.home)+E(v.unit||'')+'</b><b>'+E(v.away)+E(v.unit||'')+'</b></div>').join('');
 const header='<div class="tdm-stat-grid-row tdm-stat-grid-head"><strong>ΣΤΑΤΙΣΤΙΚΟ</strong><div>'+badge(m.home,logoH(m))+'<small>'+E(m.home)+'</small></div><div>'+badge(m.away,logoA(m))+'<small>'+E(m.away)+'</small></div></div>';
 return compact?'<div class="tdm-live-stat-brief"><span class="tdm-live-proof">● LIVE STATS · Tiki-Data Lab</span><div class="tdm-stat-grid">'+header+stats+'</div></div>':'<section class="tdm-panel tdm-live-panel"><h3>Πραγματικά live στατιστικά</h3><div class="tdm-stat-grid">'+header+stats+'</div><p class="tdm-note">Μετρήσεις του τρέχοντος αγώνα, όχι ιστορικοί μέσοι όροι.</p></section>';
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
const liveMethodNote=m=>live(m)&&valid123(m.live_outlook)?liveStatsModelNote(m):live(m)&&m.live_outlook?.source==='recent_form_live_poisson'?
 '<p class="tdm-live-method-note">Πειραματική πιθανότητα από ιστορική φόρμα και τρέχον σκορ/λεπτό. Χαμηλή βεβαιότητα · όχι εγγύηση.</p>':
 live(m)&&m.live_outlook?'<p class="tdm-live-method-note">Πειραματικό live Poisson από επαληθευμένες ιστορικές επιδόσεις.</p>':
 live(m)&&m.live_prediction?'<p class="tdm-live-method-note">Πιθανότητες από Live Predictions.</p>':
 live(m)&&valid123(m.prematch_prediction)?'<p class="tdm-live-method-note">Μόνο προαγωνιστική πειραματική εκτίμηση · δεν αποτελεί ζωντανή πρόβλεψη ούτε λαμβάνει υπόψη το τρέχον σκορ.</p>':'';

const prematchReferenceBlock=m=>!live(m)||!valid123(m.prematch_prediction)||(!valid123(m.live_outlook)&&!valid123(m.live_prediction))?'':'<section class="tdm-panel"><h3>Πριν τη σέντρα · 1Χ2</h3><p class="tdm-older-estimate">Προαγωνιστική πειραματική εκτίμηση · όχι live ούτε ανεξάρτητα επαληθευμένη.</p><div class="tdm-probs tdm-probs-featured">'+metric('1 · '+m.home,m.prematch_prediction.p1)+metric('Χ · Ισοπαλία',m.prematch_prediction.px)+metric('2 · '+m.away,m.prematch_prediction.p2)+'</div></section>';
const card=m=>{const p=pr(m),vals=p?[p.p1,p.px,p.p2]:[null,null,null];
 const highest=p?Math.max(...vals):null;
 const inner='<div class="tdm-core-prob" aria-label="Πιθανότητες 1 Χ 2">'+['1','Χ','2'].map((k,i)=>'<span class="tdm-core-cell'+(vals[i]!==null&&vals[i]===highest?' winner':'')+'"><small>'+k+'</small><b>'+pct(vals[i])+'</b></span>').join('')+'</div>';
 return '<article class="tdm-card tdm-match-compact" role="button" tabindex="0" data-open="'+E(m.id)+'"><div class="tdm-card-top"><b class="tdm-league-name">'+(trusted(m.league_logo)?'<img class="tdm-league-emblem" loading="lazy" src="'+E(m.league_logo)+'" alt="">':'')+E(m.league||m.league_key)+'</b><span>'+stamp(m)+'</span></div>'+
 (stageLabel(m)?'<p class="tdm-stage-label">'+E(stageLabel(m))+'</p>':'')+'<div class="tdm-teams">'+club(m.home,logoH(m))+'<div class="tdm-centre">'+inner+(live(m)?'<span class="tdm-live-score">'+E(score(m))+'</span>':'')+'</div>'+club(m.away,logoA(m))+'</div>'+
 olderEstimateTag(m)+liveStatsModelNote(m,true)+missingUefaEvidence(m)+'<div class="tdm-card-bottom"><b>'+(live(m)?valid123(m.live_outlook)?'LIVE · Πειραματικό 1Χ2':valid123(m.live_prediction)?'LIVE · 1Χ2':valid123(m.prematch_prediction)?'Πριν τη σέντρα · όχι LIVE':'LIVE · Χωρίς πιθανότητες':m.forecast_review?.status==='withheld'?(p?'1Χ2 · Πειραματικό μοντέλο':'1Χ2 · Χωρίς επαρκές δείγμα'):!p?'1Χ2 · Μη διαθέσιμη εκτίμηση':'Πιθανότητες 1Χ2')+'</b><small>Ανάλυση αγώνα ↗</small></div></article>'};
const empty=x=>'<div class="tdm-empty">'+E(x)+'</div>';
function home(){
 const rank=m=>(isFav(m.home)||isFav(m.away)?5:0)+(accountLeagues.includes(m.league_key)?2:0);
 const ordered=state.matches.slice().sort((a,b)=>rank(b)-rank(a)||Date.parse(a.date)-Date.parse(b.date));
 const en=window.__tdLocale==='en';
 const t=(el,eng)=>en?eng:el;
 const loading=state.loading&&!state.matches.length;
 const liveNow=ordered.filter(coveredLive);
 const upcoming=ordered.filter(m=>!live(m));
 const today=dayKey(new Date());
 const todays=upcoming.filter(m=>dayKey(m.date)===today);
 const next=(todays.length?todays:upcoming).slice(0,6);
 const shown=new Set(next.map(m=>m.id));
 // Strongest forecasts: upcoming matches where the model's favourite outcome is most likely.
 const strongest=upcoming.filter(m=>!shown.has(m.id)&&pr(m)).map(m=>{const p=pr(m);return [m,Math.max(p.p1,p.px,p.p2)]}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
 const stat=(n,label,cls)=>'<span class="tdm-home-stat'+(cls?' '+cls:'')+'"><b>'+(loading?'—':n)+'</b><span>'+label+'</span></span>';
 const list=ms=>'<div class="tdm-list tdm-overview-fixtures">'+ms.map(card).join('')+'</div>';
 return '<section class="tdm-home-intro">'+
  '<h1>'+t('Οι σημερινοί αγώνες,','Today’s matches,')+' <em>'+t('σε αριθμούς.','in numbers.')+'</em></h1>'+
  '<p class="tdm-home-stats">'+stat(state.matches.length,t('αγώνες','matches'))+stat(liveNow.length,'live','live')+stat(state.matches.filter(m=>!!pr(m)).length,t('με εκτίμηση 1Χ2','with 1X2 forecast'))+'</p>'+
  '<div class="tdm-home-actions"><button class="tdm-accent-btn" data-view="matches">'+t('Όλοι οι αγώνες','All matches')+' <span aria-hidden="true">→</span></button>'+
  (liveNow.length?'<a href="/predictions?filter=live" class="tdm-overview-secondary"><span aria-hidden="true">●</span> '+t('Live τώρα','Live now')+' ('+liveNow.length+')</a>':'')+'</div>'+
  liveUpdateLabel()+'</section>'+
  (liveNow.length?title(t('Live τώρα','Live now'),t('Όλοι','View all'),'matches')+list(liveNow.slice(0,4)):'')+
  title(todays.length?t('Σήμερα','Today'):t('Επόμενοι αγώνες','Next up'),t('Πλήρες πρόγραμμα','Full schedule'),'matches')+
  (next.length?list(next):empty(loading?t('Φόρτωση πραγματικών αγώνων…','Loading fixtures…'):t('Αναμονή πραγματικών αγώνων','Waiting for live fixtures')))+
  (strongest.length?title(t('Πιο καθαρές εκτιμήσεις','Strongest forecasts'),'','')+list(strongest):'')+
  '<p class="tdm-home-note"><span aria-hidden="true">ⓘ</span> '+t('Πειραματικές στατιστικές εκτιμήσεις, όχι στοιχηματικές αποδόσεις.','Experimental statistical estimates, not bookmaker odds.')+' <a href="/transparency">'+t('Μεθοδολογία','Methodology')+' ↗</a></p>';
}

async function accountLoad(){
 if(accountLoaded||accountLoading)return;
 accountLoading=true;let completed=false;
 try{
  const r=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});
  const d=await r.json();loginEnabled=!!d.login_enabled;
  if(r.ok&&d.authenticated&&d.user&&d.csrf_token){
   if(authResult==='success')accountError='';
   accountUser=d.user;accountCsrf=d.csrf_token;
   followed=Array.isArray(d.preferences?.teams)?d.preferences.teams.slice(0,40):[];
   accountLeagues=Array.isArray(d.preferences?.leagues)?d.preferences.leagues.slice(0,12):[];
  }else{accountUser=null;accountCsrf='';followed=guestFollowed.slice();accountLeagues=[]}
  completed=true;
 }catch{accountUser=null;accountCsrf='';loginEnabled=null;accountError='Δεν φορτώθηκε η κατάσταση σύνδεσης. Ανανέωσε τη σελίδα ή δοκίμασε ξανά.';followed=guestFollowed.slice()}
 finally{accountLoaded=completed;accountLoading=false;if(state.view==='account')render();}
}
function accountSave(){
 if(!accountUser||!accountCsrf)return;
 const data={teams:followed.slice(0,40),leagues:accountLeagues.slice(0,12),language:window.__tdLocale==='el'?'el':'en'};
 saving=saving.catch(()=>{}).then(async()=>{
  try{const r=await fetch('/api/auth/preferences',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json','X-CSRF-Token':accountCsrf},body:JSON.stringify(data)});
   if(!r.ok)throw Error('save_failed');accountError='';
  }catch{accountError='Δεν αποθηκεύτηκαν οι επιλογές. Δοκίμασε ξανά.';if(state.view==='account')render()}
 });
}
function accountPanel(){
 const h=lead('Το προσωπικό σου Tiki-Data',accountUser?'Οργάνωσε ομάδες και διοργανώσεις.':'Σύνδεση με Google ή δωρεάν χρήση ως επισκέπτης.');
 if(!accountUser)return h+(accountError?'<div role="alert" class="tdm-auth-error">'+E(accountError)+'</div>':'')+'<section class="tdm-panel"><h3>Σύνδεση με Google</h3><p class="tdm-lead">Συγχρόνισε τις αγαπημένες ομάδες και διοργανώσεις σου σε διαφορετικές συσκευές.</p>'+
 '<div class="tdm-auth-actions">'+(loginEnabled===true?'<a class="gsi-material-button" href="/auth/google/start"><div class="gsi-material-button-state"></div><div class="gsi-material-button-content-wrapper"><div class="gsi-material-button-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg></div><span class="gsi-material-button-contents">Continue with Google</span></div></a>':'<p class="tdm-auth-pending">'+(loginEnabled===null?'Έλεγχος διαθεσιμότητας σύνδεσης…':'Η σύνδεση Google δεν είναι διαθέσιμη αυτή τη στιγμή.')+'</p>')+
 '<button class="tdm-auth-button" data-view="home">Συνέχεια ως επισκέπτης</button></div></section>'+
 '<section class="tdm-panel"><h3>Guest Mode</h3>'+row('Τοπικές αγαπημένες ομάδες',guestFollowed.length)+
 '<button class="tdm-auth-button" data-view="teams">Διαχείριση αγαπημένων</button><p class="tdm-note">Οι επισκέπτες δεν χρειάζονται λογαριασμό· οι προτιμήσεις αποθηκεύονται μόνο στον browser.</p></section>';
 const allowed=new Set(['ucl','uel','uecl','epl','laliga','bundesliga','seriea','ligue1','greece','cyprus']);const leagues=[...UEFA_FILTERS.map(([k,n])=>[k,n]),...new Map(state.matches.map(m=>[m.league_key,m.league||m.league_key])).entries()].filter(([k],i,a)=>allowed.has(k)&&a.findIndex(v=>v[0]===k)===i);
 return h+'<section class="tdm-panel"><h3>'+E(accountUser.display_name||'Tiki-Data Member')+'</h3><p class="tdm-lead">'+E(accountUser.email||'')+'</p>'+
 row('Αγαπημένες ομάδες',followed.length)+row('Αγαπημένες λίγκες',accountLeagues.length)+'</section>'+
 (accountError?'<p class="tdm-auth-error">'+E(accountError)+'</p>':'')+
 '<section class="tdm-panel"><h3>Οι διοργανώσεις μου</h3><p class="tdm-lead">Επηρεάζουν την προτεραιότητα των αγώνων, όχι τις πιθανότητες του μοντέλου.</p><div class="tdm-auth-leagues">'+leagues.map(([k,n])=>
 '<button class="tdm-auth-league '+(accountLeagues.includes(k)?'active':'')+'" data-auth-league="'+E(k)+'" aria-pressed="'+accountLeagues.includes(k)+'">'+(accountLeagues.includes(k)?'★ ':'☆ ')+E(n)+'</button>').join('')+'</div></section>'+
 '<section class="tdm-panel"><h3>Οι ομάδες μου</h3><button class="tdm-auth-button" data-view="teams">Διαχείριση αγαπημένων</button>'+
 (guestFollowed.length?'<button class="tdm-auth-button" data-auth-import>Μεταφορά αγαπημένων από Guest Mode</button>':'')+'</section>'+
 '<section class="tdm-panel"><h3>Ιδιωτικότητα</h3><p class="tdm-lead">Τα cookies συνεδρίας έχουν διάρκεια έως 30 ημέρες. Μπορείς να αποσυνδεθείς ή να διαγράψεις τον λογαριασμό σου μαζί με όλες τις αποθηκευμένες προτιμήσεις.</p>'+
 '<button class="tdm-auth-button" data-auth-logout>Αποσύνδεση</button><button class="tdm-auth-button tdm-auth-danger" data-auth-delete>Οριστική διαγραφή λογαριασμού</button></section>';
}
async function accountAction(kind){
 if(!accountUser||!accountCsrf)return;
 if(kind==='delete'&&!confirm('Θα διαγραφούν οριστικά ο λογαριασμός και οι αποθηκευμένες προτιμήσεις. Συνέχεια;'))return;
 try{
  const r=await fetch(kind==='delete'?'/api/auth/delete':'/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':accountCsrf}});
  if(!r.ok)throw Error('failed');
  accountUser=null;accountCsrf='';accountLeagues=[];followed=guestFollowed.slice();accountError='';render();
 }catch{accountError='Η ενέργεια απέτυχε. Δοκίμασε ξανά.';render()}
}

function teams(){const map=new Map();for(const m of state.matches)for(const [n,url] of [[m.home,logoH(m)],[m.away,logoA(m)]])if(!map.has(norm(n)))map.set(norm(n),{n,url});const arr=[...map.values()].filter(x=>norm(x.n).includes(norm(state.query))).sort((a,b)=>Number(isFav(b.n))-Number(isFav(a.n))||a.n.localeCompare(b.n,'el'));return '<button class="tdm-auth-button" data-view="account">← '+(window.__tdLocale==='en'?'Profile':'Προφίλ')+'</button>'+lead(window.__tdLocale==='en'?'My teams':'Οι ομάδες μου',accountUser?'Οι αγαπημένες ομάδες σου αποθηκεύονται στο προφίλ.':'Διάλεξε τις ομάδες που σε ενδιαφέρουν. Θα αποθηκευτούν μόνο στη συσκευή σου.')+
searchInput()+title('Επίλεξε τις ομάδες σου')+'<div class="tdm-grid">'+arr.map(x=>'<button class="tdm-tile '+(isFav(x.n)?'active':'')+'" data-team="'+E(x.n)+'" aria-pressed="'+isFav(x.n)+'"><span class="tdm-star">'+(isFav(x.n)?'★':'☆')+'</span>'+badge(x.n,x.url)+'<strong>'+E(x.n)+'</strong></button>').join('')+'</div>'+(arr.length?'':empty('Δεν βρέθηκαν ομάδες στο διαθέσιμο επταήμερο.'))}
function searchInput(){return '<label class="tdm-search">'+ico('search')+'<input data-search type="search" value="'+E(state.query)+'" placeholder="Αναζήτηση ομάδας ή αγώνα…" aria-label="Αναζήτηση"></label>'}
function fixtures(){if(state.day!=='all'&&!availableDays().includes(state.day))ensureAvailableDay();if(state.league!=='all'&&state.day==='all'&&!state.dayAllExplicit)ensureAvailableDay();const f=matchesForFilters().filter(m=>state.day==='all'||dayKey(m.date)===state.day);const grouped=[...new Map(state.matches.map(m=>[m.league_key,m.league||m.league_key])).entries()];const leagues=[...UEFA_FILTERS.map(([k,n])=>[k,n]),...grouped.filter(([k])=>!UEFA_FILTERS.some(([key])=>key===k))];return lead(state.view==='live'?'Live Scores':'Αγώνες & Προβλέψεις','Πραγματικά παιχνίδια, οργανωμένα στοιχεία και αναλυτικό Match Center.')+
kpis()+liveUpdateLabel()+'<p class="tdm-note">Πηγή αγώνων: Football-API.com · Ιστορικό μοντέλου: Tiki-Data</p>'+title(state.view==='live'?'Αγώνες σε εξέλιξη':'Πρόγραμμα')+(state.view!=='live'?'<div class="tdm-chips">'+[['all','Όλοι'],['favorites','★ Αγαπημένα'],['live','● Live']].map(([x,y])=>'<button data-mode="'+x+'" class="tdm-chip '+(x===state.mode?'active':'')+'">'+y+'</button>').join('')+'</div>':'')+
'<div class="tdm-chips"><button data-league="all" class="tdm-chip '+(state.league==='all'?'active':'')+'">Όλες οι λίγκες</button>'+leagues.map(([x,y])=>'<button data-league="'+E(x)+'" class="tdm-chip tdm-league-chip '+(x===state.league?'active':'')+'">'+leagueBadge(x)+'<span>'+E(y)+'</span></button>').join('')+'</div>'+
dateChips()+searchInput()+'<div class="tdm-list">'+f.slice(0,state.visible).map(card).join('')+(f.length>state.visible?'<button class="tdm-more" data-more>Εμφάνιση περισσότερων ('+(f.length-state.visible)+') ↓</button>':'')+'</div>'+(f.length?'':empty(state.loading?'Φόρτωση πραγματικών αγώνων…':UEFA_FILTERS.some(([k])=>k===state.league)?'Δεν υπάρχουν διαθέσιμοι αγώνες από το Sportmonks στο τρέχον επταήμερο για αυτή τη διοργάνωση.':'Δεν υπάρχουν αγώνες με τα συγκεκριμένα φίλτρα.'))+'<p class="tdm-note">Οι αριθμητικές εκτιμήσεις είναι πειραματικές και δεν αποτελούν εγγυημένα αποτελέσματα.</p>'}
const metric=(name,p)=>'<div class="tdm-prob"><small>'+E(name)+'</small><b>'+pct(p)+'</b><div class="tdm-bar"><i style="width:'+((typeof p==='number'&&p>=0&&p<=100)?p:0)+'%"></i></div></div>';
function deepNote(d){
 if(!d)return '<div class="tdm-quiet">'+(deepLoading.has(state.id)?'Φόρτωση στοιχείων αγώνα…':'Τα επιπλέον στοιχεία δεν είναι διαθέσιμα για τον συγκεκριμένο αγώνα.')+'</div>';
 if(d.error)return '<div class="tdm-quiet">Ο πάροχος δεν διαθέτει αυτή τη στιγμή τα επιπλέον στοιχεία ή δεν περιλαμβάνονται στη συνδρομή.</div>';
 return '';
}
function historyTeamLogo(n){const game=state.matches.find(x=>norm(x.home)===norm(n)||norm(x.away)===norm(n));return game?(norm(game.home)===norm(n)?logoH(game):logoA(game)):null}
function historicalRow(g){return '<div class="tdm-history-row"><time>'+E(g.date||'')+'</time><div class="tdm-history-match"><div class="tdm-history-team">'+badge(g.home,historyTeamLogo(g.home))+'<small>'+E(g.home)+'</small></div><div class="tdm-history-score"><b>'+E(g.home_score??'—')+'</b><span>:</span><b>'+E(g.away_score??'—')+'</b></div><div class="tdm-history-team">'+badge(g.away,historyTeamLogo(g.away))+'<small>'+E(g.away)+'</small></div></div>'+(g.result?'<em class="tdm-form-'+E(g.result)+'">'+E(g.result)+'</em>':'')+'</div>'}

function gameHistory(title,rows){return '<section class="tdm-panel"><h3>'+E(title)+'</h3>'+(rows?.length?rows.map(historicalRow).join(''):'<p class="tdm-lead">Δεν βρέθηκαν καταγεγραμμένες αναμετρήσεις στην επαληθευμένη ιστορική βάση.</p>')+'</section>'}
function currentSeasonFormBlock(m,d){
 const f=d?.current_season_form;if(!f)return '';
 const en=document.documentElement.lang==='en',t=(el,english)=>en?english:el;
 const valid=x=>x&&Number.isInteger(x.played)&&x.played>0&&Number.isInteger(x.wins)&&Number.isInteger(x.draws)&&Number.isInteger(x.losses)&&x.wins+x.draws+x.losses===x.played;
 const panel=(x,name,venue)=>{
  if(!valid(x))return '<div class="tdm-team-form"><strong>'+E(name)+'</strong><p>'+t('Δεν υπάρχουν επιβεβαιωμένα αποτελέσματα 2026–27 στη συγκεκριμένη έδρα.','No verified 2026–27 results at this venue.')+'</p></div>';
  return '<div class="tdm-team-form"><strong>'+E(name)+'</strong><small>'+x.played+' '+t('αγώνες','matches')+' · '+x.wins+t('Ν','W')+' '+x.draws+t('Ι','D')+' '+x.losses+t('Η','L')+'</small><div class="tdm-form-figures"><span>'+t('Γκολ υπέρ/κατά','Goals for/against')+' <b>'+x.goals_for+' : '+x.goals_against+'</b></span><span>UEFA <b>'+x.uefa_matches+'</b></span><span>'+t('Άλλες διοργανώσεις','Other competitions')+' <b>'+x.domestic_matches+'</b></span></div></div>';
 };
 return '<section class="tdm-panel"><h3>'+t('Σεζόν 2026–27 · εντός / εκτός έδρας','2026–27 season · home / away form')+'</h3><div class="tdm-form-pair">'+panel(f.home,m.home,'home')+panel(f.away,m.away,'away')+'</div><p class="tdm-note">'+t('Επιβεβαιωμένα τελικά αποτελέσματα από όλες τις διαθέσιμες διοργανώσεις, μαζί με τα προκριματικά UEFA. Μόνο αγώνες πριν από το όριο των 3 ημερών. Δεν αποτελούν πιθανότητες 1Χ2. Η κάλυψη εξαρτάται από τα διαθέσιμα αποτελέσματα.','Verified finished games from all available competitions, including UEFA qualifiers, with a 3-day embargo. These are not 1X2 forecasts; coverage depends on the available results.')+'</p></section>';
}

function historicalSummaryBlock(m,d){
 const history=d?.history;if(!history)return '';
 const recent=(rows,team)=>{const all=(Array.isArray(rows)?rows:[]).filter(r=>r&&(r.home===team||r.away===team)&&Number.isFinite(Number(r.home_score))&&Number.isFinite(Number(r.away_score))).slice(0,5);
  const n=all.length;if(!n)return '<div class="tdm-team-form"><strong>'+E(team)+'</strong><p>Δεν υπάρχει ιστορικό δείγμα.</p></div>';
  let gf=0,ga=0,w=0,draw=0,loss=0;for(const r of all){const home=r.home===team,a=Number(home?r.home_score:r.away_score),b=Number(home?r.away_score:r.home_score);gf+=a;ga+=b;if(a>b)w++;else if(a===b)draw++;else loss++}
  return '<div class="tdm-team-form"><strong>'+E(team)+'</strong><small>'+n+' τελευταίοι επαληθευμένοι αγώνες · '+w+'Ν '+draw+'Ι '+loss+'Η</small><div class="tdm-form-figures"><span>Γκολ/αγώνα <b>'+(gf/n).toFixed(2)+'</b></span><span>Δέχεται/αγώνα <b>'+(ga/n).toFixed(2)+'</b></span><span>Σύνολο γκολ <b>'+gf+' : '+ga+'</b></span></div></div>';
 };
 return '<section class="tdm-panel"><h3>Φόρμα και γκολ · προηγούμενοι αγώνες</h3><div class="tdm-form-pair">'+recent(history.home,m.home)+recent(history.away,m.away)+'</div><p class="tdm-note">Μόνο πραγματικά καταγεγραμμένα τελικά αποτελέσματα έως πέντε αγώνων ανά ομάδα.</p></section>';
}
function playerList(team,side,label){const people=team||{starters:[],bench:[]};return '<section class="tdm-panel tdm-lineup-side"><h3>'+E(label)+'</h3>'+
 '<div class="tdm-lineup-rows">'+(people.starters?.length?people.starters.map(p=>'<div class="tdm-player"><span class="tdm-shirt">'+E(p.number??'·')+'</span><b>'+E(p.name)+'</b>'+(p.position?'<small>'+E(p.position)+'</small>':'')+'</div>').join(''):'<p class="tdm-lead">Η ενδεκάδα δεν διατίθεται ακόμη.</p>')+'</div>'+
 (people.bench?.length?'<h4>Αναπληρωματικοί</h4>'+people.bench.map(p=>'<div class="tdm-player"><span class="tdm-shirt">'+E(p.number??'·')+'</span><b>'+E(p.name)+'</b></div>').join(''):'')+'</section>'}

const shortSurname=n=>String(n||'').trim().split(/\s+/).filter(Boolean).slice(-1)[0]||'—';
function lineupPitch(m,team,side,formation){
 if(m.source==='football-api.com'){const list=ps=>ps?.length?ps.map(p=>'<p>'+E(p.number??'—')+' · '+E(p.name)+'</p>').join(''):'<p>Δεν έχουν δοθεί παίκτες.</p>';return '<section class="tdm-panel"><h3>'+E(m[side])+'</h3><p class="tdm-note">Παίκτες από Football-API. Δεν παρέχονται θέσεις ή σχηματισμός.</p><h4>Αρχική ενδεκάδα</h4>'+list(team?.starters)+'<h4>Πάγκος</h4>'+list(team?.bench)+'</section>';}
 const people=team||{starters:[],bench:[]},players=Array.isArray(people.starters)?people.starters:[],bench=Array.isArray(people.bench)?people.bench:[];
 const lines=String(formation||'').split('-').map(Number);
 const validFormation=lines.length>=2&&lines.length<=5&&lines.every(n=>Number.isInteger(n)&&n>0&&n<=5)&&lines.reduce((a,b)=>a+b,0)===10;
 const raw=m?.team_colors?.[side]?.primary||m?.[side+'_color']||'',officialColor=typeof raw==='string'&&/^#[a-f0-9]{6}$/i.test(raw)?raw:null;
 const kit=officialColor||'#365a6b',name=side==='home'?m.home:m.away;
 const player=p=>'<div class="tdm-pitch-player" title="'+E(p.name)+'"><span class="tdm-jersey" style="--kit:'+kit+'"><b>'+E(p.number??'·')+'</b></span><strong>'+E(shortSurname(p.name))+'</strong>'+(typeof p.xg==='number'&&Number.isFinite(p.xg)?'<small class="tdm-pitch-xg">xG '+E(p.xg.toFixed(2))+'</small>':'')+'</div>';
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
 return '<section class="tdm-panel tdm-pitch-card"><div class="tdm-pitch-title">'+badge(name,side==='home'?logoH(m):logoA(m))+'<div><h3>'+E(name)+'</h3><span class="tdm-formation-chip">'+E(formation||'Σχηματισμός μη διαθέσιμος')+'</span></div></div>'+field+
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
 '<p class="tdm-note">Επαληθευμένα αποτελέσματα και διαθέσιμα στατιστικά. Περιλαμβάνονται προκριματικοί. Δεν υπολογίζονται πλασματικά xG ή προγνωστική βελτίωση από σουτ/κατοχή.</p></section>';
}


function allStatisticsBlock(m,d){
 const e=m.statistical_evidence||d?.statistical_evidence;if(!e)return '';
 const en=document.documentElement.lang==='en',t=(el,eng)=>en?eng:el;
 const h=e.home||{},a=e.away||{},codes=[...new Set([...Object.keys(h.for||{}),...Object.keys(a.for||{}),...Object.keys(h.against||{}),...Object.keys(a.against||{})])].sort();
 const names={'expected-goals':t('Αναμενόμενα γκολ (xG)','Expected goals (xG)'),'shots-total':t('Συνολικά σουτ','Total shots'),'shots-on-target':t('Σουτ στην εστία','Shots on target'),'ball-possession':t('Κατοχή (%)','Possession (%)'),'corners':t('Κόρνερ','Corners'),'key-passes':t('Πάσες κλειδιά','Key passes'),'goals':t('Γκολ','Goals'),'passes':t('Πάσες','Passes'),'fouls':t('Φάουλ','Fouls'),'offsides':t('Οφσάιντ','Offsides'),'yellowcards':t('Κίτρινες κάρτες','Yellow cards'),'redcards':t('Κόκκινες κάρτες','Red cards'),'saves':t('Αποκρούσεις','Saves')};
 const value=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString(en?'en-GB':'el-GR',{maximumFractionDigits:2}):'—';
 const metrics=ks=>'<div class="tdm-stat-scroll"><table class="tdm-stat-table"><thead><tr><th>'+t('Στατιστικό','Statistic')+'</th><th>'+E(m.home)+'</th><th>'+E(m.away)+'</th></tr></thead><tbody>'+ks.map(k=>'<tr><th>'+E(names[k]||k.replaceAll('-',' '))+'</th><td>'+value(h.for?.[k])+'</td><td>'+value(a.for?.[k])+'</td></tr>').join('')+'</tbody></table></div>';
 const main=['expected-goals','shots-total','shots-on-target','ball-possession','corners'].filter(k=>codes.includes(k));
 return '<section class="tdm-panel tdm-stat-evidence"><h3>'+t('Στατιστικά από όλες τις διοργανώσεις','Statistics across all competitions')+'</h3><p class="tdm-note">'+E(m.home)+': '+(h.n||0)+' · '+E(m.away)+': '+(a.n||0)+' '+t('προηγούμενοι αγώνες. Πρόσφατοι σταθμισμένοι μέσοι όροι, έως 12 αγώνες στο τελευταίο 120ήμερο.','prior matches. Recency-weighted averages from up to 12 games in the last 120 days.')+'</p>'+
 metrics(main)+'<details><summary>'+t('Όλα τα διαθέσιμα στατιστικά','All available statistics')+' ('+codes.length+')</summary>'+metrics(codes)+'<h4>'+t('Τι επιτρέπει ο έλεγχος','Evaluation status')+'</h4><p class="tdm-note">'+
 (e.applied_to_probabilities?t('Η στατιστική προσαρμογή πέρασε τον χρονικό έλεγχο και εφαρμόστηκε στις πιθανότητες. Παραμένει πειραματική.','The statistical adjustment passed the temporal evaluation and was applied. It remains experimental.'):t('Η πρόσθετη έκδοση δοκιμάστηκε σε 49 ξεχωριστούς αγώνες UEFA. Δεν τεκμηριώθηκε αρκετή βελτίωση· οι πιθανότητες UEFA βρίσκονται υπό επανέλεγχο.','The additional model was tested on 49 separate UEFA matches. Improvement was insufficient; UEFA probabilities are under review.'))+
 '</p><p class="tdm-note">'+t('Χρησιμοποιούνται μόνο ολοκληρωμένοι αγώνες πριν από το χρονικό όριο των 3 ημερών. Κενό πεδίο σημαίνει μη διαθέσιμο, όχι μηδέν. Τραυματισμοί ή ενδεκάδες χωρίς επιβεβαίωση δεν μεταβάλλουν τις πιθανότητες.','Only completed games before the three-day cutoff are eligible. A missing value is unavailable, not zero. Unverified injuries and lineups do not alter probabilities.')+'</p></details>'+
 (e.additional_statistics_stale?'<p class="tdm-note">'+t('Το πρόσθετο στιγμιότυπο χρειάζεται ανανέωση.','Additional statistics snapshot needs refreshing.')+'</p>':'')+'</section>';
}

function detailProbRail(m,p,is){
 const en=window.__tdLocale==='en';
 const name=is?(en?'Latest available 1X2 · live match':'Τελευταία διαθέσιμη εκτίμηση 1Χ2 · Live αγώνας'):(en?'Pre-match 1X2 forecast':'Εκτίμηση 1Χ2 πριν από τη σέντρα');
 return '<div class="tdm-detail-prob-heading">'+E(name)+'</div>'+
 (p?'<div class="tdm-detail-prob-strip" aria-label="1X2 probabilities">'+[['1',p.p1],['X',p.px],['2',p.p2]].map(([k,n])=>'<div class="tdm-detail-prob-cell"><small>'+k+'</small><strong>'+pct(n)+'</strong></div>').join('')+'</div>':'<p class="tdm-detail-prob-empty">'+(en?'No verified numeric estimate available for this fixture.':'Δεν υπάρχει διαθέσιμη αριθμητική εκτίμηση για αυτόν τον αγώνα.')+'</p>');
}

function matchCenterForm(m,d,side){
 const team=m[side],rows=(Array.isArray(d?.history?.[side])?d.history[side]:[]).filter(g=>g&&(g.home===team||g.away===team)&&Number.isInteger(g.home_score)&&Number.isInteger(g.away_score)&&Date.parse(g.date)<Date.parse(m.date)).slice(0,5);
 if(!rows.length)return '';
 return '<div class="tdm-match-form"><small>Πρόσφατη φόρμα</small>'+rows.map(g=>{const home=g.home===team,a=home?g.home_score:g.away_score,b=home?g.away_score:g.home_score,result=a>b?'W':a===b?'D':'L';return '<span class="tdm-form-token '+result+'" title="'+E(g.home+' '+g.home_score+' – '+g.away_score+' '+g.away)+'">'+result+'</span>'}).join('')+'</div>';
}
function matchCenterLineups(m,d){
 const hasPlayers=['home','away'].some(side=>d?.lineups?.[side]?.starters?.length);
 const confirmed=hasPlayers&&d.lineup_status==='confirmed',predicted=hasPlayers&&d.lineup_status==='predicted_by_provider';
 const label=confirmed?'Επιβεβαιωμένες ενδεκάδες':predicted?'Πιθανές ενδεκάδες · όχι επιβεβαιωμένες':hasPlayers?'Διαθέσιμες ενδεκάδες · μη επιβεβαιωμένες':'Οι ενδεκάδες δεν έχουν δημοσιευθεί';
 return '<section class="tdm-tactical-section"><div class="tdm-tactical-heading"><div><h2>Ενδεκάδες & διάταξη ομάδων</h2><p>'+E(label)+'</p></div><span class="tdm-tactical-tag '+(confirmed?'confirmed':'')+'">'+(hasPlayers?'2D · Σχηματισμός':'Πριν από τη σέντρα')+'</span></div>'+
 (d&&!d.error?'<div class="tdm-pitch-grid">'+lineupPitch(m,d.lineups?.home,'home',d.formations?.home)+lineupPitch(m,d.lineups?.away,'away',d.formations?.away)+'</div>':deepNote(d))+
 '<p class="tdm-note">Διάταξη βάσει του δημοσιευμένου σχηματισμού. Δεν διατίθενται δεδομένα παρακολούθησης θέσεων ή heatmap.</p></section>';
}
function matchCenterHero(m,d,p,is){
 const final=['FT','FULL_TIME','FINISHED','AET','FT_PEN','PEN'].includes(String(m.status||'').toUpperCase());
 const hasScore=Number.isInteger(m.home_score)&&Number.isInteger(m.away_score);
 const result=(is||final)&&hasScore?m.home_score+' : '+m.away_score:'VS';
 const status=is?'● LIVE'+(m.status==='HT'?' · ΗΜΙΧΡΟΝΟ':Number.isInteger(m.minute)?' · '+m.minute+'′':''):final?'Τελικό αποτέλεσμα':({POSTP:'Αναβολή',POSTPONED:'Αναβολή',CANC:'Ακύρωση',CANCELLED:'Ακύρωση'}[m.status]||'Πριν από τη σέντρα');
 const kickoff=new Date(m.date).toLocaleString(window.__tdLocale==='el'?'el-GR':'en-GB',{timeZone:'Asia/Nicosia',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const team=side=>'<div class="tdm-match-team '+side+'">'+badge(m[side],side==='home'?logoH(m):logoA(m))+'<div><h1>'+E(m[side])+'</h1>'+matchCenterForm(m,d,side)+'</div></div>';
 const bar=valid123(p)?'<div class="tdm-match-odds"><div class="tdm-match-odds-labels">'+[['1',p.p1],['Χ',p.px],['2',p.p2]].map(([k,v])=>'<span>'+k+': <b>'+pct(v)+'</b></span>').join('')+'</div><div class="tdm-match-prob-meter" role="img" aria-label="1: '+pct(p.p1)+', Χ: '+pct(p.px)+', 2: '+pct(p.p2)+'">'+[p.p1,p.px,p.p2].map(v=>'<span style="width:'+v+'%"></span>').join('')+'</div></div>':'<p class="tdm-detail-prob-empty">Δεν υπάρχουν διαθέσιμες πιθανότητες 1Χ2.</p>';
 return '<div class="tdm-match-breadcrumb"><button data-back>← Αγώνες</button><span>/</span><span>'+E(m.league||'')+'</span><span>/</span><strong>'+E(m.home)+' vs '+E(m.away)+'</strong></div>'+
 '<section class="tdm-scoreboard tdm-match-hero" aria-label="Κέντρο αγώνα"><div class="tdm-match-meta"><span>'+E(m.league||m.league_key)+'</span>'+(stageLabel(m)?'<span>'+E(stageLabel(m))+'</span>':'')+'<time datetime="'+E(m.date)+'">'+E(kickoff)+' · ώρα Κύπρου</time>'+(d?.venue?'<span class="tdm-match-venue">⌖ '+E(d.venue)+'</span>':'')+'</div>'+
 '<div class="tdm-match-main">'+team('home')+'<div class="tdm-match-center"><span class="tdm-match-state">'+E(status)+'</span><div class="tdm-versus">'+E(result)+'</div><small>Match intelligence</small>'+bar+'</div>'+team('away')+'</div>'+
 '<div class="tdm-match-toolbar"><span>Tiki-Data · '+E(source(m))+'</span><div><button data-tab="info">Στοιχεία αγώνα ↗</button><button data-match-share>Κοινοποίηση ↗</button></div></div></section><p class="tdm-match-caption">'+(is?'Οι πιθανότητες είναι η τελευταία διαθέσιμη εκτίμηση για τον live αγώνα.':'Πιθανότητες 1Χ2 πριν από τη σέντρα.')+' Πειραματικές στατιστικές εκτιμήσεις · δεν αποτελούν εγγυημένα αποτελέσματα.</p>';
}

function details(){
 const m=state.matches.find(x=>String(x.id)===String(state.id));if(!m)return empty('Ο αγώνας δεν βρέθηκε');
 const is=live(m),d=deepCache.get(state.id),valid=d&&!d.error;
 const p=m.forecast_review?.status==='withheld'?pr(m):(!is&&valid&&valid123(d.context_prediction)?d.context_prediction:pr(m)),g=is?m.live_outlook:p||m;
 let content='';
 if(state.tab==='info')content='<section class="tdm-panel"><h3>Πληροφορίες αγώνα</h3>'+row('Διοργάνωση',m.league||m.league_key)+(stageLabel(m)?row('Φάση UEFA',stageLabel(m)):'')+row('Ημερομηνία',when(m.date))+row('Κατάσταση',is?'LIVE':m.status)+row('Παρουσίαση','Tiki-Data Lab')+row('Ποιότητα μοντέλου',source(m))+(valid&&d.venue?row('Γήπεδο',d.venue):'')+'</section>'+
 uefaFormBlock(m)+'<section class="tdm-panel"><h3>Ιστορικό τεκμηρίωσης</h3>'+row('Γηπεδούχος εντός',m.analysis?.home_venue_matches??m.historical_sample?.home)+row('Φιλοξενούμενη εκτός',m.analysis?.away_venue_matches??m.historical_sample?.away)+'</section>';
 if(state.tab==='summary')content=currentSeasonFormBlock(m,d)+historicalSummaryBlock(m,d)+allStatisticsBlock(m,d)+liveStatsBlock(m)+liveMethodNote(m)+prematchReferenceBlock(m)+recentFormBlock(m)+'<section class="tdm-panel"><h3>Πιθανότητες τελικού αποτελέσματος</h3>'+(m.forecast_review?.status==='withheld'&&p?'<p class="tdm-older-estimate">Πειραματική στατιστική εκτίμηση Tiki-Data · Δεν έχει πιστοποιηθεί η προγνωστική της ακρίβεια. Συνυπολογίζονται ιστορικά εντός/εκτός έδρας, όχι μόνο UEFA.</p>':'')+(p?'<div class="tdm-probs tdm-probs-featured">'+metric('1 · '+m.home,p.p1)+metric('Χ · Ισοπαλία',p.px)+metric('2 · '+m.away,p.p2)+'</div>':empty(m.forecast_review?.status==='withheld'?'Οι πιθανότητες βρίσκονται υπό επανέλεγχο. Τα διαθέσιμα στατιστικά εμφανίζονται παραπάνω.':'Δεν υπάρχουν διαθέσιμες πιθανότητες.'))+'</section>'+
 uefaFormBlock(m)+'<section class="tdm-panel"><h3>Σενάρια γκολ</h3><div class="tdm-large-stats">'+row('Over 2.5',pct(g?.over25))+row('Under 2.5',pct(g?.under25))+row('GG / BTTS',pct(g?.btts))+row('Πιθανότερο σκορ',is?g?.most_likely_final?.score:m.most_likely_score?.score)+'</div></section>'+
 '<section class="tdm-panel"><h3>Expected Goals (xG)</h3>'+
 (valid&&d.xg?.available?'<div class="tdm-xg"><div><small>'+E(m.home)+'</small><b>'+E(d.xg.home===null?'—':d.xg.home.toFixed(2))+'</b></div><span>xG</span><div><small>'+E(m.away)+'</small><b>'+E(d.xg.away===null?'—':d.xg.away.toFixed(2))+'</b></div></div>':deepNote(d)||'<p class="tdm-lead">Δεν υπάρχουν xG για τον αγώνα ή δεν περιλαμβάνονται στη συνδρομή.</p>')+
 '<p class="tdm-note">Το xG αφορά ποιότητα ευκαιριών, όχι πρόβλεψη τελικών γκολ. Διαθεσιμότητα ανά διοργάνωση και πακέτο.</p></section>';
 if(state.tab==='lineups')content=deepNote(d)+(valid?'<div class="tdm-confirmation '+(d.lineup_status==='confirmed'?'confirmed':'')+'">'+
 (d.lineup_status==='confirmed'?'✓ Επίσημες ενδεκάδες – επιβεβαιωμένες':d.lineup_status==='predicted_by_provider'?'◇ Πιθανές ενδεκάδες – όχι επιβεβαιωμένες':d.lineup_status==='unconfirmed'?'Η επιβεβαίωση της ενδεκάδας δεν είναι διαθέσιμη':'Δεν έχουν δημοσιευτεί ενδεκάδες')+'</div>'+
 '<div class="tdm-pitch-grid">'+lineupPitch(m,d.lineups?.home,'home',d.formations?.home)+lineupPitch(m,d.lineups?.away,'away',d.formations?.away)+'</div>':'')+
 '<p class="tdm-note">Η ένδειξη επιβεβαίωσης προέρχεται αποκλειστικά από το metadata του παρόχου. Προβλεπόμενες ενδεκάδες ενδέχεται να αλλάξουν.</p>';
 if(state.tab==='history')content=deepNote(d)+(valid?gameHistory('Πρόσφατοι αγώνες · '+m.home,d.history?.home)+gameHistory('Πρόσφατοι αγώνες · '+m.away,d.history?.away)+gameHistory('Μεταξύ τους αναμετρήσεις',d.history?.head_to_head):'')+
 '<p class="tdm-note">Αποτελέσματα προηγούμενων αγώνων από το ιστορικό Tiki-Data Lab· τα φιλτράρουμε ώστε να προηγούνται χρονικά από τον αγώνα.</p>';
 if(state.tab==='stats'){
  const arr=valid&&Array.isArray(d.statistics)&&d.statistics.length?d.statistics:
   (Array.isArray(m.statistics)?m.statistics:[]).map(x=>({type:x.type,side:Number(x.participant_id)===Number(m.home_id)?'home':Number(x.participant_id)===Number(m.away_id)?'away':null,value:x.value}));
  const types=new Map();
  for(const x of arr){if(!x?.type||!['home','away'].includes(x.side))continue;
   const name=String(x.type).replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2');
   if(!types.has(name))types.set(name,{home:null,away:null});
   types.get(name)[x.side]=x.value;
  }
  const heading='<div class="tdm-stat-grid-row tdm-stat-grid-head"><strong>ΣΤΑΤΙΣΤΙΚΟ</strong><div>'+badge(m.home,logoH(m))+'<small>'+E(m.home)+'</small></div><div>'+badge(m.away,logoA(m))+'<small>'+E(m.away)+'</small></div></div>';
  content=historicalSummaryBlock(m,d)+liveStatsBlock(m)+uefaFormBlock(m)+recentFormBlock(m)+
   '<section class="tdm-panel"><h3>Στατιστικά αναμέτρησης</h3>'+
   (types.size?'<div class="tdm-stat-grid">'+heading+[...types].slice(0,42).map(([name,x])=>'<div class="tdm-stat-grid-row"><strong>'+E(name)+'</strong><b>'+E(x.home??'—')+'</b><b>'+E(x.away??'—')+'</b></div>').join('')+'</div>':
   '<p class="tdm-lead">Δεν υπάρχουν επιβεβαιωμένα στατιστικά τρέχοντος αγώνα. Για μελλοντικούς αγώνες εμφανίζεται η παραπάνω ιστορική φόρμα, όχι υποθετικά live νούμερα.</p>')+'</section>'+
   (valid&&d.history?gameHistory('Πρόσφατα αποτελέσματα · '+m.home,d.history.home)+gameHistory('Πρόσφατα αποτελέσματα · '+m.away,d.history.away):'');
 }
 if(state.tab==='events'){const es=valid?d.events||[]:[];content=deepNote(d)+'<section class="tdm-panel"><h3>Γεγονότα αγώνα · Football-API</h3>'+(es.length?es.map(e=>row(e.minute+'′ · '+(e.label||e.type),[e.player,e.related_player].filter(Boolean).join(' / '))).join(''):'<p>Δεν έχουν δοθεί γεγονότα.</p>')+'</section>';}
 if(state.tab==='news'){
  const news=valid&&Array.isArray(d.news)?d.news:[],impact=news.filter(n=>n.important);
  content='<section class="tdm-panel"><h3>Νέα ομάδων · Tiki-Data Lab</h3>'+
   (news.length?news.map(n=>'<article class="tdm-news-item"><h4>'+E(n.title)+'</h4><p>'+E(n.preview||'')+'</p>'+(n.important?'<small class="tdm-news-alert">Πιθανή σημασία για την προετοιμασία · προς επιβεβαίωση</small>':'<small>Αγωνιστική ενημέρωση</small>')+'</article>').join(''):'<p class="tdm-lead">Δεν υπάρχουν επαληθευμένες διαθέσιμες ειδήσεις για αυτόν τον αγώνα ή δεν υπάρχει πρόσβαση σε ειδησεογραφική τροφοδοσία.</p>')+
   '<p class="tdm-note">Πιθανές απουσίες και αλλαγές ενδεκάδας επισημαίνονται ως κίνδυνος αβεβαιότητας, δεν αλλάζουν αυτόματα τα ποσοστά 1Χ2 χωρίς επιβεβαιωμένη επίδραση και έλεγχο ακρίβειας.</p></section>'+
   (impact.length?'<section class="tdm-panel"><h3>Επίδραση στην αξιολόγηση</h3>'+row('Σημαντικές αναφορές',impact.length)+row('Προσαρμογή πιθανοτήτων','Όχι χωρίς επαλήθευση')+'</section>':'');
 }
 if(state.tab==='analysis'){
  const n=m.live_outlook?.next_goal;
  content=recentFormBlock(m)+liveStatsBlock(m)+'<section class="tdm-panel"><h3>Tiki-Data · Στατιστική ανάλυση</h3><p class="tdm-lead">'+E(m.analysis?.explanation||'Στατιστική εκτίμηση με βάση επαληθευμένα ιστορικά αποτελέσματα.')+'</p>'+
 row('Μοντέλο',is?(m.live_outlook?.source==='recent_form_live_poisson'?'Πειραματικό Poisson βάσει φόρμας':m.live_outlook?'Live Poisson':m.live_prediction?'Sportmonks Live':'Χωρίς ποσοστά'):source(m))+
 row('Αναμενόμενα γκολ γηπεδούχου',m.mu_home??m.live_outlook?.remaining_expected_goals?.home)+
 row('Αναμενόμενα γκολ φιλοξενούμενης',m.mu_away??m.live_outlook?.remaining_expected_goals?.away)+'</section>'+
 (n?'<section class="tdm-panel"><h3>Επόμενο γκολ</h3><div class="tdm-probs">'+metric(m.home,n.home)+metric(m.away,n.away)+metric('Κανένα',n.none)+'</div></section>':'')+
 (valid&&d.player_xg?.length?'<section class="tdm-panel"><h3>xG παικτών</h3>'+d.player_xg.slice(0,15).map(x=>row(x.player_name||'Παίκτης #'+(x.player_id||'—'),x.xg.toFixed(2))).join('')+'</section>':'')+
 '<p class="tdm-note">Το ιστορικό καλύπτει όλες τις διαθέσιμες διοργανώσεις. Πρόσθετα στατιστικά αλλάζουν τις πιθανότητες μόνο όταν η νέα έκδοση περάσει ξεχωριστό χρονικό έλεγχο. Δεν πρόκειται για επικυρωμένη live ακρίβεια.</p>'+((!is&&d?.context_prediction)?'<section class="tdm-panel"><h3>Πραγματικά δεδομένα που επηρέασαν την εκτίμηση</h3>'+row('xG ιστορικών αγώνων – γηπεδούχος',d.context_prediction.context?.observed_xg?.home)+row('xG ιστορικών αγώνων – φιλοξενούμενη',d.context_prediction.context?.observed_xg?.away)+row('Ευρωπαϊκοί αγώνες στο δείγμα – γηπεδούχος',d.context_prediction.context?.european_matches?.home)+row('Ευρωπαϊκοί αγώνες στο δείγμα – φιλοξενούμενη',d.context_prediction.context?.european_matches?.away)+'</section>':'');
 }
 if(state.tab==='stats')content=currentSeasonFormBlock(m,d)+allStatisticsBlock(m,d)+content;
 if(state.tab==='summary')content=matchCenterLineups(m,d)+content;
 if(state.tab==='lineups')content=matchCenterLineups(m,d);
 const tabs=[...(m.source==='football-api.com'?[['events','Γεγονότα']]:[]),['summary','Ανάλυση / Overview'],['lineups','Ενδεκάδες / Lineups'],['history','Ιστορικό / H2H'],['stats','Stats & Metrics'],['analysis','Στατιστική ανάλυση'],['news','Νέα ομάδων'],['info','Info & Venue']];
 return '<div class="tdm-match-page">'+matchCenterHero(m,d,p,is)+olderEstimateTag(m)+'<div class="tdm-tabs tdm-match-tabs" role="tablist" aria-label="Στοιχεία αγώνα">'+tabs.map(([x,y])=>'<button data-tab="'+x+'" role="tab" aria-selected="'+(state.tab===x)+'" class="tdm-tab '+(state.tab===x?'active':'')+'">'+y+'</button>').join('')+'</div><div class="tdm-match-content" role="tabpanel">'+content+'</div></div>';
}
async function fetchDeep(id){
 if(!/^(?:sportmonks|football-api(?:-fixture)?)-[1-9]\d{0,13}$/.test(id)||deepCache.has(id)||deepLoading.has(id))return;
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
function syncResponsiveNavigation(){const nav=root.querySelector('.tdm-bottom'),header=root.querySelector('.tdm-top');if(!nav||!header)return;if(window.matchMedia('(min-width:781px)').matches){const auth=header.querySelector('.tdm-auth-nav');if(auth)header.insertBefore(nav,auth);else header.append(nav);}else if(nav.parentElement!==root)root.append(nav);}
function render(focus=false){root.classList.toggle('tdm-account-page',state.view==='account');const pos=focus?root.querySelector('[data-search]')?.selectionStart:null;root.innerHTML='<div class="tdm-wrap"><header class="tdm-top"><a href="/" class="tdm-brand"><img src="/brand.svg?v=20261019-transparent" alt="Tiki-Data"></a><div class="tdm-auth-nav" style="position:absolute;right:0;top:50%;transform:translateY(-50%);z-index:100;display:flex;align-items:center;gap:9px"><a href="/?account=1" class="tdm-profile-face" title="Προφίλ / Σύνδεση Google" aria-label="Προφίλ και σύνδεση Google" style="display:flex;justify-content:center;align-items:center;width:46px;height:46px;min-width:46px;border-radius:50%;background:linear-gradient(135deg,#eef3ff,#e3faff);border:2px solid #009ddd;color:#0064ed;box-shadow:0 2px 8px #0064ed22;text-decoration:none">'+ico('account')+'</a></div></header><main>'+
(state.fromCache?'<div class="tdm-cache-note">Αποθηκευμένα δεδομένα'+(state.snapshotAt?' · ενημέρωση '+E(new Date(state.snapshotAt).toLocaleString(window.__tdLocale==='el'?'el-GR':'en-GB',{timeZone:'Asia/Nicosia',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+' ώρα Κύπρου':'')+' · η ανανέωση είναι προσωρινά μη διαθέσιμη</div>':'')+(state.error?'<div class="tdm-empty">'+E(state.error)+' <button data-retry class="tdm-link">Ξανά</button></div>':'')+
(state.view==='transparency'?transparency():state.view==='home'?home():state.view==='teams'?teams():state.view==='account'?accountPanel():state.view==='detail'?details():fixtures())+'</main>'+SITE_FOOTER+'</div><nav class="tdm-bottom">'+[['home','Αρχική'],['matches','Αγώνες'],['live','Live'],['transparency','Διαφάνεια'],['account','Προφίλ']].map(([x,y])=>'<button data-view="'+x+'" '+((state.view===x||(x==='account'&&state.view==='teams'))?'class="active" aria-current="page"':'')+'>'+ico(x)+'<span>'+y+'</span></button>').join('')+'</nav>';
syncResponsiveNavigation();
 if(state.view==='detail')lastDetailSignature=matchRenderKey(state.matches.find(m=>String(m.id)===String(state.id)));
 if(focus){const i=root.querySelector('[data-search]');if(i){i.focus();try{i.setSelectionRange(pos,pos)}catch{}}}}
window.addEventListener('resize',syncResponsiveNavigation);
function routeForView(v){return v==='home'?'/':v==='matches'?'/predictions':v==='live'?'/predictions?filter=live':v==='transparency'?'/transparency':v==='account'?'/?account=1':null}
function navigate(v,targetPath=null){
 const nextPath=targetPath||routeForView(v);
 if(nextPath&&(location.pathname+location.search+location.hash)!==nextPath)history.pushState({tdView:v},'',nextPath);
 state.visible=42;state.previous=state.view==='detail'?state.previous:state.view;state.view=v;
 state.mode=v==='live'?'live':'all';
 state.query='';
 const target=targetPath?new URL(targetPath,location.origin):null;
 state.league=target&&['ucl','uel','uecl'].includes(target.searchParams.get('league'))?target.searchParams.get('league'):'all';
 if(v!=='detail')state.id='';
 if(v==='transparency')void loadAudit();
 if(v==='account')void accountLoad();
 render();
 if(['home','matches','live'].includes(v)){void refresh();void refreshLive();}
 if(target?.hash){const id=decodeURIComponent(target.hash.slice(1));requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView())}else window.scrollTo(0,0);
}
function openMatch(id,targetPath=null){
 if(!/^(?:sportmonks|football-api(?:-fixture)?)-[1-9]\d{0,13}$/.test(String(id||'')))return;
 const prior=state.view==='detail'?state.previous:state.view;
 state.previous=prior;state.id=id;state.view='detail';state.tab='summary';
 const q=new URLSearchParams();if(prior==='live'||state.mode==='live')q.set('filter','live');if(prior==='home'||prior==='teams')q.set('from',prior);q.set('match',id);
 const nextPath=targetPath||('/predictions?'+q.toString());
 if((location.pathname+location.search+location.hash)!==nextPath)history.pushState({tdView:'detail',matchId:id},'',nextPath);
 if(deepCache.has(id)||deepLoading.has(id))render();else void fetchDeep(id);
 window.scrollTo(0,0);
}
function syncRouteFromLocation(){
 const q=new URLSearchParams(location.search),signIn=q.get('signin'),candidate=q.get('match');
 const matchId=/^(?:sportmonks|football-api(?:-fixture)?)-[1-9]\d{0,13}$/.test(candidate||'')?candidate:'';
 const next=q.get('account')==='1'||authText[signIn]?'account':location.pathname.startsWith('/transparency')?'transparency':location.pathname.includes('/predictions')?(matchId?'detail':q.get('filter')==='live'?'live':'matches'):'home';
 const from=q.get('from');
 state.previous=next==='detail'?(['home','matches','live','teams'].includes(from)?from:q.get('filter')==='live'?'live':'matches'):(state.view==='detail'?state.previous:state.view);
 state.view=next;state.mode=q.get('filter')==='live'?'live':'all';state.query='';
 state.league=['ucl','uel','uecl'].includes(q.get('league'))?q.get('league'):'all';state.id=next==='detail'?matchId:'';state.visible=42;
 if(next==='detail'&&state.id&&!deepCache.has(state.id)&&!deepLoading.has(state.id))void fetchDeep(state.id);else render();
 if(next==='transparency')void loadAudit();
 if(next==='account')void accountLoad();
 if(['home','matches','live'].includes(next)){void refresh();void refreshLive();}
 window.scrollTo(0,0);
}
window.addEventListener('popstate',syncRouteFromLocation);
root.addEventListener('click',e=>{const share=e.target.closest('[data-match-share]');if(share){const url=new URL('/predictions',location.origin);url.searchParams.set('match',state.id);if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(url.href).then(()=>{share.textContent='Ο σύνδεσμος αντιγράφηκε ✓'}).catch(()=>{share.textContent='Αντιγραφή από τη γραμμή διεύθυνσης'});else share.textContent='Αντιγραφή από τη γραμμή διεύθυνσης';return}const link=e.target.closest('a[href]');if(link&&!e.defaultPrevented&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&(!link.target||link.target==='_self')&&!link.hasAttribute('download')){const url=new URL(link.href,location.href);if(url.origin===location.origin&&!(url.hash&&url.pathname===location.pathname&&url.search===location.search)){if(url.pathname==='/transparency'){e.preventDefault();navigate('transparency',url.pathname+url.search+url.hash);return}if(url.pathname==='/predictions'&&url.searchParams.get('match')){e.preventDefault();openMatch(url.searchParams.get('match'),url.pathname+url.search+url.hash);return}if(url.pathname==='/predictions'){e.preventDefault();navigate(url.searchParams.get('filter')==='live'?'live':'matches',url.pathname+url.search+url.hash);return}if(url.pathname==='/'&&url.searchParams.get('account')==='1'){e.preventDefault();navigate('account',url.pathname+url.search+url.hash);return}if(url.pathname==='/'&&!url.search){e.preventDefault();navigate('home',url.pathname+url.search+url.hash);return}}}const allDays=e.target.closest('[data-audit-all-days]');if(allDays){auditDay='all';render();return}const shift=e.target.closest('[data-audit-shift]');if(shift){const day=auditDay==='all'?auditDayKey(Date.now()):auditDay;const next=new Date(Date.parse(day+'T12:00:00Z')+Number(shift.dataset.auditShift)*86400000).toISOString().slice(0,10);auditDay=next<'2026-10-18'?'2026-10-18':next>auditDayKey(Date.now())?auditDayKey(Date.now()):next;render();return}const leagueButton=e.target.closest('[data-audit-league]');if(leagueButton){auditLeague=leagueButton.getAttribute('data-audit-league');render();return}const auditButton=e.target.closest('[data-audit-status]');if(auditButton){auditFilter=auditButton.getAttribute('data-audit-status');render();return}const b=e.target.closest('[data-team],[data-view],[data-back],[data-open],[data-mode],[data-league],[data-day],[data-tab],[data-retry],[data-more],[data-auth-league],[data-auth-import],[data-auth-logout],[data-auth-delete]');if(!b)return;const a=n=>b.getAttribute('data-'+n);
if(b.hasAttribute('data-team')){const v=a('team');followed=(isFav(v)?followed.filter(x=>norm(x)!==norm(v)):[...followed,v]).slice(0,40);if(accountUser)accountSave();else{guestFollowed=followed.slice();try{localStorage.setItem(favKey,JSON.stringify(guestFollowed))}catch{}}render();return}if(b.hasAttribute('data-auth-import')){followed=[...new Set([...followed,...guestFollowed])].slice(0,40);accountSave();render();return}if(b.hasAttribute('data-auth-league')){const k=a('auth-league');accountLeagues=accountLeagues.includes(k)?accountLeagues.filter(x=>x!==k):[...accountLeagues,k].slice(0,12);accountSave();render();return}if(b.hasAttribute('data-auth-logout')){void accountAction('logout');return}if(b.hasAttribute('data-auth-delete')){void accountAction('delete');return}
if(b.hasAttribute('data-view'))return navigate(a('view'));if(b.hasAttribute('data-back'))return navigate(state.previous==='detail'?'matches':state.previous);
if(b.hasAttribute('data-open')){openMatch(a('open'));return}
if(b.hasAttribute('data-more')){state.visible+=42;render();return}if(b.hasAttribute('data-mode')){state.mode=a('mode');state.visible=42;ensureAvailableDay();render();return}if(b.hasAttribute('data-league')){state.league=a('league');state.dayAllExplicit=false;state.visible=42;ensureAvailableDay();render();return}if(b.hasAttribute('data-day')){state.day=a('day');state.dayAllExplicit=state.day==='all';state.visible=42;render();return}if(b.hasAttribute('data-tab')){state.tab=a('tab');render();if(!deepCache.has(state.id))void fetchDeep(state.id);return}if(b.hasAttribute('data-retry'))refresh()});
root.addEventListener('change',e=>{if(e.target.matches('[data-audit-day]')){const value=e.target.value;auditDay=/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='2026-10-18'&&value<=auditDayKey(Date.now())?value:'all';render();return}if(e.target.matches('[data-pick-day]')){state.day=/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)?e.target.value:'all';render()}});
root.addEventListener('input',e=>{if(e.target.matches('[data-search]')){state.query=e.target.value;render(true)}});root.addEventListener('keydown',e=>{if(e.target.matches('[data-open]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click()}});
/* Show the most recent verified public fixture snapshot immediately on return visits.
 * Cache lifetime is 5 minutes; network refresh runs independently of live events. */
const warmKey='tiki.mobile.fixture.snapshot.football-api.v1';
let lastSavedFixturesSignature='',lastFixtureStorageAt=0;
function rememberFixtures(){
 try{
  const fields=['id','home','away','date','league','league_key','status','minute','home_score','away_score','p1','px','p2','logos','home_logo','away_logo','league_logo','statistical_evidence','forecast_review','experimental_preview','history_competitions','historical_sample','european_form','strength','prediction_tier','live_outlook','live_prediction','prematch_prediction','over25','under25','btts','mu_home','mu_away','most_likely_score'];
  const recent=state.matches.slice(0,150).map(m=>Object.fromEntries(fields.filter(k=>Object.prototype.hasOwnProperty.call(m,k)).map(k=>[k,m[k]])));
  const signature=JSON.stringify(recent),now=Date.now();
  if(signature===lastSavedFixturesSignature&&now-lastFixtureStorageAt<21600000)return;
  if(now-lastFixtureStorageAt<60000)return;
  localStorage.setItem(warmKey,JSON.stringify({saved:now,matches:recent}));
  lastSavedFixturesSignature=signature;lastFixtureStorageAt=now;
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
let updating=false,liveUpdating=false,baseMatches=[],liveMatches=[],lastFixtureRequestAt=0,lastLiveRequestAt=0,lastPaintSignature='',lastDetailSignature='';
function matchRenderKey(m){if(!m)return '';return JSON.stringify([m.id,m.home,m.away,m.date,m.league,m.league_key,m.status,m.minute,m.home_score,m.away_score,m.p1,m.px,m.p2,m.live_outlook?.p1,m.live_outlook?.px,m.live_outlook?.p2,m.live_outlook?.live_stats_applied,m.live_outlook?.live_stats_adjustment,m.live_prediction?.p1,m.live_prediction?.px,m.live_prediction?.p2,m.prematch_prediction?.p1,m.prematch_prediction?.px,m.prematch_prediction?.p2,m.over25,m.under25,m.btts,m.mu_home,m.mu_away,m.prediction_tier,m.live_probability_stale,m.logos?.home,m.logos?.away,m.home_logo,m.away_logo,m.league_logo,m.live_stats,m.events,m.lineups,m.recent_form]);}
function matchListRenderKey(list){return list.map(matchRenderKey).join('|');}
function canRenderDataView(){return ['home','matches','live','teams','detail'].includes(state.view);}
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
 const nextMatches=[...all.values()].filter(x=>x?.id&&x.home&&x.away&&Number.isFinite(Date.parse(x.date)))
  .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const signature=matchListRenderKey(nextMatches),changed=signature!==lastPaintSignature;
 state.matches=nextMatches;
 if(changed)lastPaintSignature=signature;
 rememberFixtures();
 if(!changed)return false;
 if(state.view==='detail'){
  const detailKey=matchRenderKey(state.matches.find(x=>String(x.id)===String(state.id)));
  if(detailKey!==lastDetailSignature){lastDetailSignature=detailKey;render();return true;}
  return false;
 }
 if(['home','matches','live','teams'].includes(state.view)){render();return true;}
 return false;
}
async function refresh(){
 const now=Date.now();
 if(updating||['transparency','account'].includes(state.view)||now-lastFixtureRequestAt<30000)return;
 updating=true;lastFixtureRequestAt=now;
 try{
  const controller=new AbortController(),abort=setTimeout(()=>controller.abort(),16000);
  let payload;
  try{const response=await fetch('/api/home-focus',{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
   if(!response.ok)throw Error('fixture_api');payload=await response.json()}
  finally{clearTimeout(abort)}
  if(!Array.isArray(payload?.matches))throw Error('fixture_shape');
  const previousMeta=JSON.stringify([state.loading,state.error,state.fromCache,state.snapshotAt]);
  baseMatches=payload.matches.filter(x=>x?.id&&x.home&&x.away&&Number.isFinite(Date.parse(x.date)));
  state.loading=false;state.error='';state.fromCache=!!payload.stale;state.snapshotAt=payload.snapshot_saved_at||payload.updated_at||'';
  const matchesChanged=paintMatches();
  if(!matchesChanged&&previousMeta!==JSON.stringify([state.loading,state.error,state.fromCache,state.snapshotAt])&&canRenderDataView())render();
 }catch{const prior=state.error,wasLoading=state.loading;state.loading=false;if(!state.matches.length)state.error='Δεν φορτώθηκαν αγώνες από το API. Δοκίμασε ξανά σε λίγο.';if(canRenderDataView()&&(state.error!==prior||state.loading!==wasLoading))render()}
 finally{updating=false}
}
async function refreshLive(){
 const now=Date.now();
 if(liveUpdating||document.hidden||['transparency','account'].includes(state.view)||now-lastLiveRequestAt<15000)return;
 liveUpdating=true;lastLiveRequestAt=now;
 try{
  const controller=new AbortController(),abort=setTimeout(()=>controller.abort(),18000);
  let snapshot;
  try{const response=await fetch('/api/live',{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
   if(!response.ok)throw Error('live_backend_unavailable');snapshot=await response.json()}
  finally{clearTimeout(abort)}
  if(!Array.isArray(snapshot?.matches)){
   const changed=!state.livePending;state.livePending=true;if(changed&&canRenderDataView())render();return;
  }
  const timestamp=Date.parse(snapshot.updated_at);
  if(!Number.isFinite(timestamp)||timestamp>Date.now()+60000||Date.now()-timestamp>900000){
   const changed=!state.livePending;state.livePending=true;if(changed&&canRenderDataView())render();return;
  }
  const wasPending=state.livePending;
  liveMatches=snapshot.matches;
  state.liveUpdatedAt=snapshot.updated_at;state.livePending=!!(snapshot.refreshing||snapshot.stale||snapshot.pending);
  const matchesChanged=paintMatches();
  if(wasPending!==state.livePending&&!matchesChanged&&canRenderDataView())render();
 }catch{const changed=!state.livePending;state.livePending=true;if(changed&&canRenderDataView())render()}
 finally{liveUpdating=false}
}
async function loadUefaStages(){try{const r=await fetch('/api/uefa/stages',{headers:{Accept:'application/json'}});if(!r.ok)return;const d=await r.json();if(!Array.isArray(d?.leagues))return;for(const league of d.leagues)for(const stage of league.stages||[]){if(Number.isSafeInteger(stage.id)&&typeof stage.name==='string')uefaStageById.set(stage.id,stage.name)}if(uefaStageById.size&&canRenderDataView())render();}catch{}}
async function loadAudit(){
 if(auditLoaded)return Promise.resolve();
 if(auditPromise)return auditPromise;
 auditLoading=true;auditError='';
 auditPromise=(async()=>{
  const matches=new Map();let start='2026-10-18',completed=false;const end=auditDayKey(Date.now());
  try{
   while(start){
    const r=await fetch('/api/transparency?start='+encodeURIComponent(start)+'&end='+end,{headers:{Accept:'application/json'}});
    if(!r.ok)throw Error('audit_unavailable');const d=await r.json();
    if(!Array.isArray(d.matches))throw Error('audit_shape');
    for(const m of d.matches)matches.set(m.fixture_id,m);
    if(d.partial||d.stale)auditError='Μερική διαθεσιμότητα δεδομένων · ο έλεγχος δεν ολοκληρώθηκε.';
    if(d.next&&d.next<=start)throw Error('audit_cursor');start=d.next;
   }
   auditArchive={matches:[...matches.values()].sort((a,b)=>a.kickoff.localeCompare(b.kickoff))};
   completed=true;auditLoaded=true;
  }catch{auditError='Δεν ολοκληρώθηκε η φόρτωση όλων των αγώνων. Ανανέωσε τη σελίδα.';}
  finally{
   auditLoading=false;auditPromise=null;
   if(!completed)auditLoaded=false;
   if(state.view==='transparency')render();
  }
 })();
 return auditPromise;
}

setInterval(()=>{if(document.hidden||state.view!=='detail')return;const m=state.matches.find(m=>m.id===state.id);if(m?.source==='football-api.com'&&live(m)){deepCache.delete(state.id);void fetchDeep(state.id)}},120000);
function init(){document.body.appendChild(root);document.documentElement.classList.add('td-mobile-ready');if(state.view==='transparency'){render();void loadAudit();return}restoreFixtures();baseMatches=state.matches.slice();render();void accountLoad();void refresh();void refreshLive();if(state.view==='detail'&&state.id)void fetchDeep(state.id);void loadUefaStages();setInterval(()=>{if(!document.hidden)void refresh()},300000);setInterval(()=>{if(!document.hidden)void refreshLive()},30000)}
window.matchMedia('(min-width:781px)').addEventListener('change',()=>{if(root.isConnected)render()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
