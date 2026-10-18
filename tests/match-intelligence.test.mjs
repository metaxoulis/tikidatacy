import test from 'node:test';import assert from 'node:assert/strict';
import {lineupConfirmed,normalizeMatchIntelligence,expectedXg} from '../frontend/match-intelligence.mjs';
const raw={id:123,sport_id:1,metadata:[{type_id:572,values:{confirmed:false}}],
 lineups:[{fixture_id:123,team_id:10,type_id:11,player_id:3,player_name:'Player One',jersey_number:5,formation_position:2}],
 expectedlineups:[{fixture_id:123,team_id:20,type_id:77614,player_id:9,player_name:'Projected'}],
 expected:[{fixture_id:123,type_id:5304,participant_id:10,location:'home',data:{value:1.33}},
 {fixture_id:123,type_id:5304,participant_id:20,location:'away',data:{value:0.9}}]};
test('lineup metadata is tri-state, not inferred from player counts',()=>{
 assert.equal(lineupConfirmed([]),null);assert.equal(lineupConfirmed(raw.metadata),false);
 assert.equal(lineupConfirmed([{type_id:572,values:{confirmed:true}}]),true);
});
test('unconfirmed official collection is never incorrectly marked confirmed',()=>{
 const v=normalizeMatchIntelligence(raw,{}, {home_id:10,away_id:20});
 assert.equal(v.lineup_status,'predicted_by_provider');assert.equal(v.lineups.home.starters[0].name,'Player One');
 assert.equal(v.confirmed_lineup,false);assert.deepEqual([v.xg.home,v.xg.away],[1.33,0.9]);
});
test('fallback to predicted XI; no fabricated team values or invalid fixture',()=>{
 const v=normalizeMatchIntelligence({...raw,lineups:[],expected:[]},{},{home_id:10,away_id:20});
 assert.equal(v.lineup_status,'predicted_by_provider');assert.equal(v.lineups.away.starters.length,1);
 assert.equal(v.xg.home,null);assert.equal(normalizeMatchIntelligence(raw,{}, {home_id:10,away_id:10}),null);
});
test('xG ignores unrelated fixtures and non-xG types',()=>{
 assert.deepEqual(expectedXg([{fixture_id:124,type_id:5304,data:{value:3}},
 {fixture_id:123,type_id:55,data:{value:6}},
 {fixture_id:123,type_id:5304,participant_id:10,data:{value:1.52}}],123).map(x=>x.xg),[1.52]);
});
