import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('docs/season_2026_27_form.sql');
const ui=read('frontend-v13/mobile-ui.js');
const worker=read('frontend/worker.js');

test('2026–27 evidence is season-scoped, normalized and held back three days',()=>{
 assert.match(sql,/dataset_slug LIKE '%-2026-27'/);
 assert.match(sql,/match_date >= '2026-07-01'/);
 assert.match(sql,/match_date < date\('now','-3 days'\)/);
 assert.match(sql,/home_team_id <> away_team_id/);
 assert.match(sql,/GROUP BY team_id,venue/);
 assert.match(sql,/uefa_matches/);
 assert.match(sql,/domestic_matches/);
});
test('read-only venue form is associated by stable Sportmonks team IDs',()=>{
 assert.match(worker,/async function tdSeason2627Form\(db,fixture\)/);
 assert.match(worker,/Number\.isSafeInteger\(hi\)/);
 assert.match(worker,/Number\.isSafeInteger\(ai\)/);
 assert.match(worker,/FROM td_2026_27_team_form WHERE/);
 assert.match(worker,/details\.current_season_form=await tdSeason2627Form\(db,verified\)/);
 assert.match(worker,/probability_model:false/);
});
test('2026–27 results show in match analysis but do not override review gate',()=>{
 assert.match(ui,/function currentSeasonFormBlock\(m,d\)/);
 assert.match(ui,/currentSeasonFormBlock\(m,d\)\+historicalSummaryBlock/);
 assert.match(ui,/currentSeasonFormBlock\(m,d\)\+allStatisticsBlock/);
 assert.match(ui,/const pr=m=>\{if\(live\(m\)\)return \[m\.live_outlook,m\.live_prediction\]\.find\(valid123\)/);
 const card=ui.slice(ui.indexOf('const card=m=>'),ui.indexOf('const empty=',ui.indexOf('const card=m=>')));
 assert.doesNotMatch(card,/currentSeasonFormBlock/);
 const constant=worker.match(/^const MOBILE_UI_JS=(.*);$/m);
 assert.ok(constant);
 assert.equal(JSON.parse(constant[1]),ui);
});
