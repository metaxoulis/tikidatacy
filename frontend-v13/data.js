/* Tiki-Data public Match Centre — view-layer only, no provider credentials. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
if(!$('dataGames'))return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=new Intl.DateTimeFormat('el-GR',{weekday:'short',day:'numeric',month:'short'});
const fmtTime=new Intl.DateTimeFormat('el-GR',{hour:'2-digit',minute:'2-digit',hour12:false});
const dateValue=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=dateValue(new Date());
const shift=(value,n)=>{const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+n);return dateValue(d);};
const maybeNum=n=>typeof n==='number'&&Number.isFinite(n)?new Intl.NumberFormat('el-GR',{maximumFractionDigits:1}).format(n):'—';
const number=n=>typeof n==='number'&&Number.isFinite(n)?n:null;
const txt=(s,max=160)=>String(s??'').slice(0,max);
const signedTeamLogo=u=>typeof u==='string'&&/^\/api\/logo\/team\/\d{1,13}\?sig=[0-9a-f]{64}$/.test(u)?u:null;
function verifiedLeagueLogo(name){const t=String(name||'').toLowerCase();const l=window.TIKI_LOGO_CATALOG?.leagues||{};const key=/(?:premier league|english premier)/i.test(t)?'epl':/bundesliga/i.test(t)?'bundesliga':/(?:la liga|laliga|primera divisi)/i.test(t)?'laliga':/serie a/i.test(t)?'seriea':/(?:ligue 1|ligue1)/i.test(t)?'ligue1':/(?:super league.*gree|greek super|greece.*super)/i.test(t)?'greece':null;return key?l[key]||null:null;}
const nameKey=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
const knownTeamLogo=new Map(Object.entries(window.TIKI_LOGO_CATALOG?.teams||{}).map(([k,v])=>[nameKey(k),v]));
function safeCatalogURL(u){return typeof u==='string'&&/^https:\/\/(?:raw\.githubusercontent\.com|media\.api-sports\.io)\//.test(u)?u:null;}
function decorateLogo(parent,url,cls){if(!url)return;const img=document.createElement('img');img.className=cls;img.src=url;img.loading='lazy';img.decoding='async';img.alt='';img.onerror=()=>img.remove();parent.append(img);}
const asDirectLogo=u=>typeof u==='string'&&/^https:\/\/(?:apiv2\.)?allsportsapi\.com\/logo\/[a-zA-Z0-9_./%-]{1,180}\.(?:png|jpe?g|webp)$/i.test(u)?u:null;
const monogram=s=>String(s||'').replace(/\b(?:fc|cf|afc|sc|ac|club)\b/gi,'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').slice(0,3).toUpperCase()||'FC';
const statusFinished=s=>['FT','FULL_TIME','FINISHED','AET','PEN','PENALTY_SHOOTOUT'].includes(String(s||'').toUpperCase());
const statusLive=s=>['LIVE','1H','2H','HT','ET','P','BREAK','INT'].includes(String(s||'').toUpperCase());
const readableStatus=s=>({NS:'Αναμονή',SCHEDULED:'Προγραμματισμένο',FT:'Τελικό',AET:'Παράταση',PEN:'Πέναλτι',HT:'Ημίχρονο',LIVE:'Live','1H':'1ο ημίχρονο','2H':'2ο ημίχρονο'}[s]||s||'Προγραμματισμένο');
const statNames={shots:'Σουτ',shots_on_target:'Σουτ στην εστία',shots_off_target:'Σουτ εκτός',fouls:'Φάουλ',total_passes:'Πάσες',pass_accuracy:'Ακρίβεια πάσας %',tackles:'Τάκλιν',tackle_success:'Επιτυχημένα τάκλιν %',saves:'Αποκρούσεις',yellow_cards:'Κίτρινες',red_cards:'Κόκκινες',possession:'Κατοχή %',corners:'Κόρνερ',offsides:'Οφσάιντ'};
const state={provider:new URLSearchParams(location.search).get('source')==='allsports'?'allsports':'sportapi',activeSource:'SportAPI.ai',date:today,all:[],league:'all',status:'all',query:'',loading:false,current:null,active:'',controller:null,previousFocus:null,sequence:0};
function setStatus(text,error=false){const n=$('dataStatus');n.textContent=text;n.classList.toggle('error',error);}
function empty(text){return '<div class="td-empty">'+esc(text)+'</div>';}
function message(text){return '<div class="td-msg">'+esc(text)+'</div>';}
function errorMessage(err){return err?.message==='quota_exceeded'?'Έχει εξαντληθεί προσωρινά το ημερήσιο όριο του παρόχου. Δοκιμάστε αργότερα.':err?.message==='provider_not_configured'?'Η επιλεγμένη πηγή δεν έχει ακόμη ρυθμιστεί. Χρειάζεται κρυπτογραφημένο Cloudflare Secret.':err?.message==='date_out_of_range'?'Η ημερομηνία είναι εκτός του διαθέσιμου εύρους.': 'Τα δεδομένα δεν είναι διαθέσιμα αυτή τη στιγμή. Δοκιμάστε ξανά.';}
async function requestData(path,params,signal){
 const url=new URL('/api/sport/'+path,location.origin);
 Object.entries(params).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=='')url.searchParams.set(k,String(v));});
 const r=await fetch(url,{headers:{Accept:'application/json'},signal});
 let j;try{j=await r.json()}catch{throw Error('bad_response')}
 if(!r.ok)throw Error(j?.error||'provider_unavailable');
 return j;
}
async function requestAllSports(date){
 const u=new URL('/api/allsports/fixtures',location.origin);u.searchParams.set('date',date);
 const r=await fetch(u,{headers:{Accept:'application/json'}});
 let data;try{data=await r.json()}catch{throw Error('bad_response')}
 if(!r.ok)throw Error(data?.error||'provider_unavailable');
 return data;
}
async function updateSourceOptions(){
 try{const r=await fetch('/api/allsports/status');if(!r.ok)return;const s=await r.json();const opt=$('providerSelect')?.querySelector('[value="allsports"]');if(!opt)return;
 if(!s.configured){opt.textContent='AllSportsAPI · σύνδεση εκκρεμεί';opt.disabled=true;if(state.provider==='allsports'){state.provider='sportapi';$('providerSelect').value='sportapi';void loadFixtures();}}
 else{opt.textContent='AllSportsAPI';opt.disabled=false;}
 }catch{/* status is auxiliary; preserve primary feed */}
}
function setRange(){
 $('dayPicker').value=state.date;
 $('dayPicker').min=shift(today,-15);$('dayPicker').max=shift(today,15);
 $('dayPrev').disabled=state.date<=$('dayPicker').min;$('dayNext').disabled=state.date>=$('dayPicker').max;
}
function statusKind(row){return statusFinished(row.status)?'finished':statusLive(row.status)?'live':'upcoming';}
function applyFilters(){
 const leagues=new Set(state.all.map(x=>x.league).filter(Boolean));
 const sel=$('leagueFilter'),selected=state.league;
 sel.replaceChildren();const add=(value,label)=>{const opt=document.createElement('option');opt.value=value;opt.textContent=label;sel.append(opt);};
 add('all','Όλες οι διοργανώσεις');[...leagues].sort((a,b)=>a.localeCompare(b,'el')).forEach(v=>add(v,v));
 if(!leagues.has(selected))state.league='all';sel.value=state.league;
 renderGames();
}
function renderGames(){
 const list=state.all.filter(x=>(state.league==='all'||x.league===state.league)
  &&(state.status==='all'||statusKind(x)===state.status)
  &&(!state.query||(x.home+' '+x.away+' '+x.league).toLocaleLowerCase('el').includes(state.query)));
 const frag=document.createDocumentFragment(),groups=new Map();
 for(const m of list){if(!groups.has(m.league))groups.set(m.league,[]);groups.get(m.league).push(m);}
 for(const [league,rows] of groups){
  const heading=document.createElement('div');heading.className='td-league-heading';
  const title=document.createElement('span');title.textContent=league;const mark=asDirectLogo(rows.find(x=>x.league_logo)?.league_logo)||safeCatalogURL(verifiedLeagueLogo(league));if(mark)decorateLogo(heading,mark,'td-league-crest');heading.append(title);
  const count=document.createElement('span');count.className='td-league-count';count.textContent=rows.length+' αγώνες';heading.append(count);
  const withStandings=rows.find(x=>x.league_id&&x.league_token);
  if(withStandings&&state.provider==='sportapi'){const btn=document.createElement('button');btn.type='button';btn.textContent='Βαθμολογία / Σκόρερ →';btn.addEventListener('click',()=>openDetail('league',withStandings));heading.append(btn);}
  frag.append(heading);
  for(const m of rows){
   const game=document.createElement('article');game.className='td-game';const d=new Date(m.date),hasDate=Number.isFinite(d.getTime());
   const when=document.createElement('div');when.className='td-game-time';when.textContent=hasDate?fmtTime.format(d):'—';
   const small=document.createElement('small');small.textContent=m.stage||readableStatus(m.status);when.append(small);
   const teams=document.createElement('div');teams.className='td-teams';
   for(const side of ['home','away']){const team=document.createElement('div');team.className='td-team';const icon=document.createElement('span');icon.className='td-monogram';icon.textContent=monogram(m[side]);decorateLogo(icon,safeCatalogURL(knownTeamLogo.get(nameKey(m[side]))),'td-team-logo');decorateLogo(icon,signedTeamLogo(m.logos?.[side])||asDirectLogo(m.logos?.[side]),'td-team-logo');const name=document.createElement('span');name.textContent=m[side];team.append(icon,name);teams.append(team);}
   const score=document.createElement('div');score.className='td-score';
   const hasScores=number(m.home_score)!==null&&number(m.away_score)!==null;
   score.textContent=hasScores?m.home_score+' : '+m.away_score:'— : —';
   const s=document.createElement('small');s.textContent=statusLive(m.status)&&number(m.minute)!==null?readableStatus(m.status)+' · '+m.minute+"'":readableStatus(m.status);if(statusLive(m.status))s.className='td-live';score.append(s);
   const action=document.createElement('div');action.className='td-game-actions';if(state.provider==='sportapi'){const b=document.createElement('button');b.type='button';b.textContent='Στοιχεία →';b.setAttribute('aria-label','Στοιχεία '+m.home+' εναντίον '+m.away);b.addEventListener('click',()=>openDetail('match',m));action.append(b);}else{const tag=document.createElement('span');tag.className='td-source-label';tag.textContent='AllSportsAPI';action.append(tag);}
   game.append(when,teams,score,action);frag.append(game);
  }
 }
 const container=$('dataGames');container.replaceChildren(frag);
 if(!list.length)container.innerHTML=empty(state.all.length?'Δεν βρέθηκαν αγώνες με αυτά τα φίλτρα.':'Δεν υπάρχουν καταχωρισμένοι αγώνες για την επιλεγμένη ημέρα.');
 container.setAttribute('aria-busy','false');
 setStatus(list.length+' αγώνες στην προβολή · '+fmtDate.format(new Date(state.date+'T12:00:00'))+' · '+state.activeSource);
}
async function loadFixtures(){
 const sequence=++state.sequence;state.all=[];state.league='all';setRange();state.loading=true;
 $('dataGames').setAttribute('aria-busy','true');$('dataGames').innerHTML='<div class="td-skeleton"></div><div class="td-skeleton"></div><div class="td-skeleton"></div>';
 for(const id of ['totalGames','totalLeagues','totalFinished','totalLive'])$(id).textContent='—';
 setStatus('Ανάκτηση αγώνων από το '+(state.provider==='allsports'?'AllSportsAPI':'SportAPI.ai')+'…');
 try{
  const data=state.provider==='allsports'?await requestAllSports(state.date):await requestData('fixtures',{date:state.date});
  if(sequence!==state.sequence)return;
  state.all=Array.isArray(data?.data?.fixtures)?data.data.fixtures:[];
  state.activeSource=data.source|| (state.provider==='allsports'?'AllSportsAPI':'SportAPI.ai');$('activeProvider').textContent=state.activeSource;
  $('totalGames').textContent=state.all.length;
  $('totalLeagues').textContent=new Set(state.all.map(x=>x.league)).size;
  $('totalFinished').textContent=state.all.filter(x=>statusKind(x)==='finished').length;
  $('totalLive').textContent=state.all.filter(x=>statusKind(x)==='live').length;
  applyFilters();
 }catch(e){if(sequence!==state.sequence)return;$('dataGames').innerHTML=empty(errorMessage(e));setStatus(errorMessage(e),true);$('dataGames').setAttribute('aria-busy','false');}
 finally{if(sequence===state.sequence)state.loading=false;}
}
function closeDetail(){const dialog=$('dataDialog');if(dialog.hidden)return;dialog.hidden=true;document.body.style.overflow='';if(state.controller)state.controller.abort();state.current=null;state.previousFocus?.focus?.();}
function openDetail(kind,record){
 state.previousFocus=document.activeElement;
 state.current={kind,record};state.active='';
 const tabs=kind==='match'?[['overview','Πληροφορίες'],['stats','Στατιστικά'],['events','Γεγονότα'],['lineups','Ενδεκάδες'],['h2h','Προϊστορία'],['home','Γηπεδούχος'],['away','Φιλοξενούμενος']]:
  kind==='league'?[['standings','Βαθμολογία'],['scorers','Σκόρερ'],['assists','Ασίστ'],['cards','Κάρτες']]:
  [['profile','Ομάδα'],['squad','Ρόστερ'],['trophies','Τίτλοι']];
 const header=$('detailHeader');header.replaceChildren();const top=document.createElement('div');top.className='td-detail-head';
 if(kind==='match'){
   top.innerHTML='<p class="td-overline">MATCH DETAILS · SPORTAPI.AI</p><div class="td-match-title"><strong></strong><b></b><strong></strong></div><p></p>';
   top.querySelectorAll('strong')[0].textContent=record.home;top.querySelectorAll('strong')[1].textContent=record.away;
   top.querySelector('b').textContent=number(record.home_score)!==null&&number(record.away_score)!==null?record.home_score+' : '+record.away_score:'vs';
   top.querySelector('p:last-child').textContent=record.league+' · '+readableStatus(record.status)+' · '+(record.date?new Date(record.date).toLocaleString('el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'');
 }else{top.innerHTML='<p class="td-overline">SPORTAPI.AI / '+(kind==='league'?'COMPETITION':'CLUB')+'</p><div class="td-match-title"><strong></strong></div>';top.querySelector('strong').textContent=kind==='league'?record.league:record.name;}
 header.append(top);
 const tabRoot=$('detailTabs');tabRoot.replaceChildren();
 for(const [id,label] of tabs){const btn=document.createElement('button');btn.type='button';btn.role='tab';btn.textContent=label;btn.dataset.tab=id;btn.setAttribute('aria-selected','false');btn.addEventListener('click',()=>showTab(id));tabRoot.append(btn);}
 $('dataDialog').hidden=false;document.body.style.overflow='hidden';$('dataDialog').querySelector('.td-dialog').focus();
 void showTab(tabs[0][0]);
}
async function showTab(tab){
 if(!state.current)return;const {kind,record}=state.current;state.active=tab;for(const btn of $('detailTabs').querySelectorAll('button'))btn.setAttribute('aria-selected',btn.dataset.tab===tab?'true':'false');
 const body=$('detailBody');body.innerHTML=message('Φόρτωση επιπλέον πληροφοριών…');
 if(state.controller)state.controller.abort();const ctrl=new AbortController();state.controller=ctrl;
 let path=kind,section=tab,id=null,token=null,params={date:state.date};
 if(kind==='match'&&(tab==='home'||tab==='away')){path='team';section='profile';id=tab==='home'?record.home_id:record.away_id;token=tab==='home'?record.home_token:record.away_token;}
 else if(kind==='match'){id=record.id;token=record.token;params.home=record.home_id;params.away=record.away_id;}
 else if(kind==='league'){id=record.league_id;token=record.league_token;}
 else{id=record.id;token=record.token;}
 if(!id||!token){body.innerHTML=message('Ο πάροχος δεν παρέχει αναγνωριστικό για αυτή την ενότητα.');return;}
 try{
  const result=await requestData(path,{...params,id,token,section},ctrl.signal);
  if(ctrl.signal.aborted||!state.current||state.active!==tab)return;
  renderSection(result,section,kind,record);
 }catch(err){if(!ctrl.signal.aborted)body.innerHTML=message(errorMessage(err));}
}
function panel(title,children){return '<section class="td-panel"><h3>'+esc(title)+'</h3>'+children+'</section>';}
function row(label,value){return '<div class="td-row"><span>'+esc(label)+'</span><strong>'+esc(value??'—')+'</strong></div>';}
function prettyEvents(data){return !data?.length?message('Δεν υπάρχουν διαθέσιμα γεγονότα για αυτόν τον αγώνα.'):panel('Γεγονότα αγώνα',data.map(x=>'<div class="td-person"><span class="td-pill">'+esc(x.minute||'—')+"'"+'</span><span><strong>'+esc(x.player||x.team||'Γεγονός')+'</strong> '+esc(x.type)+(x.detail?' · '+esc(x.detail):'')+'</span><small>'+esc(x.side==='home'?'Εντός':x.side==='away'?'Εκτός':x.team)+'</small></div>').join(''));}
function prettyStats(data){if(!data||(!data.home&&!data.away))return message('Δεν διατίθενται αναλυτικά στατιστικά για αυτόν τον αγώνα.');return panel('Στατιστικά ομάδων',Object.entries(statNames).filter(([k])=>number(data.home?.[k])!==null||number(data.away?.[k])!==null).map(([k,v])=>{const h=number(data.home?.[k]),a=number(data.away?.[k]);const pct=h!==null&&a!==null&&h+a>0?Math.round(100*h/(h+a)):50;return '<div class="td-compare"><b>'+esc(maybeNum(h))+'</b><span>'+esc(v)+'</span><b>'+esc(maybeNum(a))+'</b><div class="td-bar"><i style="width:'+pct+'%"></i></div></div>';}).join(''));}
function prettyLineup(data,record){if(!data)return message('Δεν υπάρχουν επιβεβαιωμένες ενδεκάδες.');return ['home','away'].map(side=>{const team=data[side];if(!team)return'';const list=xs=>xs?.length?xs.map(x=>'<div class="td-person"><span class="td-pill">'+esc(x.shirt??'—')+'</span><strong>'+esc(x.name)+'</strong><small>'+esc(x.position)+(x.captain?' · Αρχηγός':'')+'</small></div>').join(''):'<p class="td-msg">Χωρίς δεδομένα</p>';return panel(record[side]+' · Βασική ενδεκάδα',list(team.starters))+panel(record[side]+' · Αναπληρωματικοί',list(team.subs));}).join('')||message('Δεν υπάρχουν ενδεκάδες.');}
function prettyMatches(matches){return matches?.length?matches.map(x=>row((x.date||'')+' · '+(x.home||'')+' – '+(x.away||''),(x.home_score??'—')+' : '+(x.away_score??'—'))).join(''):message('Δεν υπάρχουν διαθέσιμοι προηγούμενοι αγώνες.');}
function prettyH2H(data){if(!data)return message('Δεν υπάρχει διαθέσιμη προϊστορία.');const h=data.summary;return (h?panel('Σύνοψη αναμετρήσεων',row('Αγώνες',maybeNum(h.total))+row('Νίκες γηπεδούχου',maybeNum(h.home_wins))+row('Ισοπαλίες',maybeNum(h.draws))+row('Νίκες φιλοξενούμενου',maybeNum(h.away_wins))):'')+panel('Προηγούμενοι αγώνες',prettyMatches(data.matches));}
function prettyStandings(data){if(!data?.length)return message('Δεν υπάρχει βαθμολογία για αυτή τη διοργάνωση.');const heads=['#','Ομάδα','Αγ.','Ν','Ι','Η','Βαθ.'];const body=data.map(x=>'<tr><td>'+esc(x.position??'—')+'</td><td>'+esc(x.team)+'</td><td>'+esc(x.played??'—')+'</td><td>'+esc(x.won??'—')+'</td><td>'+esc(x.drawn??'—')+'</td><td>'+esc(x.lost??'—')+'</td><td><b>'+esc(x.points??'—')+'</b></td></tr>').join('');return panel('Βαθμολογία', '<div class="td-standings"><table><thead><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>');}
function prettyLeaders(data,section){if(!data?.length)return message('Δεν υπάρχουν διαθέσιμα στοιχεία για αυτή τη διοργάνωση.');const stat={scorers:'goals',assists:'assists',cards:'yellow_cards'}[section];return panel({scorers:'Πρώτοι σκόρερ',assists:'Πρώτοι σε ασίστ',cards:'Κάρτες'}[section],data.map(x=>'<div class="td-person"><span class="td-pill">'+esc(x.rank??'—')+'</span><strong>'+esc(x.name)+'</strong><small>'+esc(x.team)+' · '+esc(maybeNum(x[stat]))+(section==='cards'?' κίτρινες':'')+'</small></div>').join(''));}
function prettyTeam(data,section){if(section==='profile')return data?panel('Πληροφορίες ομάδας',row('Ομάδα',data.name)+row('Χώρα',data.country)+row('Προπονητής',data.coach)+row('Γήπεδο',data.stadium))+panel('Πρόσφατοι αγώνες',prettyMatches(data.recent_matches)):message('Δεν υπάρχουν διαθέσιμα στοιχεία ομάδας.');if(section==='squad')return data?.length?panel('Ρόστερ',data.map(x=>'<div class="td-person"><span class="td-pill">'+esc(x.number??'—')+'</span><strong>'+esc(x.name)+'</strong><small>'+esc(x.position)+' · '+esc(x.nationality)+'</small></div>').join('')):message('Δεν υπάρχουν διαθέσιμα στοιχεία ρόστερ.');if(section==='trophies')return data?.length?panel('Τίτλοι',data.map(x=>row(x.competition,(x.year||'—')+' · '+x.position)).join('')):message('Δεν υπάρχουν διαθέσιμα στοιχεία τίτλων.');return message('Μη διαθέσιμα δεδομένα.');}
function renderSection(result,section,kind,record){
 const data=result.data,available=result.available;let html='';
 if(!available){$('detailBody').innerHTML=message('Ο πάροχος δεν διαθέτει δεδομένα για αυτή την ενότητα.');return;}
 if(kind==='league')html=section==='standings'?prettyStandings(data):prettyLeaders(data,section);
 else if(kind==='team'||(kind==='match'&&(state.active==='home'||state.active==='away')))html=prettyTeam(data,section);
 else if(section==='stats')html=prettyStats(data);
 else if(section==='lineups')html=prettyLineup(data,record);
 else if(section==='events')html=prettyEvents(data);
 else if(section==='h2h')html=prettyH2H(data);
 else if(section==='overview')html=panel('Αγώνας',row('Διοργάνωση',record.league)+row('Κατάσταση',readableStatus(record.status))+row('Γύρος',record.stage)+row('Γήπεδο',data?.venue||'—')+row('Διαιτητής',data?.referee||'—'))+(data?.events?.length?prettyEvents(data.events):'');
 $('detailBody').innerHTML=html||message('Δεν υπάρχουν διαθέσιμες πληροφορίες.');
 if(kind==='match'&&(state.active==='home'||state.active==='away')){
  const side=state.active,id=record[side+'_id'],token=record[side+'_token'];
  if(id&&token){const wrap=document.createElement('div');wrap.className='td-detail-buttons';const go=document.createElement('button');go.type='button';go.textContent='Δείτε ρόστερ και τίτλους της ομάδας →';go.addEventListener('click',()=>openDetail('team',{id,token,name:record[side]}));wrap.append(go);$('detailBody').append(wrap);}
 }
}
$('providerSelect').value=state.provider;
$('providerSelect').addEventListener('change',e=>{state.provider=e.target.value==='allsports'?'allsports':'sportapi';void loadFixtures();});
void updateSourceOptions();
$('dayPrev').addEventListener('click',()=>{state.date=shift(state.date,-1);void loadFixtures();});
$('dayNext').addEventListener('click',()=>{state.date=shift(state.date,1);void loadFixtures();});
$('dayToday').addEventListener('click',()=>{state.date=today;void loadFixtures();});
$('dayPicker').addEventListener('change',e=>{if(e.target.value){state.date=e.target.value;void loadFixtures();}});
$('dataSearch').addEventListener('input',e=>{state.query=e.target.value.trim().toLocaleLowerCase('el');renderGames();});
$('leagueFilter').addEventListener('change',e=>{state.league=e.target.value;renderGames();});
$('statusFilter').addEventListener('change',e=>{state.status=e.target.value;renderGames();});
$('detailClose').addEventListener('click',closeDetail);
$('dataDialog').addEventListener('click',e=>{if(e.target.matches('[data-close]'))closeDetail();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('dataDialog').hidden)closeDetail();});
setRange();void loadFixtures();
})();
