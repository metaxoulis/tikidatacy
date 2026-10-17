import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFinishedSportmonks} from '../frontend/sportmonks-training.mjs';
const sample={id:'sportmonks-123',league_key:'epl',date:'2026-10-17T17:00:00.000Z',status:'FT',
 home:'Arsenal',away:'Chelsea',scores:[
  {description:'2ND_HALF',score:{participant:'home',goals:2}},
  {description:'2ND_HALF',score:{participant:'away',goals:1}},
  {description:'1ST_HALF',score:{participant:'home',goals:1}},
  {description:'1ST_HALF',score:{participant:'away',goals:0}}]};
test('import only verified finished 90-minute results, never live or untrusted competitions',()=>{
 const rows=normalizeFinishedSportmonks([sample,sample,{...sample,id:'sportmonks-124',status:'LIVE'},
  {...sample,id:'sportmonks-125',league_key:'friendly'},
  {...sample,id:'sportmonks-126',scores:[]}]);
 assert.equal(rows.length,1);assert.equal(rows[0].home_score,2);
 assert.equal(rows[0].dataset_slug,'epl-2026-27');
 assert.equal(rows[0].source_provider,'sportmonks');
});
