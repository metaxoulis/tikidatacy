import {Header,Footer,MobileNav,Warning,MatchModal} from './components.js?v=9';
import {loadFixtures} from './data.js?v=9';
import {Home,Predictions} from './pages.js?v=9';
document.addEventListener('error',event=>{const image=event.target;if(image instanceof HTMLImageElement&&image.matches('img[data-team-logo],img[data-league-logo]'))image.remove()},true);
const root=document.getElementById('app');
const route=location.pathname.replace(/\/+$/,'')||'/';
const targetRoute=route==='/predictions'?'/predictions':'/';
const qs=new URLSearchParams(location.search);
let isDemo=qs.get('demo')==='1';
let snapshot={matches:[],warnings:[],demo:isDemo};
let status='loading',error='';
let chosenLeague=qs.get('league')||'';
let dateFilter='all',search='',visibleCount=8,selectedId=qs.get('match')||null;

let previousFocus=null;
const matchById=()=>snapshot.matches.find(m=>String(m.id)===String(selectedId));
function updateMatchUrl(id){
 const url=new URL(location.href);if(id)url.searchParams.set('match',id);else url.searchParams.delete('match');
 history.replaceState(null,'',url.pathname+url.search+url.hash);
}
function openMatch(id){
 const match=snapshot.matches.find(m=>String(m.id)===String(id));if(!match)return;
 previousFocus=document.activeElement;selectedId=String(id);updateMatchUrl(selectedId);content();
 document.querySelector('.modal-close')?.focus({preventScroll:true});
}
function closeMatch(){
 if(!selectedId)return;selectedId=null;updateMatchUrl(null);
 document.querySelector('.match-overlay')?.remove();document.body.classList.remove('match-dialog-open');
 if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;
}

function content(){
 const warning=status==='error'?error:snapshot.warnings?.join(' · ').slice(0,450)||'';
 const notice=Warning({message:warning,demo:isDemo});
 const page=targetRoute==='/'?Home({matches:snapshot.matches,featuredId:null}):Predictions({matches:snapshot.matches,chosenLeague,dateFilter,search,visibleCount,selectedId:null});
 root.innerHTML=Header({route:targetRoute})+`<div class="wrap">${notice}${page}</div>`+Footer({isDemo})+MobileNav({route:targetRoute})+MatchModal({match:matchById()});
 document.body.classList.toggle("match-dialog-open",!!document.querySelector(".match-overlay"));
 if(targetRoute==='/predictions'){
   const input=document.getElementById('searchInput');if(input){input.value=search;input.setSelectionRange?.(search.length,search.length)}
 }
 document.title=targetRoute==='/'?'Tiki-Data — Ποδοσφαιρικές Προβλέψεις':'Tiki-Data — Όλοι οι Αγώνες & Προβλέψεις';
}
root.addEventListener('click',e=>{
 if(e.target.closest('[data-close-dialog]')||(e.target.matches('[data-dialog-backdrop]'))){e.preventDefault();closeMatch();return}
 if(e.target.closest('[data-copy-match-link]')){
   navigator.clipboard?.writeText(location.href).then(()=>{const btn=e.target.closest('button');if(btn)btn.textContent='✓ Ο σύνδεσμος αντιγράφηκε';}).catch(()=>{});return;
 }
 const card=e.target.closest('[data-match]');
 if(card){
   if(card.tagName==='A'&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0))return;
   e.preventDefault();openMatch(card.dataset.match);return;
 }
 if(targetRoute!=='/predictions')return;
 const lg=e.target.closest('[data-league]');
 if(lg){chosenLeague=chosenLeague===lg.dataset.league?'':lg.dataset.league;dateFilter='all';visibleCount=8;closeMatch();content();return}
 if(e.target.closest('#clearLeague')){chosenLeague='';dateFilter='all';visibleCount=8;closeMatch();content();return}
 const day=e.target.closest('[data-date]');
 if(day){dateFilter=day.dataset.date;visibleCount=8;selectedId=null;content();return}
 if(e.target.closest('#loadMore')){visibleCount+=8;content();return}
});
root.addEventListener('input',e=>{
 if(e.target?.id!=='searchInput')return;
 search=e.target.value.trim().toLocaleLowerCase('el-GR');visibleCount=8;closeMatch();
 const position=e.target.selectionStart;
 content();
 const input=document.getElementById('searchInput');input?.focus();
 if(typeof position==='number')input?.setSelectionRange(position,position);
});

window.addEventListener('keydown',e=>{
 const dialog=document.querySelector('.match-modal');if(!dialog)return;
 if(e.key==='Escape'){e.preventDefault();closeMatch();return}
 if(e.key==='Tab'){
  const nodes=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(n=>n.getClientRects().length);
  if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
});
window.addEventListener('popstate',()=>{selectedId=new URLSearchParams(location.search).get('match');content()});
content();
loadFixtures({demo:isDemo}).then(result=>{snapshot=result;status='ready';content()}).catch(e=>{
 error='Δεν φορτώθηκαν πραγματικοί αγώνες: '+String(e.message||e);status='error';snapshot={matches:[],warnings:[],demo:false};content();
});
