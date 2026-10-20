(()=>{'use strict';
const deepCache=new Map(),deepLoading=new Set();
const favKey='tiki.followedTeams.v2',params=new URLSearchParams(location.search),state={view:params.get('account')==='1'?'account':location.pathname.startsWith('/transparency')?'transparency':location.pathname.includes('/predictions')?'matches':'home',previous:'matches',mode:params.get('filter')==='live'?'live':'all',league:['ucl','uel','uecl'].includes(params.get('league'))?params.get('league'):'all',day:'all',query:'',tab:'summary',id:'',matches:[],loading:true,error:'',fromCache:false,visible:42,liveUpdatedAt:'',livePending:false};
let followed=[];try{const f=JSON.parse(localStorage.getItem(favKey)||'[]');if(Array.isArray(f))followed=f.filter(v=>typeof v==='string')}catch{}
let guestFollowed=followed.slice(),accountUser=null,accountCsrf='',loginEnabled=null,accountLeagues=[],accountError='';let saving=Promise.resolve();
const authResult=(new URLSearchParams(location.search)).get('signin')||'';
const authText={success:'Η Google επιβεβαίωσε τη σύνδεση. Φορτώνονται οι ρυθμίσεις σου…',start_error:'Δεν ξεκίνησε η σύνδεση. Ελέγξτε τη σύνδεση Cloudflare και δοκιμάστε ξανά.',google_denied:'Η Google δεν επέτρεψε τη σύνδεση. Αν η εφαρμογή βρίσκεται σε Testing, πρόσθεσε το Google email σου στους Test users.',flow_error:'Η αίτηση σύνδεσης έληξε ή το cookie ελέγχου δεν βρέθηκε. Δοκίμασε ξανά από το ίδιο πρόγραμμα περιήγησης.',token_error:'Η Google δεν ολοκλήρωσε την ανταλλαγή του κωδικού OAuth. Έλεγξε το Client Secret και το Redirect URI.',identity_error:'Η ταυτότητα Google δεν επαληθεύτηκε. Δοκίμασε ξανά ή επικοινώνησε με τη διαχείριση.',storage_error:'Η σύνδεση Google προχώρησε, αλλά δεν αποθηκεύτηκε η συνεδρία στη βάση.',failed:'Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.'};
if(authText[authResult])accountError=authText[authResult];
if(authResult&&authText[authResult]&&state.view==='home')state.view='account';
const uefaStageById=new Map();
const stageLabel=m=>Number.isSafeInteger(m?.stage_id)?uefaStageById.get(m.stage_id)||null:null;
const SITE_FOOTER="<footer class=\"tdm-site-footer\" aria-label=\"Σχετικά και πολιτικές\"><span>© 2026 Tiki-Data · Στατιστικές εκτιμήσεις, όχι στοιχηματικές αποδόσεις</span><nav aria-label=\"Πληροφορίες\"><a href=\"/transparency\">Διαφάνεια</a><a href=\"/about\">Σχετικά</a><a href=\"/privacy\">Απόρρητο</a><a href=\"/terms\">Όροι</a><a href=\"/cookies\">Cookies</a><a href=\"/contact\">Επικοινωνία</a></nav></footer>";

const auditArchive={"match_date":"2026-10-18","timezone":"Asia/Nicosia","selection":"last_record_strictly_before_kickoff","probability_provenance":"legacy_mixed_model_provider","unmatched_keys":4,"raw_records":102,"sources":["/api/history/fixtures?start=2026-10-18&end=2026-10-18&page=1","/api/history/fixtures?start=2026-10-18&end=2026-10-18&page=2"],"matches":[{"log_id":393,"fixture_id":"sportmonks-19713549","home":"Udinese","away":"Lecce","league":"Serie A","league_key":"seriea","kickoff":"2026-10-18T10:30:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.39053521381735296,0.32269775437339193,0.28676703180925467],"home_score":0,"away_score":3,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/26/346.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/14/7790.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/0/384.png"},{"log_id":394,"fixture_id":"sportmonks-19732656","home":"Osasuna","away":"Racing Santander","league":"La Liga","league_key":"laliga","kickoff":"2026-10-18T12:00:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.6907870311733052,0.16930589784147274,0.13990707098522212],"home_score":2,"away_score":0,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/11/459.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/26/9818.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/20/564.png"},{"log_id":391,"fixture_id":"sportmonks-19715583","home":"Angers SCO","away":"Olympique Marseille","league":"Ligue 1","league_key":"ligue1","kickoff":"2026-10-18T13:00:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.318032384780072,0.2793219766035815,0.4026456386163461],"home_score":2,"away_score":5,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/8/776.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/12/44.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/13/301.png"},{"log_id":399,"fixture_id":"sportmonks-19722138","home":"Leeds United","away":"Manchester United","league":"Premier League","league_key":"epl","kickoff":"2026-10-18T13:00:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.44666518180155207,0.2642123999440227,0.28912241825442414],"home_score":1,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/7/71.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/14/14.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/8/8.png"},{"log_id":413,"fixture_id":"sportmonks-19722141","home":"Brighton & Hove Albion","away":"Crystal Palace","league":"Premier League","league_key":"epl","kickoff":"2026-10-18T13:00:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.5503484032965897,0.23779363843094103,0.21185795827246928],"home_score":5,"away_score":0,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/14/78.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/19/51.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/8/8.png"},{"log_id":407,"fixture_id":"sportmonks-19722143","home":"AFC Bournemouth","away":"Sunderland","league":"Premier League","league_key":"epl","kickoff":"2026-10-18T13:00:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.4998531922120009,0.2501465157593458,0.2500002920286523],"home_score":2,"away_score":0,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/20/52.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/3/3.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/8/8.png"},{"log_id":398,"fixture_id":"sportmonks-19713556","home":"Fiorentina","away":"Como","league":"Serie A","league_key":"seriea","kickoff":"2026-10-18T13:00:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.2264606986155119,0.2667444556870485,0.5067948456974398],"home_score":1,"away_score":3,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/13/109.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/12/268.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/0/384.png"},{"log_id":1824,"fixture_id":"sportmonks-19763856","home":"Kalamata","away":"OFI","league":"Super League","league_key":"greece","kickoff":"2026-10-18T13:00:00.000Z","captured_at":"2026-10-18T08:20:11Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.4867545548497133,0.22550964353752256,0.2877358016127641],"home_score":4,"away_score":3,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/31/9919.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/22/118.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/5/325.png"},{"log_id":406,"fixture_id":"sportmonks-19735151","home":"Bayer 04 Leverkusen","away":"SC Freiburg","league":"Bundesliga","league_key":"bundesliga","kickoff":"2026-10-18T13:30:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.6718649826236499,0.18902780944466868,0.1391072079316809],"home_score":2,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/25/3321.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/23/3543.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/18/82.png"},{"log_id":416,"fixture_id":"sportmonks-19763852","home":"Panaitolikos","away":"Olympiacos F.C.","league":"Super League","league_key":"greece","kickoff":"2026-10-18T14:00:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.20210126786436114,0.26802271112932785,0.529876021006311],"home_score":0,"away_score":2,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/21/213.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/26/602.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/5/325.png"},{"log_id":411,"fixture_id":"sportmonks-19732661","home":"Celta de Vigo","away":"Deportivo Alavés","league":"La Liga","league_key":"laliga","kickoff":"2026-10-18T14:15:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.4578284181872728,0.24657768943971803,0.29559389237300865],"home_score":2,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/4/36.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/31/2975.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/20/564.png"},{"log_id":403,"fixture_id":"sportmonks-19763853","home":"Panathinaikos","away":"Asteras Tripolis","league":"Super League","league_key":"greece","kickoff":"2026-10-18T14:30:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.5590142800517731,0.2602090974574298,0.18077662249079715],"home_score":5,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/25/57.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/22/2934.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/5/325.png"},{"log_id":590,"fixture_id":"sportmonks-19777884","home":"Omonia Aradippou","away":"AEL","league":"1. Division","league_key":"cyprus","kickoff":"2026-10-18T15:00:00.000Z","captured_at":"2026-10-18T04:28:19Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.35058384196191866,0.2558231772365373,0.3935929808015433],"home_score":0,"away_score":2,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/26/8122.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/3/611.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/29/253.png"},{"log_id":414,"fixture_id":"sportmonks-19715577","home":"Paris","away":"Rennes","league":"Ligue 1","league_key":"ligue1","kickoff":"2026-10-18T15:15:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.5033643680229097,0.21247675655448856,0.28415887542260226],"home_score":4,"away_score":3,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/28/4508.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/22/598.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/13/301.png"},{"log_id":417,"fixture_id":"sportmonks-19715579","home":"Lorient","away":"Monaco","league":"Ligue 1","league_key":"ligue1","kickoff":"2026-10-18T15:15:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.3792266633559944,0.22682621950131374,0.39394711714269137],"home_score":1,"away_score":0,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/9/9257.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/5/6789.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/13/301.png"},{"log_id":401,"fixture_id":"sportmonks-19715582","home":"Le Havre","away":"Auxerre","league":"Ligue 1","league_key":"ligue1","kickoff":"2026-10-18T15:15:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.3645027856130822,0.2675881496150124,0.3679090647719053],"home_score":1,"away_score":3,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/31/1055.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/2/3682.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/13/301.png"},{"log_id":412,"fixture_id":"sportmonks-19735148","home":"Borussia Mönchengladbach","away":"TSG Hoffenheim","league":"Bundesliga","league_key":"bundesliga","kickoff":"2026-10-18T15:30:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.43520124963853113,0.21265251772956567,0.352146232631903],"home_score":1,"away_score":2,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/11/683.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/6/2726.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/18/82.png"},{"log_id":410,"fixture_id":"sportmonks-19722135","home":"Nottingham Forest","away":"Arsenal","league":"Premier League","league_key":"epl","kickoff":"2026-10-18T15:30:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.2061090892212156,0.30275928520981205,0.4911316255689722],"home_score":0,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/31/63.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/19/19.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/8/8.png"},{"log_id":598,"fixture_id":"sportmonks-19777885","home":"Omonia 29is Maiou","away":"Anorthosis","league":"1. Division","league_key":"cyprus","kickoff":"2026-10-18T16:00:00.000Z","captured_at":"2026-10-18T04:28:19Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.38481851000791023,0.25926713978418,0.3559143502079095],"home_score":1,"away_score":0,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/14/248750.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/16/272.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/29/253.png"},{"log_id":603,"fixture_id":"sportmonks-19777889","home":"Aris Limassol","away":"AEK Larnaca","league":"1. Division","league_key":"cyprus","kickoff":"2026-10-18T16:00:00.000Z","captured_at":"2026-10-18T04:28:19Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.3998005077751663,0.27108005077805486,0.32911944144677874],"home_score":1,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/14/526.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/22/726.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/29/253.png"},{"log_id":409,"fixture_id":"sportmonks-19713553","home":"AC Milan","away":"Atalanta","league":"Serie A","league_key":"seriea","kickoff":"2026-10-18T16:00:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.3825152538145194,0.26938209293209964,0.34810265325338136],"home_score":3,"away_score":2,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/17/113.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/4/708.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/0/384.png"},{"log_id":420,"fixture_id":"sportmonks-19732657","home":"Málaga","away":"Real Sociedad","league":"La Liga","league_key":"laliga","kickoff":"2026-10-18T16:30:00.000Z","captured_at":"2026-10-18T00:00:21Z","model_version":"tiki-historical-ingestion-poisson-v6","probabilities":[0.3440936592627811,0.2649627366064229,0.3909436041307962],"home_score":2,"away_score":5,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/30/126.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/18/594.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/20/564.png"},{"log_id":4913,"fixture_id":"sportmonks-19763855","home":"Kifisia","away":"Aris","league":"Super League","league_key":"greece","kickoff":"2026-10-18T17:00:00.000Z","captured_at":"2026-10-18T14:44:13Z","model_version":"tiki-historical-ingestion-poisson-v7","probabilities":[0.4071770611851973,0.28496122414747094,0.3078617146673313],"home_score":1,"away_score":2,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/7/27943.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/24/9848.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/5/325.png"},{"log_id":5117,"fixture_id":"sportmonks-19763851","home":"PAOK","away":"Iraklis 1908 FC","league":"Super League","league_key":"greece","kickoff":"2026-10-18T18:00:00.000Z","captured_at":"2026-10-18T15:20:25Z","model_version":"tiki-historical-ingestion-poisson-v8","probabilities":[0.6688694699387512,0.21788680451569684,0.11324372554555186],"home_score":2,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/9/649.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/3/7171.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/5/325.png"},{"log_id":5115,"fixture_id":"sportmonks-19715578","home":"Olympique Lyonnais","away":"Nice","league":"Ligue 1","league_key":"ligue1","kickoff":"2026-10-18T18:45:00.000Z","captured_at":"2026-10-18T15:20:25Z","model_version":"tiki-historical-ingestion-poisson-v8","probabilities":[0.658830020721019,0.1935674158016524,0.14760256347732872],"home_score":2,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/15/79.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/2/450.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/13/301.png"},{"log_id":5119,"fixture_id":"sportmonks-19713554","home":"Juventus","away":"Lazio","league":"Serie A","league_key":"seriea","kickoff":"2026-10-18T18:45:00.000Z","captured_at":"2026-10-18T15:20:25Z","model_version":"tiki-historical-ingestion-poisson-v8","probabilities":[0.4726064955164395,0.3040232353251482,0.22337026915841232],"home_score":0,"away_score":3,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/17/625.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/11/43.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/0/384.png"},{"log_id":5144,"fixture_id":"sportmonks-19732655","home":"Real Madrid","away":"Sevilla","league":"La Liga","league_key":"laliga","kickoff":"2026-10-18T19:00:00.000Z","captured_at":"2026-10-18T15:20:26Z","model_version":"tiki-historical-ingestion-poisson-v8","probabilities":[0.7157256562873938,0.16188710070484238,0.1223872430077636],"home_score":4,"away_score":1,"home_logo":"https://cdn.sportmonks.com/images/soccer/teams/12/3468.png","away_logo":"https://cdn.sportmonks.com/images/soccer/teams/4/676.png","league_logo":"https://cdn.sportmonks.com/images/soccer/leagues/20/564.png"}]};
let auditFilter='all',auditLeague='all';
function auditOutcome(m){const p=m.probabilities,top=Math.max(...p),pick=p.indexOf(top),actual=m.home_score>m.away_score?0:m.home_score===m.away_score?1:2;return {pick:['1','Χ','2'][pick],actual:['1','Χ','2'][actual],confidence:top*100,status:p.filter(x=>x===top).length===1?(pick===actual?'hit':'miss'):'pending'}}
const auditLeagueBadge=k=>{const url=auditArchive.matches.find(m=>m.league_key===k)?.league_logo;return url?'<img class="tdm-audit-league-logo" src="'+E(url)+'" loading="lazy" alt="">':''};
function transparency(){
 const all=auditArchive.matches.filter(m=>auditLeague==='all'||m.league_key===auditLeague),hits=all.filter(m=>auditOutcome(m).status==='hit').length,misses=all.filter(m=>auditOutcome(m).status==='miss').length,rows=all.filter(m=>auditFilter==='all'||auditOutcome(m).status===auditFilter);
 const local=x=>new Date(x).toLocaleString(window.__tdLocale==='el'?'el-GR':'en-GB',{timeZone:'Asia/Nicosia',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 return lead('Διαφάνεια','Οι προβλέψεις μας, δίπλα στα πραγματικά αποτελέσματα.')+
 '<section class="tdm-audit-intro"><span class="tdm-audit-date">Έλεγχος αγώνων · 18 Οκτωβρίου 2026</span><h2>Κάθε αποτέλεσμα μετράει.</h2><p>Δημοσιεύουμε όλες τις ασφαλώς αντιστοιχισμένες προβλέψεις του διαθέσιμου αρχείου, μαζί με τις επιτυχίες και τις αστοχίες τους.</p><div class="tdm-audit-actions"><a href="/api/transparency" class="tdm-link">Δεδομένα ελέγχου ↗</a></div></section>'+
 '<div class="tdm-audit-kpis"><div><b>'+all.length+'</b><span>Αγώνες με τελικό σκορ</span></div><div><b class="tdm-audit-green">'+hits+'</b><span>Επιβεβαιώσεις</span></div><div><b class="tdm-audit-red">'+misses+'</b><span>Απορρίψεις</span></div><div><b>'+pct(hits/(hits+misses)*100)+'</b><span>Επιτυχία αρχείου 1Χ2</span></div></div>'+
 '<aside class="tdm-audit-caveat"><b>Τι αφορά το 74,1%</b><p>Αυτό το ποσοστό αφορά το παλιό αρχείο της 18/10, όπου η προέλευση πιθανοτήτων μοντέλου και εξωτερικού παρόχου δεν είχε διαχωριστεί πλήρως. Δεν αποτελεί ανεξάρτητη μέτρηση της σημερινής έκδοσης του μοντέλου ή εγγύηση μελλοντικής επιτυχίας.</p></aside>'+
 '<details class="tdm-panel tdm-audit-method"><summary>Πώς γίνεται ο έλεγχος</summary><ul><li>Μία πρόβλεψη ανά αγώνα: η τελευταία αποθηκευμένη καταγραφή αυστηρά πριν από τη σέντρα.</li><li>Επιλογή 1Χ2: η έκβαση με τη μεγαλύτερη πιθανότητα. Επιβεβαίωση όταν συμφωνεί με το τελικό αποτέλεσμα κανονικής διάρκειας.</li><li>Τελικά σκορ από Sportmonks, με αντιστοίχιση στο ακριβές αναγνωριστικό κάθε αγώνα.</li><li>Το αρχείο περιέχει 102 καταγραφές. Τέσσερα επιπλέον κλειδιά παλιών παρόχων δεν έχουν ασφαλή αντιστοίχιση ομάδων και εξαιρούνται από το ποσοστό. Ενδέχεται να αφορούν ίδιους αγώνες.</li><li>Δημοσιευμένο στιγμιότυπο της 18/10/2026. Δεν ανανεώνεται αυτόματα και δεν αξιολογεί ακριβές σκορ, αποδόσεις ή κερδοφορία.</li><li>Όλες οι ώρες εμφανίζονται σε ώρα Κύπρου.</li></ul></details>'+
 '<div class="tdm-section"><h2>Αναλυτικά αποτελέσματα</h2><span>'+rows.length+' / '+all.length+' αγώνες</span></div><div class="tdm-chips">'+[['all','Όλοι'],['hit','Επιβεβαιώσεις'],['miss','Απορρίψεις']].map(([v,t])=>'<button data-audit-status="'+v+'" aria-pressed="'+(auditFilter===v)+'" class="tdm-chip '+(auditFilter===v?'active':'')+'">'+t+'</button>').join('')+'</div>'+
 '<div class="tdm-chips" aria-label="Φίλτρο διοργάνωσης">'+[['all','Όλες οι λίγκες'],...Array.from(new Map(auditArchive.matches.map(m=>[m.league_key,m.league])).entries())].map(([k,n])=>'<button data-audit-league="'+E(k)+'" aria-pressed="'+(auditLeague===k)+'" class="tdm-chip '+(auditLeague===k?'active':'')+'">'+auditLeagueBadge(k)+E(n)+'</button>').join('')+'</div>'+
 '<div class="tdm-audit-grid">'+rows.map(m=>{const o=auditOutcome(m);return '<article class="tdm-panel tdm-audit-card"><div class="tdm-audit-card-top"><span>'+auditLeagueBadge(m.league_key)+E(m.league)+'</span><time datetime="'+E(m.kickoff)+'">'+E(local(m.kickoff))+'</time></div><div class="tdm-audit-score">'+club(m.home,logoH(m))+'<b>'+m.home_score+' – '+m.away_score+'</b>'+club(m.away,logoA(m))+'</div><div class="tdm-audit-verdict"><span>Πρόβλεψη <b>'+o.pick+'</b> · '+pct(o.confidence)+'</span><span class="tdm-audit-pill '+o.status+'">'+(o.status==='hit'?'✓ Επιβεβαίωση':o.status==='miss'?'× Απόρριψη':'Εκκρεμές')+'</span></div><details class="tdm-audit-proof"><summary>Καταγραφή & πιθανότητες</summary><p>1: '+pct(m.probabilities[0]*100)+' · Χ: '+pct(m.probabilities[1]*100)+' · 2: '+pct(m.probabilities[2]*100)+'</p><p>Καταγράφηκε: '+E(local(m.captured_at))+' · Έκδοση '+E(m.model_version.split('-').at(-1))+'</p><small>'+E(m.fixture_id)+' · Log '+m.log_id+'</small></details></article>'}).join('')+'</div>';
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
const trusted=x=>typeof x==='string'&&/^https:\/\/(cdn\.sportmonks\.com|raw\.githubusercontent\.com|d2ol7oe51mr4n9\.cloudfront\.net)\//.test(x);
const badge=(name,url)=>trusted(url)?'<img src="'+E(url)+'" loading="lazy" alt="'+E(name)+'">':'<span class="tdm-team-avatar">'+E(String(name).slice(0,2).toUpperCase())+'</span>';
const club=(n,l)=>'<div class="tdm-team">'+badge(n,l)+'<strong>'+E(n)+'</strong></div>';
const UEFA_FILTERS=[['ucl','Champions League','UCL'],['uel','Europa League','UEL'],['uecl','Conference League','UECL']];
const source=m=>({team:'Ιστορικό ομάδων',partial_team:'Μερικό ιστορικό',league:'Μέσοι όροι λίγκας',cross_league:'Γενική βάση · χαμηλή βεβαιότητα'})[m.prediction_tier]||(m.prediction_tier==='provider'?'SportMonks · 1X2':'Πειραματική ανάλυση');
const valid123=p=>p&&[p.p1,p.px,p.p2].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100)&&Math.abs(p.p1+p.px+p.p2-100)<1;
const pr=m=>{if(live(m))return [m.live_outlook,m.live_prediction,m.prematch_prediction].find(valid123)||null;if(m.forecast_review?.status==='withheld')return valid123(m.experimental_preview)?m.experimental_preview:null;return valid123(m)?m:null};
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
const leagueBadge=k=>{const url=state.matches.find(m=>m.league_key===k&&trusted(m.league_logo))?.league_logo||({ucl:'https://cdn.sportmonks.com/images/soccer/leagues/2.png',uel:'https://cdn.sportmonks.com/images/soccer/leagues/5.png',uecl:'https://cdn.sportmonks.com/images/soccer/leagues/26/2286.png'})[k];return trusted(url)?'<img class="tdm-tab-league-logo" src="'+E(url)+'" alt="" loading="lazy">':'<svg class="tdm-tab-league-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 12v7m-4 2h8"/></svg>'};
const matchesForFilters=()=>state.matches.filter(m=>(state.view==='live'?live(m):state.mode==='live'?live(m):state.mode==='favorites'?isFav(m.home)||isFav(m.away):true)&&(state.league==='all'||state.league===m.league_key)&&(!state.query||norm(m.home+' '+m.away+' '+m.league).includes(norm(state.query))));
const availableDays=()=>[...new Set(matchesForFilters().map(m=>dayKey(m.date)))].filter(Boolean).sort();
function ensureAvailableDay(){const days=availableDays();if(!days.length){state.day='all';return}if(state.day!=='all'&&days.includes(state.day))return;const today=dayKey(new Date());state.day=days.find(k=>k>=today)||days[days.length-1]}
const dateChips=()=>{const days=availableDays(),today=dayKey(new Date()),tomorrow=dayKey(Date.now()+86400000);return '<div class="tdm-chips tdm-day-chips" aria-label="Φίλτρο ανά ημέρα"><button data-day="all" class="tdm-chip '+(state.day==='all'?'active':'')+'">Όλες</button>'+days.map(k=>'<button data-day="'+k+'" aria-label="'+E(new Date(k+'T12:00:00').toLocaleDateString(window.__tdLocale==='el'?'el-GR':'en-GB',{weekday:'long',day:'numeric',month:'long'}))+'" class="tdm-chip tdm-calendar-chip '+(state.day===k?'active':'')+'">'+calendarBadge(k)+'<span>'+(k===today?'Σήμερα':k===tomorrow?'Αύριο':E(new Date(k+'T12:00:00').toLocaleDateString(window.__tdLocale==='el'?'el-GR':'en-GB',{weekday:'short'})))+'</span></button>').join('')+'</div>'};
/* Live measurements are sourced from Sportmonks, not from the probability model. */
function liveStatsBlock(m,compact=false){
 if(!live(m))return '';
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
const liveMethodNote=m=>live(m)&&m.live_outlook?.source==='recent_form_live_poisson'?
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
 olderEstimateTag(m)+missingUefaEvidence(m)+'<div class="tdm-card-bottom"><b>'+(live(m)?valid123(m.live_outlook)?'LIVE · Πειραματικό 1Χ2':valid123(m.live_prediction)?'LIVE · 1Χ2':valid123(m.prematch_prediction)?'Πριν τη σέντρα · όχι LIVE':'LIVE · Χωρίς πιθανότητες':m.forecast_review?.status==='withheld'?(p?'1Χ2 · Πειραματικό μοντέλο':'1Χ2 · Χωρίς επαρκές δείγμα'):!p?'1Χ2 · Μη διαθέσιμη εκτίμηση':'Πιθανότητες 1Χ2')+'</b><small>Ανάλυση αγώνα ↗</small></div></article>'};
const empty=x=>'<div class="tdm-empty">'+E(x)+'</div>';
function home(){const rank=m=>(isFav(m.home)||isFav(m.away)?5:0)+(accountLeagues.includes(m.league_key)?2:0);const ordered=state.matches.slice().sort((a,b)=>rank(b)-rank(a)||Date.parse(a.date)-Date.parse(b.date));const future=ordered.filter(m=>!live(m));return '<div class="tdm-landing-intro">'+lead('Τα γήπεδα, στην οθόνη σου.','Όλοι οι αγώνες, live ενημερώσεις και ανάλυση Tiki-Data σε μία εμπειρία.')+'</div>'+
'<section class="tdm-hero tdm-landing-hero" aria-label="Tiki-Data football intelligence"><div class="tdm-landing-copy"><span class="tdm-kicker"><i aria-hidden="true"></i>MATCH INTELLIGENCE</span><h2>Δεδομένα που<br>αφηγούνται τον αγώνα.</h2><p>Προγνωστικά 1Χ2, γκολ και live σενάρια με επιβεβαιωμένη προέλευση.</p><div class="tdm-landing-actions"><button class="tdm-accent-btn" data-view="matches">Εξερεύνησε αγώνες ↗</button><a class="tdm-landing-live" href="/predictions?filter=live"><span aria-hidden="true"></span>Live matches ↗</a></div></div><div class="tdm-landing-signature" aria-hidden="true"><span>TIKI-DATA</span><small>FOOTBALL INTELLIGENCE</small></div></section>'+
kpis()+liveUpdateLabel()+'<section class="tdm-uefa-section"><h3>Ευρωπαϊκές διοργανώσεις</h3><div class="tdm-uefa-links">'+UEFA_FILTERS.map(([key,label,short])=>'<a href="/predictions?league='+key+'"><b>'+short+'</b><span>'+label+'</span><span aria-hidden="true">↗</span></a>').join('')+'</div></section>'+title('Στο επίκεντρο','Όλοι','matches')+(ordered[0]?card(ordered[0]):empty('Αναμονή πραγματικών αγώνων'))+
title('Επόμενοι αγώνες','Περισσότερα','matches')+'<div class="tdm-list">'+future.slice(1,5).map(card).join('')+'</div>'}


async function accountLoad(){
 try{
  const r=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});
  const d=await r.json();loginEnabled=!!d.login_enabled;
  if(r.ok&&d.authenticated&&d.user&&d.csrf_token){
   if(authResult==='success')accountError='';
   accountUser=d.user;accountCsrf=d.csrf_token;
   followed=Array.isArray(d.preferences?.teams)?d.preferences.teams.slice(0,40):[];
   accountLeagues=Array.isArray(d.preferences?.leagues)?d.preferences.leagues.slice(0,12):[];
  }else{accountUser=null;accountCsrf='';followed=guestFollowed.slice();accountLeagues=[]}
 }catch{accountUser=null;accountCsrf='';loginEnabled=null;accountError='Δεν φορτώθηκε η κατάσταση σύνδεσης. Ανανέωσε τη σελίδα ή δοκίμασε ξανά.';followed=guestFollowed.slice()}
 render();
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
kpis()+liveUpdateLabel()+title(state.view==='live'?'Αγώνες σε εξέλιξη':'Πρόγραμμα')+(state.view!=='live'?'<div class="tdm-chips">'+[['all','Όλοι'],['favorites','★ Αγαπημένα'],['live','● Live']].map(([x,y])=>'<button data-mode="'+x+'" class="tdm-chip '+(x===state.mode?'active':'')+'">'+y+'</button>').join('')+'</div>':'')+
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
 return '<section class="tdm-panel"><h3>'+t('Σεζόν 2026–27 · εντός / εκτός έδρας','2026–27 season · home / away form')+'</h3><div class="tdm-form-pair">'+panel(f.home,m.home,'home')+panel(f.away,m.away,'away')+'</div><p class="tdm-note">'+t('Επιβεβαιωμένα τελικά αποτελέσματα από όλες τις διαθέσιμες διοργανώσεις, μαζί με τα προκριματικά UEFA. Μόνο αγώνες πριν από το όριο των 3 ημερών. Δεν αποτελούν πιθανότητες 1Χ2. Η κάλυψη εξαρτάται από το Sportmonks.','Verified finished games from all available competitions, including UEFA qualifiers, with a 3-day embargo. These are not 1X2 forecasts; coverage depends on Sportmonks.')+'</p></section>';
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
 return '<button class="tdm-back" data-back>← Πίσω στους αγώνες</button><div class="tdm-scoreboard"><div class="tdm-card-top"><b>'+E(m.league||m.league_key)+'</b><span>'+stamp(m)+'</span></div><div class="tdm-teams">'+club(m.home,logoH(m))+'<div class="tdm-versus">'+E(score(m))+'</div>'+club(m.away,logoA(m))+'</div><div class="tdm-scoreboard-caption">'+(is?'● LIVE':'MATCH INTELLIGENCE')+'</div></div>'+
 olderEstimateTag(m)+'<div class="tdm-tabs">'+[['summary','Ανάλυση'],['lineups','Ενδεκάδες'],['history','Ιστορικό'],['stats','Stats'],['analysis','AI Analysis'],['news','Νέα ομάδων'],['info','Info']].map(([x,y])=>'<button data-tab="'+x+'" class="tdm-tab '+(state.tab===x?'active':'')+'">'+y+'</button>').join('')+'</div>'+content;
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
function render(focus=false){root.classList.toggle('tdm-account-page',state.view==='account');const pos=focus?root.querySelector('[data-search]')?.selectionStart:null;root.innerHTML='<div class="tdm-wrap"><header class="tdm-top"><a href="/" class="tdm-brand"><img src="/brand.svg?v=20261019-transparent" alt="Tiki-Data"></a><div class="tdm-auth-nav" style="position:absolute;right:0;top:50%;transform:translateY(-50%);z-index:100;display:flex;align-items:center;gap:9px"><a href="/?account=1" class="tdm-profile-face" title="Προφίλ / Σύνδεση Google" aria-label="Προφίλ και σύνδεση Google" style="display:flex;justify-content:center;align-items:center;width:46px;height:46px;min-width:46px;border-radius:50%;background:linear-gradient(135deg,#eef3ff,#e3faff);border:2px solid #009ddd;color:#0064ed;box-shadow:0 2px 8px #0064ed22;text-decoration:none">'+ico('account')+'</a></div></header><main>'+
(state.fromCache?'<div class="tdm-cache-note">Αποθηκευμένα δεδομένα'+(state.snapshotAt?' · ενημέρωση '+E(new Date(state.snapshotAt).toLocaleString(window.__tdLocale==='el'?'el-GR':'en-GB',{timeZone:'Asia/Nicosia',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+' ώρα Κύπρου':'')+' · η ανανέωση είναι προσωρινά μη διαθέσιμη</div>':'')+(state.error?'<div class="tdm-empty">'+E(state.error)+' <button data-retry class="tdm-link">Ξανά</button></div>':'')+
(state.view==='transparency'?transparency():state.view==='home'?home():state.view==='teams'?teams():state.view==='account'?accountPanel():state.view==='detail'?details():fixtures())+'</main>'+SITE_FOOTER+'</div><nav class="tdm-bottom">'+[['home','Αρχική'],['matches','Αγώνες'],['live','Live'],['transparency','Διαφάνεια'],['account','Προφίλ']].map(([x,y])=>'<button data-view="'+x+'" '+((state.view===x||(x==='account'&&state.view==='teams'))?'class="active" aria-current="page"':'')+'>'+ico(x)+'<span>'+y+'</span></button>').join('')+'</nav>';
if(window.matchMedia('(min-width:781px)').matches){const nav=root.querySelector('.tdm-bottom'),header=root.querySelector('.tdm-top');if(nav&&header)header.after(nav);}
 if(focus){const i=root.querySelector('[data-search]');if(i){i.focus();try{i.setSelectionRange(pos,pos)}catch{}}}}
function navigate(v){if(v==='transparency'){location.assign('/transparency');return}state.visible=42;state.previous=state.view==='detail'?state.previous:state.view;state.view=v;state.query='';state.league='all';if(v!=='detail')state.id='';render();window.scrollTo(0,0)}
root.addEventListener('click',e=>{const leagueButton=e.target.closest('[data-audit-league]');if(leagueButton){auditLeague=leagueButton.getAttribute('data-audit-league');render();return}const auditButton=e.target.closest('[data-audit-status]');if(auditButton){auditFilter=auditButton.getAttribute('data-audit-status');render();return}const b=e.target.closest('[data-team],[data-view],[data-back],[data-open],[data-mode],[data-league],[data-day],[data-tab],[data-retry],[data-more],[data-auth-league],[data-auth-import],[data-auth-logout],[data-auth-delete]');if(!b)return;const a=n=>b.getAttribute('data-'+n);
if(b.hasAttribute('data-team')){const v=a('team');followed=(isFav(v)?followed.filter(x=>norm(x)!==norm(v)):[...followed,v]).slice(0,40);if(accountUser)accountSave();else{guestFollowed=followed.slice();try{localStorage.setItem(favKey,JSON.stringify(guestFollowed))}catch{}}render();return}if(b.hasAttribute('data-auth-import')){followed=[...new Set([...followed,...guestFollowed])].slice(0,40);accountSave();render();return}if(b.hasAttribute('data-auth-league')){const k=a('auth-league');accountLeagues=accountLeagues.includes(k)?accountLeagues.filter(x=>x!==k):[...accountLeagues,k].slice(0,12);accountSave();render();return}if(b.hasAttribute('data-auth-logout')){void accountAction('logout');return}if(b.hasAttribute('data-auth-delete')){void accountAction('delete');return}
if(b.hasAttribute('data-view'))return navigate(a('view'));if(b.hasAttribute('data-back'))return navigate(state.previous==='detail'?'matches':state.previous);
if(b.hasAttribute('data-open')){state.previous=state.view;state.id=a('open');state.view='detail';state.tab='summary';render();void fetchDeep(state.id);window.scrollTo(0,0);return}
if(b.hasAttribute('data-more')){state.visible+=42;render();return}if(b.hasAttribute('data-mode')){state.mode=a('mode');state.visible=42;ensureAvailableDay();render();return}if(b.hasAttribute('data-league')){state.league=a('league');state.dayAllExplicit=false;state.visible=42;ensureAvailableDay();render();return}if(b.hasAttribute('data-day')){state.day=a('day');state.dayAllExplicit=state.day==='all';state.visible=42;render();return}if(b.hasAttribute('data-tab')){state.tab=a('tab');render();if(!deepCache.has(state.id))void fetchDeep(state.id);return}if(b.hasAttribute('data-retry'))refresh()});
root.addEventListener('change',e=>{if(e.target.matches('[data-pick-day]')){state.day=/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)?e.target.value:'all';render()}});
root.addEventListener('input',e=>{if(e.target.matches('[data-search]')){state.query=e.target.value;render(true)}});root.addEventListener('keydown',e=>{if(e.target.matches('[data-open]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click()}});
/* Show the most recent verified public fixture snapshot immediately on return visits.
 * Cache lifetime is 5 minutes; network refresh runs independently of live events. */
const warmKey='tiki.mobile.fixture.snapshot.v11';
function rememberFixtures(){
 try{
  const fields=['id','home','away','date','league','league_key','status','minute','home_score','away_score','p1','px','p2','logos','home_logo','away_logo','league_logo','statistical_evidence','forecast_review','experimental_preview','history_competitions','historical_sample','european_form','strength','prediction_tier','live_outlook','live_prediction','prematch_prediction','over25','under25','btts','mu_home','mu_away','most_likely_score'];
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
  state.loading=false;state.error='';state.fromCache=!!payload.stale;state.snapshotAt=payload.snapshot_saved_at||payload.updated_at||'';paintMatches();
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
function init(){document.body.appendChild(root);document.documentElement.classList.add('td-mobile-ready');restoreFixtures();baseMatches=state.matches.slice();render();void accountLoad();void refresh();void refreshLive();void loadUefaStages();setInterval(()=>{if(!document.hidden)void refresh()},300000);setInterval(()=>{if(!document.hidden)void refreshLive()},20000)}
window.matchMedia('(min-width:781px)').addEventListener('change',()=>{if(root.isConnected)render()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();