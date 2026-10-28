(()=>{'use strict';
const $=s=>document.querySelector(s),E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={sm:null,fa:null,smError:false,faError:false,busy:false,detailId:null};
const time=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleTimeString('el-GR',{timeZone:'Asia/Nicosia',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'μη διαθέσιμη';
const country=/^(Greece|Cyprus|England|Spain|Germany|Italy|France)$/i;
function inPlay(m,fa){return fa?['IN PLAY','HALF TIME BREAK','EXTRA TIME','PENALTY SHOOTOUT'].includes(m.status):['LIVE','1ST','2ND','HT','ET','BREAK','PEN_LIVE','INPLAY'].includes(m.status)}
function chosen(m,fa){
 if($('#status').value==='live'&&!inPlay(m,fa))return false;
 if($('#scope').value==='selected'&&fa&&!country.test(m.country)&&!/^((UEFA )?(Champions|Europa|Conference|Europa Conference) League)$/i.test(m.league||''))return false;
 const query=$('#search').value.trim().toLocaleLowerCase();return !query||(m.home+' '+m.away+' '+m.league).toLocaleLowerCase().includes(query);
}
function card(m,fa){
 const score=Number.isInteger(m.home_score)&&Number.isInteger(m.away_score)?m.home_score+' : '+m.away_score:'—';
 const live=inPlay(m,fa),minute=fa?m.minute:Number.isInteger(m.minute)?m.minute+'′':m.status;
 const controls=fa?'<div class="actions"><button data-match="'+E(m.match_id)+'">Γεγονότα & ενδεκάδες →</button></div>':'';
 return '<article class="match"><div class="meta"><span>'+E([m.country,m.league].filter(Boolean).join(' · '))+'</span><span class="state'+(live?'':' finished')+'">'+E(live?'● '+minute:m.status)+'</span></div><div class="teams"><strong>'+E(m.home)+'</strong><span class="score">'+E(score)+'</span><strong>'+E(m.away)+'</strong></div>'+
  (fa?'<p class="muted">Τελευταία αλλαγή παρόχου: '+E(time(m.provider_updated_at))+'</p>':'')+(m.source_stale?'<p class="old">Ο πάροχος δεν έχει δηλώσει πρόσφατη αλλαγή για αυτόν τον αγώνα.</p>':'')+controls+'</article>';
}
function render(){
 for(const [key,fa] of [['sm',false],['fa',true]]){
  const feed=state[key],error=state[key+'Error'],matches=(feed?.matches||[]).filter(m=>chosen(m,fa));
  $('#'+key+'-time').textContent='Έλεγχος πηγής: '+time(feed?.updated_at)+(feed?.stale?' · παλαιότερη αποθηκευμένη απάντηση':'')+(error?' · η τελευταία ανανέωση απέτυχε':'');
  $('#'+key+'-list').innerHTML=(feed?.error?'<p class="old">Η πηγή δεν ανανεώθηκε ('+E(feed.error)+').</p>':'')+(matches.length?matches.map(m=>card(m,fa)).join(''):'<p class="empty">'+(error&&!feed?'Προσωρινά μη διαθέσιμη πηγή.':'Δεν υπάρχουν αγώνες με αυτά τα φίλτρα στην απάντηση της πηγής.')+'</p>');
 }
 const u=state.fa?.usage;$('#usage').textContent=u?'Δοκιμή Football-API: '+u.used.toLocaleString('el-GR')+' / '+u.trial_limit.toLocaleString('el-GR')+' κλήσεις σήμερα (ημέρα UTC). Όριο προγράμματος: '+u.plan_limit.toLocaleString('el-GR')+'.':'Αναμονή σύνδεσης Football-API…';
}
async function load(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok&&!Array.isArray(data.matches))throw Error('unavailable');return data}
async function refresh(){
 if(state.busy)return;state.busy=true;
 await Promise.allSettled([['sm','/api/live'],['fa','/api/football-trial/live']].map(async([key,url])=>{try{const d=await load(url);state[key]=d;state[key+'Error']=false}catch{state[key+'Error']=true}render()}));state.busy=false;
}
async function details(id){
 if(!/^\d{1,14}$/.test(id))return;
 state.detailId=id;$('#detail-body').innerHTML='<p class="empty">Φόρτωση στοιχείων Football-API…</p>';if(!$('#detail').open)$('#detail').showModal();
 try{const d=await load('/api/football-trial/match/'+id);if(state.detailId!==id)return;
  const match=d.match||{},events=d.events||[],lineups=d.lineups||{};
  const line=(side)=>{const l=lineups[side]||{};return '<section><h3>'+E(l.team||match[side])+'</h3>'+(l.players?.length?l.players.map(p=>'<p>'+E(p.number)+' · '+E(p.name)+(p.substitute?' <small>αναπληρωματικός</small>':'')+'</p>').join(''):'<p class="muted">Δεν έχουν δοθεί παίκτες.</p>')+'</section>'};
  $('#detail-body').innerHTML='<p class="muted">FOOTBALL-API.COM · ΔΟΚΙΜΗ ΠΗΓΗΣ</p><h2>'+E(match.home)+' — '+E(match.away)+'</h2><p class="notice">Χωρίς πρόσβαση σε κατοχή, σουτ ή επιθέσεις. Τα γεγονότα δεν αποτελούν πλήρη στατιστικά αγώνα.</p>'+
   (d.errors?.length?'<p class="old">Ορισμένα στοιχεία δεν ανανεώθηκαν: '+E(d.errors.join(', '))+'</p>':'')+
   '<h3>Γεγονότα</h3><p class="muted">Έλεγχος: '+E(time(d.events_updated_at))+(d.events_stale?' · αποθηκευμένη απάντηση':'')+'</p>'+
   (events.length?events.map(e=>'<div class="event"><b>'+E(e.minute)+'′</b><span>'+E(e.label||e.type)+' · '+E(e.player)+(e.related_player?' / '+E(e.related_player):'')+'<small> · '+E(e.side?match[e.side]:'')+'</small></span></div>').join(''):'<p class="empty">Δεν έχουν επιστραφεί γεγονότα.</p>')+
   '<h3>Ενδεκάδες & πάγκος</h3>'+(d.lineups_stale?'<p class="old">Αναμονή νεότερης ενημέρωσης ενδεκάδων.</p>':'')+'<div class="lineups">'+line('home')+line('away')+'</div>';
 }catch{if(state.detailId===id)$('#detail-body').innerHTML='<p class="empty">Δεν ήταν διαθέσιμα τα στοιχεία αυτού του αγώνα.</p>'}
}
$('#scope').addEventListener('change',render);$('#status').addEventListener('change',render);$('#search').addEventListener('input',render);
document.addEventListener('click',e=>{const b=e.target.closest('[data-match]');if(b)void details(b.dataset.match)});
$('#close').addEventListener('click',()=>{$('#detail').close();state.detailId=null});$('#detail').addEventListener('close',()=>{state.detailId=null});
void refresh();setInterval(()=>{if(!document.hidden)void refresh()},30000);
})();
