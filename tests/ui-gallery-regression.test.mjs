import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('mobile and desktop controllers compile and use real 1X2 data',()=>{
 for(const p of ['frontend-v13/app.js','frontend-v13/mobile-ui.js','frontend-v13/home-v23.js'])
  assert.doesNotThrow(()=>new Function(get(p)),p);
 const mobile=get('frontend-v13/mobile-ui.js'),desktop=get('frontend-v13/app.js');
 assert.match(mobile,/const miniProb=m=>/);assert.match(mobile,/const dateChips=/);
 assert.match(mobile,/data-pick-day/);assert.match(mobile,/data-day=/);
 assert.match(desktop,/function renderGallery\(/);assert.match(desktop,/renderGallery\(shown\)/);
 assert.match(desktop,/function mainProbabilities\(/);
});
test('uploaded Tiki-Data vector brand replaces previous logo in Worker',()=>{
 const brand=get('frontend-v13/brand-new.svg'),favicon=get('frontend-v13/favicon-new.svg');
 const worker=get('frontend/worker.js');
 assert.match(brand,/<svg xmlns=/);assert.match(brand,/#37f3ae/);
 assert.match(favicon,/viewBox="0 0 355 355"/);
 for(const [key,value] of Object.entries({BRAND:brand,FAVICON:favicon})){
  const line=worker.match(new RegExp('^const '+key+'=(.*);$','m'));
  assert.ok(line,key);assert.equal(JSON.parse(line[1]),value);
 }
 assert.doesNotMatch(worker,/NVj3nQB0z/);
});
test('all Worker HTML and responsive bundles match source files',()=>{
 const worker=get('frontend/worker.js');
 for(const [key,path] of Object.entries({
  HTML_HOME:'frontend-v13/home-v23.html',HTML_PREDICTIONS:'frontend-v13/predictions.html',
  JS:'frontend-v13/app.js',CSS:'frontend-v13/styles.css',
  MOBILE_UI_JS:'frontend-v13/mobile-ui.js',MOBILE_UI_CSS:'frontend-v13/mobile-ui.css',
  HOME_V23_JS:'frontend-v13/home-v23.js',HOME_V23_CSS:'frontend-v13/home-v23.css'
 })){
  const line=worker.match(new RegExp('^const '+key+'=(.*);$','m'));
  assert.ok(line,key);assert.equal(JSON.parse(line[1]),get(path),key);
 }
 assert.match(get('frontend-v13/predictions.html'),/id="matchGallery"/);
 assert.match(get('frontend-v13/predictions.html'),/id="desktopDatePick"/);
});
