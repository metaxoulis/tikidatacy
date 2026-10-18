import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=s=>readFileSync(new URL('../'+s,import.meta.url),'utf8');
test('brand uses reference cyan-to-mint gradient and is bundled without replacement drift',()=>{
 const svg=file('frontend-v13/brand.svg'),worker=file('frontend/worker.js');
 assert(svg.includes('linearGradient id="td"'));
 assert(svg.includes('#0acbff')&&svg.includes('#37f3ae'));
 assert(worker.includes('linearGradient id=\\\"td\\\"'));
 for(const k of ['HTML_HOME','HTML_PREDICTIONS','JS','CSS','HOME_V23_CSS','BRAND']){
  const m=worker.match(new RegExp('^const '+k+'=(.*);$','m'));assert(m,'missing '+k);
  const p={HTML_HOME:'frontend-v13/home-v23.html',HTML_PREDICTIONS:'frontend-v13/predictions.html',JS:'frontend-v13/app.js',CSS:'frontend-v13/styles.css',HOME_V23_CSS:'frontend-v13/home-v23.css',BRAND:'frontend-v13/brand.svg'}[k];
  assert.equal(JSON.parse(m[1]),file(p),'drift '+k);
 }
});
test('mobile cards feature accessible club crests, league and probabilities',()=>{
 const js=file('frontend-v13/app.js'),css=file('frontend-v13/styles.css');
 for(const x of ['td-mobile-card','td-mobile-name','td-mobile-probs','mobile-match-cell','td-mobile-detail','data-open','data-favorite'])assert(js.includes(x),x);
 assert(js.includes("crest(m.home,'table-crest',m.logos?.home)"));
 assert(js.includes("crest(m.away,'table-crest',m.logos?.away)"));
 assert(css.includes('.matches-table tr.match-line>td.mobile-match-cell'));
 assert(css.includes('.topbar .brand{grid-column:2'));
});
test('logo aliases cover every team visible in the mobile reference shortlist',()=>{
 const js=file('frontend-v13/app.js'),logos=file('frontend-v13/logos.js');
 for(const name of ['bayern munich','valencia','real madrid','sevilla','sunderland','bournemouth','olympiacos']){
  assert(js.includes("['"+name+"',"),'missing name alias '+name);
 }
 for(const name of ['RB Leipzig','Athletic Club','Panetolikos','Panathinaikos','Asteras Tripolis','FC Bayern München','Sunderland AFC']){
  assert(logos.includes('"'+name+'":'),'catalog missing '+name);
 }
});
