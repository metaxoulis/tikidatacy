import test from 'node:test';
import assert from 'node:assert/strict';
import {historyDay,historyWindow,historyMatch,historyOddsRow,summarizeHistoryOdds} from '../frontend/sportmonks-history.mjs';
test('bound historical windows to seven UTC dates, reject malformed ranges',()=>{
 const now=Date.parse('2026-10-17T13:00:00Z');
 assert.deepEqual(historyWindow('2026-10-10','2026-10-16',now),{start:'2026-10-10',end:'2026-10-16'});
 assert.equal(historyWindow('2026-10-10','2026-10-17',now),null);
 assert.equal(historyWindow('2026-10-12','2026-10-10',now),null);
 assert.equal(historyWindow('2026-02-30','2026-03-01',now),null);
 assert.equal(historyDay('2026-10-17?api_token=secret'),null);
});
test('accept only real finished fixtures with complete final score and verified leagues',()=>{
 const row={id:123,sport_id:1,starting_at:'2026-10-15 16:00:00',state:{short_name:'FT'},
  league:{name:'Premier League',country:{name:'England'}},
  participants:[{id:1,name:'Arsenal',meta:{location:'home'}},{id:2,name:'Chelsea',meta:{location:'away'}}],
  scores:[{description:'FT',score:{participant:'home',goals:3}},{description:'FT',score:{participant:'away',goals:1}}]};
 const classified=()=> 'epl';
 assert.equal(historyMatch(row,classified).home_score,3);
 assert.equal(historyMatch({...row,state:{short_name:'1H'}},classified),null);
 assert.equal(historyMatch({...row,scores:[]},classified),null);
 assert.equal(historyMatch(row,()=>null),null);
});
test('Premium odds are bookmaker prices and never silently converted to model probabilities',()=>{
 assert.deepEqual(historyOddsRow({id:99,odd_id:2,value:'1.80',bookmaker_update:'2026-10-10 14:00:00'}),{
  id:99,odd_id:2,fixture_id:null,market_id:null,bookmaker_id:null,price:1.8,updated_at:'2026-10-10 14:00:00'});
 assert.equal(historyOddsRow({id:99,odd_id:2,value:'0.5'}),null);
 const out=summarizeHistoryOdds([{id:99,odd_id:2,value:'1.8'},{id:100,odd_id:2,value:'2.1'}]);
 assert.equal(out.records,2);assert.equal(out.distinct_odds,1);assert.equal(out.model_prediction,false);
});
