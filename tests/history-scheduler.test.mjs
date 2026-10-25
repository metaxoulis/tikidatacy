import {test} from 'node:test';
import assert from 'node:assert/strict';
import {settlement} from '../workers/history-scheduler.js';
const match={final:true,prediction_status:'recorded',log_id:1,home_score:2,away_score:1,captured_at:'2026-10-20T10:00:00Z',kickoff:'2026-10-20T18:00:00Z',probabilities:[0.5,0.3,0.2]};
test('settles verified outcomes',()=>{
 assert.equal(settlement(match).outcome,'H');
 assert.equal(settlement({...match,away_score:2}).outcome,'D');
 assert.equal(settlement({...match,away_score:3}).outcome,'A');
});
test('rejects hindsight, missing scores, unfinished matches and invalid probabilities',()=>{
 for(const patch of [{captured_at:match.kickoff},{home_score:null},{final:false},{probabilities:[1,1,1]},{probabilities:[null,0.5,0.5]},{prediction_status:'pending'}])assert.equal(settlement({...match,...patch}),null);
});
