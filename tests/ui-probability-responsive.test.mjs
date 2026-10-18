import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('both mobile and desktop controllers parse as JavaScript',()=>{
 for(const f of ['frontend-v13/mobile-ui.js','frontend-v13/app.js','frontend-v13/home-v23.js'])
  assert.doesNotThrow(()=>new Function(get(f)),f);
});
test('probability-first cards keep three sourced numeric columns',()=>{
 const desktop=get('frontend-v13/app.js'),mobile=get('frontend-v13/mobile-ui.js');
 assert.match(desktop,/function mainProbabilities\(/);
 assert.match(desktop,/mainProbabilities\(m\)/);
 assert.match(mobile,/class="tdm-core-prob"/);
 assert.match(mobile,/const p=pr\(m\)/);
 assert.match(desktop,/function renderGallery\(/);
});
test('date controls are active and linked to actual day state',()=>{
 const h=get('frontend-v13/predictions.html'),js=get('frontend-v13/app.js'),mobile=get('frontend-v13/mobile-ui.js');
 assert.match(h,/id="desktopDatePick"/);
 assert.match(js,/function renderDates\(/);assert.match(js,/setDay\(key\)/);
 assert.match(mobile,/data-day/);assert.match(mobile,/state\.day/);
});
test('mobile first paint is not blocked by the slower live scores feed',()=>{
 const js=get('frontend-v13/mobile-ui.js');
 assert.match(js,/restoreFixtures\(\);render\(\);refresh\(\)/);
 const fixture=js.indexOf("state.matches=items.sort(");
 const live=js.indexOf("void fetch('/api/live'");
 assert.ok(fixture>0&&live>fixture,'fixtures should be painted before optional live fetch');
 assert.match(js,/Date\.now\(\)-c\.saved>300000/);
});
test('the site prevents probability boxes from overflowing',()=>{
 const desktop=get('frontend-v13/styles.css');
 const home=get('frontend-v13/home-v23.css');
 const mobile=get('frontend-v13/mobile-ui.css');
 assert.match(desktop,/\.g-prob strong\{[^}]*white-space:nowrap/);
 assert.match(home,/\.home-hero-probs b,\.home-match-probs b\{[^}]*white-space:nowrap/);
 assert.match(mobile,/\.tdm-core-cell b\{[^}]*white-space:nowrap/);
 assert.match(mobile,/\.tdm-top\{[^}]*justify-content:center/);
});
