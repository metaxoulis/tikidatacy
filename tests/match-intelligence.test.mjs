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

test('fixture-scoped xG include accepts missing redundant fixture_id but external feed does not',()=>{
 const fixture={...raw,expected:[],xgfixture:[
 {type:{code:'expected-goals'},location:'home',data:{value:1.9498}},
 {type:{code:'expected-goals'},location:'away',data:{value:0.8279}}],
 lineups:[{fixture_id:123,team_id:10,type_id:11,player_id:3,player_name:'Player One',expected:[{type_id:5304,data:{value:0.25}}]}]};
 const v=normalizeMatchIntelligence(fixture,{team:[{fixture_id:999,type_id:5304,participant_id:10,data:{value:9.5}}]},{home_id:10,away_id:20});
 assert.deepEqual([v.xg.home,v.xg.away],[1.95,0.828]);
 assert.equal(v.lineups.home.starters[0].xg,0.25);
 assert.equal(expectedXg([{type_id:5304,data:{value:2}}],123).length,0);
});

test('lineup preserves each team when only one has official starters and identifies goalkeeper metadata',()=>{
 const fixture={...raw,metadata:[{type_id:572,values:{confirmed:true}}],
  lineups:[{fixture_id:123,team_id:10,type_id:11,player_id:44,player_name:'Home GK',jersey_number:18,formation_field:'1:1',formation_position:9}],
  expectedlineups:[{fixture_id:123,team_id:20,type_id:77614,player_id:89,player_name:'Away GK',formation_field:'1:1',jersey_number:31}]};
 const d=normalizeMatchIntelligence(fixture,{}, {home_id:10,away_id:20});
 assert.equal(d.lineups.home.starters[0].name,'Home GK');
 assert.equal(d.lineups.away.starters[0].name,'Away GK');
 assert.equal(d.lineups.home.starters[0].is_goalkeeper,true);
 assert.equal(d.lineups.away.starters[0].is_goalkeeper,true);
 assert.equal(d.lineup_sources.home,'official');
 assert.equal(d.lineup_sources.away,'predicted_by_provider');
 assert.equal(d.lineup_status,'predicted_by_provider','mixed team coverage must not be shown as entirely confirmed');
});
