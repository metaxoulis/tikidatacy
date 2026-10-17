import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLiveProbability,normalizeLiveDetails} from '../frontend/sportmonks-live.mjs';
test('live 1X2 accepts only complete provider supplied normalized percentages',()=>{
 const row={fixture_id:123,type_id:237,minute:57,predictions:{home:71.5,draw:18.2,away:10.3}};
 assert.deepEqual(normalizeLiveProbability(row),{fixture_id:123,p1:71.5,px:18.2,p2:10.3,minute:57,source:'sportmonks_live',market:'1x2'});
 assert.equal(normalizeLiveProbability({...row,predictions:{home:71.5,draw:18.2}}),null);
 assert.equal(normalizeLiveProbability({...row,type_id:238}),null);
 assert.equal(normalizeLiveProbability({...row,predictions:{home:150,draw:0,away:-50}}),null);
 assert.equal(normalizeLiveProbability({...row,fixture_id:'oops'}),null);
});
test('events and statistics are compactly normalized, lineups include only starters',()=>{
 const d=normalizeLiveDetails({events:[{id:1,minute:28,type:{name:'Goal'},player_name:'A'}],
  statistics:[{type:{developer_name:'BALL_POSSESSION'},participant_id:9,data:{value:57}}],
  lineups:[{player_name:'A',type_id:11,team_id:9,jersey_number:11},{player_name:'B',type_id:12}]});
 assert.equal(d.events[0].minute,28);
 assert.equal(d.statistics[0].value,57);
 assert.equal(d.lineups.length,1);
});
