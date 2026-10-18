/* Verified European men's club competitions; prevents similarly-named non-UEFA leagues. */
const UEFA_COMPETITIONS={ucl:{name:'UEFA Champions League'},uel:{name:'UEFA Europa League'},uecl:{name:'UEFA Conference League'}};
function classifyUefaLeague(name,country='',leagueId=null){
 const n=String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
 const c=String(country||'').trim().toLowerCase();
 if(!n||/\b(women|woman|womens|female|youth|junior|u17|u19|u20|u21|afc|caf|concacaf|conmebol|asia|africa)\b/.test(n))return null;
 const key=/^(?:uefa )?champions league$/.test(n)?'ucl':/^(?:uefa )?europa league$/.test(n)?'uel':/^(?:uefa )?(?:europa )?conference league$/.test(n)?'uecl':null;
 if(!key||c&&!/^(europe|uefa|international)$/.test(c))return null;
 if(!c&&!n.startsWith('uefa ')&&!(key==='ucl'&&Number(leagueId)===2))return null;
 return key;
}
export {UEFA_COMPETITIONS,classifyUefaLeague};
