import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ui = read('frontend-v13/mobile-ui.js');
const card = ui.slice(ui.indexOf('const card=m=>'), ui.indexOf('const empty=', ui.indexOf('const card=m=>')));

test('match overview always uses compact 1-X-2 columns even when forecast is withheld', () => {
  assert.match(card, /const inner='<div class="tdm-core-prob"/);
  assert.match(card, /\['1','Χ','2'\]\.map/);
  assert.doesNotMatch(card, /tdm-evidence-vs|cardEvidence\(m\)/);
  assert.match(card, /missingUefaEvidence\(m\)/);
});

test('comparative team and match live statistics are reserved for match details', () => {
  assert.doesNotMatch(card, /liveStatsBlock\(m,true\)|liveMethodNote\(m\)/);
  assert.match(ui, /if\(state\.tab==='summary'\)content=currentSeasonFormBlock\(m,d\)\+historicalSummaryBlock\(m,d\)\+allStatisticsBlock\(m,d\)\+liveStatsBlock\(m\)/);
  assert.match(ui, /if\(state\.tab==='stats'\)content=allStatisticsBlock\(m,d\)\+content/);
});

test('no invalid or withheld 1X2 can be displayed from overview or deep API', () => {
  assert.match(ui, /const valid123=p=>/);
  assert.match(ui, /Math\.abs\(p\.p1\+p\.px\+p\.p2-100\)<1/);
  assert.match(ui, /const pr=m=>\{if\(m\.forecast_review\?\.status==='withheld'\)return null/);
  assert.match(ui, /const p=m\.forecast_review\?\.status==='withheld'\?null:/);
  assert.doesNotThrow(() => new Function(ui));
});

test('production worker source embeds exactly the reviewed mobile controller', () => {
  const worker = read('frontend/worker.js');
  const m = worker.match(/^const MOBILE_UI_JS=(.*);$/m);
  assert.ok(m);
  assert.equal(JSON.parse(m[1]), ui);
});
