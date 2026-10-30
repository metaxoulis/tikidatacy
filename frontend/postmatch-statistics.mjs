import {faTrialCached,faTrialMatch,faTrialStatistics} from './football-trial.mjs';

// Deliberately limited pilot. Match IDs are not fixture IDs.
export const POSTMATCH_PILOT=[
 {id:743353,home:'Everton',away:'Newcastle United',competition:150,team:20,awayTeam:9,league:'EFL Cup',day:'2026-10-29'},
 {id:743354,home:'Fiorentina',away:'Atalanta',competition:4,team:88,awayTeam:91,league:'Serie A',day:'2026-10-29'},
 {id:743356,home:'AE Prat',away:'Athletic Bilbao',competition:334,team:4910,awayTeam:24,league:'Copa del Rey',day:'2026-10-29'}
];
const POSTMATCH_LABELS={possesion:'Κατοχή',attempts_on_goal:'Σουτ',shots_on_target:'Σουτ στην εστία',shots_off_target:'Σουτ εκτός εστίας',shots_blocked:'Μπλοκαρισμένα σουτ',expected_goals:'xG παρόχου',corners:'Κόρνερ',fauls:'Φάουλ',offsides:'Οφσάιντ',saves:'Αποκρούσεις',yellow_cards:'Κίτρινες κάρτες',red_cards:'Κόκκινες κάρτες',penalties:'Πέναλτι',throw_ins:'Πλάγια άουτ',attacks:'Επιθέσεις',dangerous_attacks:'Επικίνδυνες επιθέσεις'};
const pmJson=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function postmatchHistory(data,pilot){
 if(!Array.isArray(data?.match))throw Error('provider_invalid_response');
 const raw=data.match.find(m=>Number(m.id)===pilot.id&&m.status==='FINISHED'&&m.date===pilot.day&&Number(m.competition?.id)===pilot.competition&&Number(m.home?.id)===pilot.team&&Number(m.away?.id)===pilot.awayTeam);
 const game=raw?faTrialMatch({...raw,scheduled:raw.scheduled}):null;
 if(!game||!Number.isInteger(game.home_score)||!Number.isInteger(game.away_score))throw Error('final_result_unavailable');
 return game;
}
export async function postmatchStatistics(req,env,id){
 if(req.method!=='GET')return pmJson({error:'method_not_allowed'},405);
 const pilot=POSTMATCH_PILOT.find(p=>String(p.id)===String(id));
 if(!pilot)return pmJson({error:'pilot_match_not_found'},404);
 try{
  // A team/date/competition query stays below one page. No historical scan or schedule dependency.
  const history=await faTrialCached(env,'postmatch-result-v1-'+pilot.id,'/matches/history.json',
   {competition_id:pilot.competition,team_id:pilot.team,from:pilot.day,to:pilot.day,page:1},86400000,d=>postmatchHistory(d,pilot));
  if(!history.data)return pmJson({error:'final_result_unavailable',match:pilot},503);
  // Separate key ensures an old in-play snapshot cannot masquerade as final statistics.
  const stats=await faTrialCached(env,'postmatch-statistics-v1-'+pilot.id,'/statistics/matches.json',
   {match_id:pilot.id},86400000,faTrialStatistics);
  if(!stats.data?.length)return pmJson({error:'postmatch_statistics_unavailable',match:pilot},503);
  const rows=Object.entries(POSTMATCH_LABELS).flatMap(([type,label])=>{
   const r=stats.data.find(s=>s.type===type);return r?[{type,label,home:r.home,away:r.away,unit:type==='possesion'?'%':''}]:[];
  });
  if(!rows.length)return pmJson({error:'postmatch_statistics_unavailable',match:pilot},503);
  return pmJson({match:{id:pilot.id,home:history.data.home,away:history.data.away,league:pilot.league,date:history.data.date,
   home_score:history.data.home_score,away_score:history.data.away_score,status:'FINISHED'},
   statistics:rows,statistics_updated_at:new Date(stats.fetched_at).toISOString(),
   result_checked_at:new Date(history.fetched_at).toISOString(),stale:!!(stats.stale||history.stale),
   source:'football-api.com',capture_phase:'postmatch',pilot:true});
 }catch{return pmJson({error:'postmatch_statistics_unavailable',match:pilot},503)}
}

const pmEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function postmatchPage(id){
 const pilot=POSTMATCH_PILOT.find(p=>String(p.id)===String(id));
 if(!pilot)return new Response('Not Found',{status:404});
 const h=pmEscape(pilot.home),a=pmEscape(pilot.away);
 return new Response(`<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${h} – ${a} · Στατιστικά | Tiki-Data</title><style>
 :root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,sans-serif;background:#080d15;color:#ecf1f9}*{box-sizing:border-box}body{margin:0}main{max-width:860px;margin:auto;padding:32px 20px 60px}a{color:#87dcd1;text-decoration:none}header{display:flex;justify-content:space-between;gap:20px;margin-bottom:44px}.brand{font-weight:800;letter-spacing:.04em;color:#fff}.eyebrow{color:#87dcd1;font-size:12px;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(26px,5vw,42px);line-height:1.2;letter-spacing:-.04em;margin:14px 0}.meta,.note{color:#9daec3;font-size:14px;line-height:1.65}.panel{border:1px solid #263346;background:#101925;border-radius:22px;padding:26px;margin-top:26px}.teams{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;font-size:clamp(16px,3vw,24px);font-weight:700}.teams span:last-child{text-align:right}.score{font-size:32px;white-space:nowrap}.status{text-align:center;margin:16px 0 0;color:#87dcd1;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:24px}caption{text-align:left;font-size:18px;font-weight:700;padding-bottom:16px}th,td{padding:17px 8px;border-bottom:1px solid #263346}thead th{color:#9daec3;font-size:12px;font-weight:500}th[scope=row]{font-size:14px;font-weight:500;text-align:center;color:#c8d3e3}td{width:24%;font-weight:700;font-size:18px}td:last-child{text-align:right}button{border:1px solid #3d746f;border-radius:10px;background:#183c39;color:#d8fff7;padding:12px 20px;cursor:pointer;font:inherit}button[hidden],[hidden]{display:none!important}@media(max-width:480px){main{padding:24px 14px}.panel{padding:20px 14px}.score{font-size:27px}.teams{gap:10px}th,td{padding:15px 3px}}
 </style></head><body><main><header><a class="brand" href="/">TIKI-DATA</a><a href="/transparency">← Διαφάνεια</a></header><p class="eyebrow">Δοκιμαστική παρουσίαση · Μετά τον αγώνα</p><h1>Ο αγώνας σε αριθμούς.</h1><p class="meta">${pmEscape(pilot.league)} · 29 Οκτωβρίου 2026</p><section class="panel"><div class="teams"><span>${h}</span><b class="score" id="score">— : —</b><span>${a}</span></div><p id="status" class="status" role="status" aria-live="polite">Φόρτωση στατιστικών μετά τη λήξη…</p><table id="stats" hidden><caption>Στατιστικά αγώνα</caption><thead><tr><th scope="col">${h}</th><th scope="col">Στατιστικό</th><th scope="col">${a}</th></tr></thead><tbody id="rows"></tbody></table><p class="note" id="updated"></p><button id="retry" hidden>Δοκιμή ξανά</button></section><p class="note">Δοκιμαστική προβολή τριών αγώνων. Εμφανίζονται μόνο όσα στατιστικά είναι διαθέσιμα. Το «—» σημαίνει ότι δεν δόθηκε τιμή.</p></main><script>
 const statusNode=document.getElementById('status'),retry=document.getElementById('retry');
 async function load(){retry.hidden=true;statusNode.textContent='Φόρτωση στατιστικών μετά τη λήξη…';try{
 const r=await fetch('/api/transparency/statistics/${pilot.id}',{headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok||!d.statistics?.length)throw Error('unavailable');
 document.getElementById('score').textContent=d.match.home_score+' : '+d.match.away_score;
 statusNode.textContent=d.stale?'Τελικό · Προσωρινά προβάλλεται το αποθηκευμένο στιγμιότυπο':'Τελικό · Στατιστικά μετά τη λήξη';
 const body=document.getElementById('rows');body.replaceChildren();for(const s of d.statistics){const tr=document.createElement('tr');for(const [i,v] of [s.home,s.label,s.away].entries()){const cell=document.createElement(i===1?'th':'td');if(i===1)cell.scope='row';cell.textContent=i===1?v:v===null?'—':v+s.unit;tr.append(cell)}body.append(tr)}
 document.getElementById('stats').hidden=false;document.getElementById('updated').textContent='Λήψη στατιστικών: '+new Date(d.statistics_updated_at).toLocaleString('el-GR',{timeZone:'Asia/Nicosia'})+' · Ώρα Κύπρου';
 }catch{statusNode.textContent='Δεν είναι διαθέσιμα επαληθευμένα δεδομένα μετά τη λήξη. Δοκίμασε ξανά αργότερα.';retry.hidden=false}}
 retry.addEventListener('click',load);void load();
 </script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
