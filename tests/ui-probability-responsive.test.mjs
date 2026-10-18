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
 assert.match(js,/restoreFixtures\(\);baseMatches=state\.matches\.slice\(\);render\(\);void refresh\(\);void refreshLive\(\)/);
 const fixture=js.indexOf("baseMatches=payload.matches.filter(");
 const live=js.indexOf("async function refreshLive()");
 assert.ok(fixture>0&&live>fixture,'fixtures should be painted before optional live fetch');
 assert.match(js,/Date\.now\(\)-c\.saved>21600000/);
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

test('light theme tabs stay legible on desktop and mobile',()=>{
 const css=get('frontend-v13/mobile-ui.css'),worker=get('frontend/worker.js');
 assert.match(css,/html\.td-mobile-ready\{color-scheme:light!important\}/);
 assert.match(css,/#td-mobile-root \.tdm-tab:not\(\.active\)\{color:#24434d;background:#fff\}/);
 const embedded=worker.match(/^const MOBILE_UI_CSS=(.*);$/m);
 assert.ok(embedded);assert.equal(JSON.parse(embedded[1]),css);
});

test('live data are calculated and cached by the backend, never in the mobile client',()=>{
 const worker=get('frontend/worker.js'),ui=get('frontend-v13/mobile-ui.js');
 assert.match(worker,/const SM_LIVE_SNAPSHOT_KEY='sportmonks_live_snapshot_v1'/);
 assert.match(worker,/async function smComputeLiveSnapshot\(/);
 assert.match(worker,/async function smRebuildLiveSnapshot\(/);
 assert.match(worker,/ON CONFLICT\(cache_key\) DO UPDATE SET expires_at=excluded.expires_at/);
 assert.match(ui,/async function refreshLive\(/);
 assert.match(ui,/setInterval\(\(\)=>\{if\(!document.hidden\)void refreshLive\(\)\},20000\)/);
 assert.match(ui,/liveMatches=snapshot.matches/);
 assert.match(ui,/snapshot\?\.pending/);
});

test('last live 1X2 values survive refreshing and carry an explicit old-estimate label',()=>{
 const worker=get('frontend/worker.js'),ui=get('frontend-v13/mobile-ui.js');
 assert.match(worker,/smRetainLiveEstimates\(calculated,existing\)/);
 assert.match(worker,/return smLiveSnapshotResponse\(\{\.\.\.saved,pending:/);
 assert.match(ui,/olderEstimateTag\(m\)/);
 assert.match(ui,/live_probability_stale:true/);
 assert.match(ui,/live_probability_updated_at/);
});
