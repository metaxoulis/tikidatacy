import test from 'node:test';import assert from 'node:assert/strict';
import {batchDay,addBatchDays,historyBatchWindow,normalizedHistoricRow,filterCompletedHistoricalRows} from '../frontend/sportmonks-batch.mjs';
test('backfill progresses in UTC batches, never skips a date or exceeds 100 days',()=>{
 assert.deepEqual(historyBatchWindow('2025-12-21','2026-01-15',28),{start:'2025-12-21',end:'2026-01-15',next:'2026-01-16',days:26});
 assert.deepEqual(historyBatchWindow('2026-02-26','2026-03-02',3),{start:'2026-02-26',end:'2026-02-28',next:'2026-03-01',days:3});
 assert.equal(historyBatchWindow('2026-03-04','2026-03-02',28),null);
 assert.equal(historyBatchWindow('2026-01-01','2026-02-01',101),null);
 assert.equal(batchDay('2026-02-30'),null);assert.equal(addBatchDays('2026-02-28',1),'2026-03-01');
});
test('only verified full-time scores are eligible for training',()=>{
 const match={id:'sportmonks-123',source:'sportmonks',final:true,league_key:'cyprus',
 date:'2026-10-17T17:00:00Z',home:'Omonia',away:'APOEL',home_score:2,away_score:1};
 assert.deepEqual(normalizedHistoricRow(match),{fixture_id:123,dataset_slug:'cyprus-2026-27',league_key:'cyprus',
 match_date:'2026-10-17',home_team:'Omonia',away_team:'APOEL',home_score:2,away_score:1,source_provider:'sportmonks'});
 const items=[{state:{short_name:'FT'},m:match},{state:{short_name:'AET'},m:{...match,id:'sportmonks-456'}},
 {state:{short_name:'FT'},m:match},{state:{short_name:'1H'},m:{...match,id:'sportmonks-789'}}];
 assert.equal(filterCompletedHistoricalRows(items,r=>r.m).length,1);
 assert.equal(normalizedHistoricRow({...match,home_score:28}),null);
});
