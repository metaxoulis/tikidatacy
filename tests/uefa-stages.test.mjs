import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
test('UEFA stages fetched by trusted backend with allowed ids not browser token',()=>{
 assert.match(src,/leagues\/'\+id\+'\?include=currentSeason\.stages'/);
 assert.match(src,/async function tdUefaStages/);assert.match(src,/path==='\/api\/uefa\/stages'/);
 assert.match(src,/stage_id:smId\(row\.stage_id\)/);
 assert.doesNotMatch(src,/api_token=NVj3/);
});
