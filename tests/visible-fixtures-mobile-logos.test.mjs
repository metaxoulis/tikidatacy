import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('predictions visibly expose active search and reset and have valid favorites button',()=>{
 const html=read('frontend-v13/predictions.html');
 assert(html.includes('id="fixtureSearch"'));
 assert(html.includes('id="filterNotice"'));
 assert(html.includes('data-reset-filters'));
 assert(html.includes('<button type="button" data-quick="favorites"'));
 assert(!html.includes('<a href="/predictions?filter=favorites"'));
});

test('all action clears hidden favorites/search/league/day before rendering',()=>{
 const js=read('frontend-v13/app.js');
 assert(js.includes("if(next==='all'){resetAllFilters();return}"));
 assert(js.includes("if(next==='all'){resetAllFilters();return}state.league=next"));
 assert(js.includes("state.league='all';state.day='all';state.mode='all';state.query=''"));
 assert(js.includes("state.all.length&&hasFilters()"));
 assert(js.includes("state.query=e.target.value.trim().toLocaleLowerCase();state.day='all'"));
});

test('fixture filter allows known fixtures and exposes hidden-query cause',()=>{
 const source=read('frontend-v13/app.js');
 const line=source.split('\n').find(x=>x.startsWith('function filteredBase()'));
 assert(line);
 const ctx={state:{all:[
  {home:'Bayern Munich',away:'RB Leipzig',league:'German Bundesliga',id:'1',p1:50,px:25,p2:25,coverage:'verified_historical_inputs'},
  {home:'Valencia',away:'Athletic Club',league:'Spanish La Liga',id:'2',p1:30,px:28,p2:42,coverage:'verified_historical_inputs'}
 ],league:'all',mode:'all',query:'',favorites:new Set()},lname:s=>s};
 const fn=runInNewContext('('+line.replace('function filteredBase()','function()')+')',ctx);
 assert.equal(fn().length,2);
 ctx.state.query='barcelona';assert.equal(fn().length,0);
 ctx.state.query='';ctx.state.mode='favorites';assert.equal(fn().length,0);
 ctx.state.mode='all';assert.equal(fn().length,2);
});

test('team-logo tile uses REAL crest catalog, reliable two-source fallback and no fake shield',()=>{
 const js=read('frontend-v13/app.js'),home=read('frontend-v13/home-v23.js');
 const style=read('frontend-v13/styles.css');
 assert(js.includes("has-team-logo"));
 assert(js.includes("team-no-logo"));
 assert(js.includes("realTeamLogo(n)"));
 assert(js.includes("safeSignedLogo(providerURL)"));
 assert(js.includes("im.classList.contains('team-logo-image')"));
 assert(!js.includes("const generated='<svg"));
 assert(style.includes('.modern-predictions .table-crest.has-team-logo'));
 assert(home.includes("has-real-team"));
});
