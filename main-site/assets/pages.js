import {BRAND_LOGO} from './components.js?v=7';
import {MatchCard,PredictionCard,Insight,CompetitionFilters,LEAGUES,esc,hasPrediction} from './components.js?v=7';
import {chooseFeatured} from './data.js';
export function Hero({matches}){
 const n=matches.length;
 const leagues=new Set(matches.map(m=>m.league)).size;
 const ready=matches.filter(hasPrediction).length;
 return `<section class="hero"><div class="hero-grid"><div class="hero-copy">
  <div class="hero-kicker">TIKI-DATA · FOOTBALL PREDICTIONS</div>
  <h1>Η ανάλυση πίσω <span>από το παιχνίδι.</span></h1>
  <p>Επιλεγμένοι αγώνες με στατιστική πρόβλεψη. Καθαρά δεδομένα, σαφείς πιθανότητες και καμία αυθαίρετη εκτίμηση.</p>
  <div class="hero-stats"><div class="mini-stat"><b>${n}</b><span>προσεχείς αγώνες</span></div>
  <div class="mini-stat"><b>${leagues}</b><span>διοργανώσεις με αγώνες</span></div>
  <div class="mini-stat"><b>${ready}</b><span>αγώνες με πρόβλεψη</span></div></div></div>
  <div class="hero-match"><div class="hero-match-title">TIKI-DATA · FOOTBALL INTELLIGENCE</div>
   <div class="hero-graphic"><img class="hero-wordmark" src="${BRAND_LOGO}" width="410" height="108" alt="Tiki-Data"></div>
   <a class="hero-discover" href="/predictions">Εξερεύνησε τους αγώνες ↗</a>
  </div></div></section>`;
}
export function HowItWorks(){
 return `<section class="how-wrap" aria-labelledby="howTitle"><div class="section-kicker">HOW IT WORKS <span class="kicker-dot"></span> ΕΞΗΓΗΣΗ</div>
  <h2 id="howTitle" class="home-title">Πιθανότητες, <em>όχι βεβαιότητες.</em></h2>
  <div class="info-grid"><div><b>01. Τα δεδομένα</b><p>Πραγματικά προγράμματα και αποτελέσματα από το football-data.org, όπου επιτρέπεται πρόσβαση.</p></div>
  <div><b>02. Το μοντέλο</b><p>Εκτίμηση τερμάτων και πιθανοτήτων μέσω Poisson. Δεν εμφανίζουμε προβλέψεις όταν λείπουν επαρκή ιστορικά δεδομένα.</p></div>
  <div><b>03. Οι περιορισμοί</b><p>Το μοντέλο δεν έχει επαληθευτεί με ανεξάρτητο backtest και δεν περιλαμβάνει xG, απουσίες ή βεβαιότητα αποτελέσματος.</p></div></div>
  </section>`;
}
export function Home({matches,featuredId}){
 const featured=matches.find(m=>String(m.id)===String(featuredId))||chooseFeatured(matches);
 const previews=matches.filter(m=>String(m.id)!==String(featured?.id))
  .sort((a,b)=>Number(hasPrediction(b))-Number(hasPrediction(a))||Date.parse(a.date)-Date.parse(b.date)).slice(0,4);
 return `${Hero({matches})}
  <section class="home-feature"><div class="section-kicker">MATCH OF THE DAY <span class="kicker-dot"></span> ΣΤΟ ΕΠΙΚΕΝΤΡΟ</div>
   <h2 class="home-title">Η ανάλυση του <em>αγώνα.</em></h2>
   <div class="home-spotlight"><div>${MatchCard({match:featured,highlight:true})}</div>${Insight({matches})}</div>
  </section>
  <section class="top-preview" aria-labelledby="topPredsTitle"><div class="section-kicker">TOP PREDICTIONS <span class="kicker-dot"></span> ΕΠΟΜΕΝΟΙ ΑΓΩΝΕΣ</div>
    <div class="preview-heading"><div><h2 id="topPredsTitle" class="home-title">Κορυφαίες <em>προβλέψεις.</em></h2><p class="subtle">Μόνο αγώνες με ολοκληρωμένη εκτίμηση του μοντέλου.</p></div></div>
    <div class="preview-grid">${previews.length?previews.map(m=>`<a class="preview-link" data-match="${esc(m.id)}" href="/?match=${encodeURIComponent(m.id)}" aria-label="Επιλογή αγώνα ${esc(m.home)} με ${esc(m.away)}">${PredictionCard({match:m,as:'div'})}</a>`).join(''):'<div class="empty">Δεν υπάρχουν άλλοι διαθέσιμοι αγώνες.</div>'}</div>
    <div class="cta-center"><a class="cta-btn" href="/predictions">Δείτε όλες τις προβλέψεις <span aria-hidden="true">↗</span></a></div>
  </section>
  ${HowItWorks()}`;
}
export function Predictions({matches,chosenLeague='',dateFilter='all',search='',visibleCount=8,selectedId=null}){
 const dateNow=new Date();
 const filtered=matches.filter(m=>{
   if(chosenLeague&&m.league!==chosenLeague)return false;
   if(search&&!(m.home+' '+m.away+' '+(LEAGUES[m.league]?.name||'')).toLocaleLowerCase('el-GR').includes(search))return false;
   if(dateFilter==='today')return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Nicosia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(m.date))===new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Nicosia',year:'numeric',month:'2-digit',day:'2-digit'}).format(dateNow);
   if(dateFilter==='next7')return Date.parse(m.date)>=Date.now()&&Date.parse(m.date)<Date.now()+7*86400000;
   return true;
 });
 const limited=filtered.slice(0,visibleCount);
 return `<section class="predictions-page"><div class="section-kicker">MATCH CENTER <span class="kicker-dot"></span> ΠΡΟΒΛΕΨΕΙΣ</div>
   <h1 class="predictions-title">Λίστα <em>Προβλέψεων.</em></h1><p class="predictions-intro">Μόνο αγώνες με έγκυρη πρόβλεψη. Επίλεξε διοργάνωση ή αναζήτησε ομάδα. Τα ποσοστά αφορούν το 90λεπτο και δεν είναι αποδόσεις στοιχηματικών εταιρειών.</p>
   <div class="predictions-layout"><aside class="sidebar filters-sidebar" aria-label="Φίλτρα διοργανώσεων"><div class="filters-title"><h3>Διοργανώσεις</h3><button id="clearLeague" class="clear-filter" type="button">Καθαρισμός</button></div>
     <div class="league-list" id="leagueList">${CompetitionFilters({matches,chosen:chosenLeague})}</div>
     <div class="sidebar-tip"><b>Tiki-Data Insight</b><p>Η πιθανότητα δεν είναι εγγύηση. Οι προβλέψεις είναι στατιστικές εκτιμήσεις.</p></div>
   </aside><main class="content"><div class="catalog-toolbar"><div class="chips" id="dateChips">
       ${[['all','Όλες οι ημέρες'],['today','Σήμερα'],['next7','7 ημέρες']].map(([key,label])=>`<button type="button" class="chip ${dateFilter===key?'active':''}" data-date="${key}" aria-pressed="${dateFilter===key}">${label}</button>`).join('')}
       </div><span class="subtle" id="resultCount">${limited.length} από ${filtered.length} αγώνες</span></div>
     <div class="predictions-catalog"><div class="catalog-list card"><div class="list-head"><h3>Αναμετρήσεις <small class="click-match-hint">· Πάτησε έναν αγώνα για ανάλυση ↗</small></h3><span class="subtle">${filtered.length} διαθέσιμες</span></div>
       <div class="pred-list" id="matchList">${limited.length?limited.map(m=>PredictionCard({match:m,selected:false})).join(''):'<div class="empty">Δεν υπάρχουν διαθέσιμες προβλέψεις για αυτά τα φίλτρα. Δοκίμασε άλλη διοργάνωση ή ημέρα.</div>'}</div>
       ${visibleCount<filtered.length?`<button class="load-more" type="button" id="loadMore">Φόρτωσε 8 ακόμη αγώνες <span aria-hidden="true">↓</span></button>`:''}
       </div></div>
   </main></div></section>`;
}
