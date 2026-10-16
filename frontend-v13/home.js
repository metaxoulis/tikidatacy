/* Tiki-Data homepage controller. Intentionally independent of predictions/table DOM. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  if (!$('featured') || !$('upcomingGrid')) return;

  const logos = window.TIKI_LOGO_CATALOG || { teams: {}, leagues: {} };
  const teams = new Map();
  const shortTeams = new Map();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
  const shortName = value => normalize(value).replace(/\b(?:fc|afc|cf|sc|ac)\b/g, '').replace(/\s+/g, ' ').trim();
  const safeLogo = url => typeof url === 'string' && /^https:\/\/(?:raw\.githubusercontent\.com|media\.api-sports\.io)\//.test(url) ? url : null;
  const aliases = new Map([['olympiacos piraeus','olympiakos piraeus'],['olympiacos','olympiakos piraeus']]);
  for (const [name, url] of Object.entries(logos.teams || {})) {
    const safe = safeLogo(url);
    if (!safe) continue;
    teams.set(normalize(name), safe);
    const short = shortName(name);
    if (!shortTeams.has(short)) shortTeams.set(short, safe);
    else if (shortTeams.get(short) !== safe) shortTeams.set(short, null);
  }

  const leagues = {
    ucl: ['UEFA Champions League','UCL'], uel: ['UEFA Europa League','UEL'],
    uecl: ['UEFA Conference League','UECL'], epl: ['Premier League','PL'],
    laliga: ['La Liga','LL'], bundesliga: ['Bundesliga','BL'],
    seriea: ['Serie A','SA'], ligue1: ['Ligue 1','L1'],
    greece: ['Greek Super League','GSL'], cyprus: ['Cyprus First Division','CYP']
  };
  const leagueName = key => leagues[key]?.[0] || String(key || 'Διοργάνωση').replace(/[_-]/g, ' ');
  const leagueAbbr = key => leagues[key]?.[1] || String(key || '').slice(0,3).toUpperCase();
  const number = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
  const probability = n => number(n) == null ? '—' : n.toLocaleString('el-GR', { maximumFractionDigits:1 }) + '%';
  const validModel = m => !!m && [m.p1,m.px,m.p2].every(n => number(n) !== null && n >= 0 && n <= 100) && Math.abs(m.p1 + m.px + m.p2 - 100) < 2;
  const formatter = {
    weekday: new Intl.DateTimeFormat('el-GR', { weekday:'short', day:'numeric', month:'short' }),
    full: new Intl.DateTimeFormat('el-GR', { weekday:'long', day:'numeric', month:'long' }),
    time: new Intl.DateTimeFormat('el-GR', { hour:'2-digit', minute:'2-digit', hour12:false })
  };
  const day = (date, type='weekday') => formatter[type].format(new Date(date));
  const time = date => formatter.time.format(new Date(date));
  const icon = name => {
    const paths = {
      info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
      alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>'
    };
    return '<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.info) + '</svg>';
  };
  const fallbackImage = name => {
    const initials = String(name || 'FC').replace(/\b(fc|cf|sc|ac|afc|sv|club)\b/gi,'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || 'FC';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#19455a" stroke="#70d8bb" stroke-width="2"/><text x="32" y="40" text-anchor="middle" font-size="19" font-family="Arial,sans-serif" font-weight="bold" fill="#d9fff1">' + esc(initials) + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  };
  const crest = (name, className='table-crest') => {
    const key = normalize(name);
    const url = teams.get(key) || teams.get(aliases.get(key)) || shortTeams.get(shortName(name));
    return '<span class="'+esc(className)+'" title="'+esc(name)+'"><img class="logo-fallback" src="'+fallbackImage(name)+'" alt="" loading="lazy" />' +
      (url ? '<img class="logo-image" src="'+esc(url)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"/>' : '') + '</span>';
  };
  const leagueIcon = (code, className='small-league') => {
    const url = safeLogo(logos.leagues?.[code]);
    return '<span class="'+esc(className)+'" title="'+esc(leagueName(code))+'">' + esc(leagueAbbr(code)) +
      (url ? '<img class="logo-image league-image" src="'+esc(url)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"/>' : '') + '</span>';
  };
  const renderText = (id, value) => { const node=$(id); if (node) node.textContent=String(value); };
  const renderHTML = (id, value) => { const node=$(id); if (node) node.innerHTML=value; };
  const setBusy = (busy) => {
    document.body.classList.toggle('is-loading', busy);
    for (const id of ['featured','spotPred','spotMarkets','statsCompare','upcomingGrid']) {
      const node=$(id);
      if (node) node.setAttribute('aria-busy',String(busy));
    }
  };

  let matches = [];
  let featured = null;
  let inFlight = null;
  let modalPreviousFocus = null;

  function renderSummary(list) {
    renderText('metricMatches',list.length);
    renderText('metricLeagues',new Set(list.map(m=>m.league)).size);
    renderText('metricAnalyses',list.filter(validModel).length);
    for (const id of ['metricMatches','metricLeagues','metricAnalyses']) $(id)?.removeAttribute('aria-hidden');
  }

  function marketCell(name, value, best=false) {
    return '<div class="market'+(best?' strongest':'')+'"><small>'+esc(name)+'</small><b>'+esc(probability(value))+'</b></div>';
  }
  function preferred(a,b) {
    return number(a) !== null && number(b) !== null && a >= 0 && a <= 100 && b >= 0 && b <= 100 && a !== b ? a>b?0:1 : -1;
  }
  function renderFeatured(match) {
    featured = match || null;
    const details = $('spotDetails'), analyse = $('statsAnalyze');
    if (details) details.disabled=!match;
    if (analyse) analyse.disabled=!match;
    if (!match) {
      renderText('spotLabel','NO UPCOMING MATCH');
      renderText('spotLeague','Δεν υπάρχει προγραμματισμένος αγώνας');
      renderText('spotDate','—');
      renderHTML('spotHome',crest('','featured-crest')+'<b>—</b>');
      renderHTML('spotAway',crest('','featured-crest')+'<b>—</b>');
      renderHTML('spotPred','<div class="feature-prob muted">'+icon('info')+' Δεν υπάρχουν προσεχείς αγώνες για ανάλυση.</div>');
      renderHTML('spotMarkets','');
      renderText('statsHome','HOME');
      renderText('statsAway','AWAY');
      renderHTML('statsCompare','<p class="stats-note">Η σύγκριση θα εμφανιστεί όταν υπάρχει διαθέσιμος αγώνας.</p>');
      return;
    }
    renderHTML('spotLeague',leagueIcon(match.league)+'<span>'+esc(leagueName(match.league))+'</span>');
    renderText('spotDate',day(match.date)+' · '+time(match.date));
    renderText('spotLabel',validModel(match)?'MODEL AVAILABLE':'UPCOMING');
    renderHTML('spotHome',crest(match.home,'featured-crest')+'<b>'+esc(match.home)+'</b>');
    renderHTML('spotAway',crest(match.away,'featured-crest')+'<b>'+esc(match.away)+'</b>');
    if (validModel(match)) {
      const values=[match.p1,match.px,match.p2],best=Math.max(...values);
      renderHTML('spotPred',values.map((p,i)=>'<div class="feature-prob'+(p===best?' best strongest':'')+'"><div><small>'+['1','X','2'][i]+'</small><b>'+esc(probability(p))+'</b></div><span class="track"><i style="width:'+Math.max(0,Math.min(p,100))+'%"></i></span></div>').join(''));
    } else {
      renderHTML('spotPred','<div class="feature-prob muted">'+icon('info')+' Δεν υπάρχουν επαρκή δεδομένα για πιθανότητες 1Χ2.</div>');
    }
    const ou=preferred(match.over25,match.under25), bt=preferred(match.btts,match.no_btts);
    renderHTML('spotMarkets',marketCell('Over 2.5',match.over25,ou===0)+marketCell('Under 2.5',match.under25,ou===1)+marketCell('BTTS · Ναι',match.btts,bt===0)+marketCell('BTTS · Όχι',match.no_btts,bt===1));
    renderText('statsHome',match.home);
    renderText('statsAway',match.away);
    const stats=[['Αναμενόμενα γκολ',match.mu_home,match.mu_away],['Κατοχή μπάλας',null,null],['Σουτ στον στόχο',null,null]];
    renderHTML('statsCompare',stats.map(([label,l,r])=>{
      const available=number(l)!==null&&number(r)!==null, total=available?l+r:0, left=total>0?Math.round(100*l/total):50;
      return '<div class="stat-row"><span class="stat-val">'+(available?l.toFixed(2):'—')+'</span><div class="stat-row-mid"><span>'+esc(label)+'</span><div class="stat-track"><i style="width:'+(available?left:0)+'%"></i><b style="width:'+(available?100-left:0)+'%"></b></div></div><span class="stat-val">'+(available?r.toFixed(2):'—')+'</span></div>';
    }).join(''));
  }

  function renderUpcoming(soon) {
    const target=$('upcomingGrid');
    if (!target) return;
    if (!soon.length) {
      target.innerHTML='<div class="upcoming-empty" role="status">'+icon('info')+'<span>Δεν υπάρχουν καταχωρισμένοι προσεχείς αγώνες.</span><a href="/predictions">Προβολή προγράμματος</a></div>';
      return;
    }
    target.innerHTML=soon.slice(0,3).map(m=>{
      const good=validModel(m), values=[m.p1,m.px,m.p2], top=good?Math.max(...values):null;
      const win=top===null?'Δεν υπάρχει ανάλυση':['1','X','2'][values.indexOf(top)]+' · '+probability(top);
      return '<button class="upcoming-card" data-open="'+esc(m.id)+'" type="button" aria-label="Ανάλυση '+esc(m.home)+' εναντίον '+esc(m.away)+'"><span class="upcoming-card-head"><span class="upcoming-competition">'+leagueIcon(m.league)+'<span>'+esc(leagueName(m.league))+'</span></span><time datetime="'+esc(m.date)+'">'+esc(day(m.date))+' · '+esc(time(m.date))+'</time></span><span class="upcoming-teams"><span class="upcoming-side">'+crest(m.home)+'<b>'+esc(m.home)+'</b></span><span class="upcoming-vs">VS</span><span class="upcoming-side away">'+crest(m.away)+'<b>'+esc(m.away)+'</b></span></span><span class="upcoming-card-foot"><span>Εκτίμηση μοντέλου</span><strong class="'+(top===null?'no-prediction':'')+'">'+esc(win)+'</strong><span class="upcoming-arrow">'+icon('chevron')+'</span></span></button>';
    }).join('');
  }

  function renderError(reason) {
    renderText('metricMatches','—');
    renderText('metricLeagues','—');
    renderText('metricAnalyses','—');
    for(const id of ['metricMatches','metricLeagues','metricAnalyses']) $(id)?.removeAttribute('aria-hidden');
    renderFeatured(null);
    renderText('spotLabel','DATA UNAVAILABLE');
    const info='<div class="upcoming-empty" role="alert">'+icon('alert')+'<span>Δεν ήταν δυνατή η φόρτωση των αγώνων. Δοκίμασε ξανά.</span><button class="load-more" type="button" data-retry-home="1">Επανάληψη</button></div>';
    renderHTML('upcomingGrid',info);
    console.error('[Tiki-Data] Homepage data failed:',reason);
  }
  function safeRender(label,fn) {
    try { fn(); return true; }
    catch (error) { console.error('[Tiki-Data] '+label,error); return false; }
  }

  async function fetchFixtures() {
    if (inFlight) return inFlight;
    setBusy(true);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    inFlight=(async()=>{
      try {
        const response=await fetch('/api/fixtures',{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
        if (!response.ok) throw new Error('HTTP '+response.status);
        const body=await response.json();
        if (!body || !Array.isArray(body.matches)) throw new Error('Invalid matches[] response');
        matches=body.matches.filter(m=>m&&m.id!=null&&m.home&&m.away&&m.date&&Number.isFinite(Date.parse(m.date))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
        const now=Date.now();
        const future=matches.filter(m=>Date.parse(m.date)>=now);
        safeRender('summary',()=>renderSummary(matches));
        safeRender('featured',()=>renderFeatured(future.find(validModel)||future[0]||null));
        safeRender('upcoming',()=>renderUpcoming(future.slice(0,3)));
        document.body.dataset.tikiDataState='ready';
        document.dispatchEvent(new CustomEvent('tiki:home-ready',{detail:{matches:matches.length,upcoming:future.length}}));
      } catch (error) {
        document.body.dataset.tikiDataState='error';
        safeRender('error UI',()=>renderError(error));
      } finally {
        clearTimeout(timeout);
        inFlight=null;
        setBusy(false);
      }
    })();
    return inFlight;
  }

  function modalOpen(id) {
    const match=matches.find(m=>String(m.id)===String(id));
    if (!match || !$('modalMount')) return;
    modalPreviousFocus=document.activeElement;
    const values=validModel(match)?[match.p1,match.px,match.p2]:[null,null,null];
    const best=values.every(x=>x!==null)?Math.max(...values):null;
    const market=(key,val)=>'<div class="modal-cell"><small>'+esc(key)+'</small><b>'+esc(probability(val))+'</b></div>';
    const goals=(key,val)=>'<div class="modal-cell"><small>'+esc(key)+'</small><b>'+(number(val)===null?'—':esc(val.toFixed(2)))+'</b></div>';
    const scorelines=Array.isArray(match.scorelines)?match.scorelines.slice(0,4):[];
    renderHTML('modalMount','<div class="modal-backdrop" data-close-backdrop="1"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><div><span class="section-kicker">'+esc(leagueName(match.league))+'</span><h2 id="modalTitle">Ανάλυση αγώνα</h2></div><button type="button" class="modal-close" data-close-modal="1" aria-label="Κλείσιμο">×</button></div><div class="modal-body"><div class="modal-teams"><div class="modal-team">'+crest(match.home,'featured-crest')+esc(match.home)+'</div><span class="modal-vs">VS</span><div class="modal-team">'+crest(match.away,'featured-crest')+esc(match.away)+'</div></div><div class="modal-date">'+esc(day(match.date,'full'))+' · '+esc(time(match.date))+'</div><div class="modal-section">ΠΙΘΑΝΟΤΗΤΕΣ 1 / Χ / 2</div><div class="modal-probs">'+values.map((v,i)=>'<div class="modal-cell'+(v!==null&&v===best?' best':'')+'"><small>'+['1 · Γηπεδούχος','X · Ισοπαλία','2 · Φιλοξενούμενος'][i]+'</small><b>'+esc(probability(v))+'</b></div>').join('')+'</div><div class="modal-section">ΑΝΑΛΥΣΗ ΓΚΟΛ</div><div class="modal-other">'+market('Over 2.5',match.over25)+market('Under 2.5',match.under25)+market('BTTS Ναι',match.btts)+market('BTTS Όχι',match.no_btts)+goals('xG Home',match.mu_home)+goals('xG Away',match.mu_away)+'</div>'+(scorelines.length?'<div class="modal-section">ΠΙΘΑΝΑ ΣΚΟΡ</div><div class="modal-other">'+scorelines.map(x=>market(x.score,x.prob)).join('')+'</div>':'')+'<p class="modal-disclaimer">Πειραματικές πιθανότητες βάσει μοντέλου Poisson. Δεν αποτελεί εγγύηση αποτελέσματος ή στοιχηματική σύσταση.</p></div></section></div>');
    document.body.style.overflow='hidden';
    $('modalMount').querySelector('[data-close-modal]')?.focus();
  }
  function modalClose() {
    const node=$('modalMount');
    if (!node || !node.innerHTML) return;
    node.innerHTML='';
    document.body.style.overflow='';
    modalPreviousFocus?.focus?.({preventScroll:true});
  }
  function showNotice(title,message) {
    const node=$('actionPopover');
    if (!node) return;
    node.innerHTML='<strong>'+esc(title)+'</strong><p>'+esc(message)+'</p>';
    node.hidden=false;
  }

  document.addEventListener('click',event=>{
    const clicked=event.target.closest?.('[data-open],#spotDetails,#statsAnalyze,[data-close-modal],[data-close-backdrop],[data-retry-home],#notifyBtn,#profileBtn');
    if (!clicked) return;
    if (clicked.matches('[data-open]')) modalOpen(clicked.dataset.open);
    else if (clicked.matches('#spotDetails,#statsAnalyze') && featured) modalOpen(featured.id);
    else if (clicked.matches('[data-close-modal],[data-close-backdrop]')) modalClose();
    else if (clicked.matches('[data-retry-home]')) void fetchFixtures();
    else if (clicked.id==='notifyBtn') showNotice('Ειδοποιήσεις','Δεν υπάρχει ενεργή υπηρεσία ειδοποιήσεων.');
    else if (clicked.id==='profileBtn') showNotice('Guest access','Η αναζήτηση και οι προβλέψεις είναι διαθέσιμες χωρίς λογαριασμό.');
  });
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape') { modalClose(); if ($('actionPopover')) $('actionPopover').hidden=true; }
    if (event.key==='Tab' && $('modalMount')?.innerHTML) {
      const buttons=[...$('modalMount').querySelectorAll('button:not(:disabled)')];
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement===buttons[0]) { event.preventDefault();buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement===buttons.at(-1)) { event.preventDefault();buttons[0].focus(); }
    }
  });
  document.addEventListener('error',event=>{
    const img=event.target;
    if (img?.tagName==='IMG' && img.classList.contains('logo-image')) img.remove();
  },true);
  const search=$('globalSearch');
  if (search) {
    search.placeholder='Αναζήτηση στις προβλέψεις…';
    search.addEventListener('keydown',event=>{
      if (event.key==='Enter' && search.value.trim()) location.href='/predictions?q='+encodeURIComponent(search.value.trim());
    });
  }
  document.querySelector('.bottom-nav a[href="/"]')?.setAttribute('aria-current','page');
  renderText('year',new Date().getFullYear());
  void fetchFixtures();
})();
