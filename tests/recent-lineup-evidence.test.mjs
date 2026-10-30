import test from 'node:test';
import assert from 'node:assert/strict';
import {faLineupName,faHistoricalRole,faHistorySeasonStart,faAnalyzeLineupEvidence,faRecentLineupEvidence,faEnrichProviderLineups} from '../frontend/recent-lineup-evidence.mjs';

const mk=(date,id)=>({id,starting_at:date+' 19:00:00',home_id:50,away_id:60,home_formation:'4-4-2',away_formation:'4-3-3'});
const fixtures=[mk('2026-10-20',400),mk('2026-10-12',399),mk('2026-10-01',398),mk('2026-09-23',397)];
const lineup=fixtures.flatMap(f=>Array.from({length:11},(_,i)=>({
 fixture_id:f.id,team_id:50,player_id:100+i,player_name:'Player '+(i+1),jersey_number:i+1,role:'lineup',
 formation_field:i===0?'1:1':i<=4?'2:'+(i):i<=8?'3:'+(i-4):'5:'+(i-8),
 formation_position:i+1
})));

test('Positions are historical estimates, including keeper, not official positions',()=>{
 const e=faAnalyzeLineupEvidence(fixtures,lineup,50,'2026-10-30T19:00:00Z');
 assert.equal(e.matches_observed,4);
 assert.equal(e.projected.length,11);
 assert.equal(e.formation,'4-4-2');
 assert.equal(e.positionFor(' PLAYER 1 ').position,'Τερματοφύλακας');
 assert.equal(e.positionFor('Player 2').position,'Αμυντικός');
 assert.equal(e.positionFor('Somebody Else'),null);
 assert.equal(e.projected[0].source,'recent_historical_projection');
 assert.equal(e.verified,false);
});

test('No old or future lineups can leak into a projection',()=>{
 assert.equal(faHistorySeasonStart('2026-10-30T19:00:00Z'),Date.UTC(2025,6,1));
 const invalid=[mk('2024-10-01',51),mk('2026-10-29',52)];
 const rows=invalid.flatMap(f=>lineup.filter(x=>x.fixture_id===400).map(p=>({...p,fixture_id:f.id})));
 assert.equal(faAnalyzeLineupEvidence(invalid,rows,50,'2026-10-30T19:00:00Z'),null);
});

test('Insufficient recent lineups do not invent XI',()=>{
 const e=faAnalyzeLineupEvidence(fixtures.slice(0,2),lineup,50,'2026-10-30T19:00:00Z');
 assert.equal(e.projected,null);
 assert.ok(e.positionFor('Player 2'));
});

test('Provider-announced players keep provider names and IDs; role is historical only',()=>{
 const e=faAnalyzeLineupEvidence(fixtures,lineup,50,'2026-10-30T19:00:00Z');
 const p={name:'PLAYER 2',id:999,number:21,substitute:false};
 const result=faEnrichProviderLineups({home:{starters:[p],bench:[{name:'Unknown',number:3}]},away:{starters:[],bench:[]}}, {home:e,away:null});
 assert.equal(result.home.starters[0].id,999);
 assert.equal(result.home.starters[0].position,'Αμυντικός');
 assert.equal(result.home.starters[0].position_source,'recent_historical_lineups');
 assert.equal(result.home.bench[0].position,undefined);
 assert.equal(result.home.source,'football_api_announced_unverified');
 assert.equal(result.away.source,'unavailable');
});

test('Read-only DB queries are limited to recent matches and matching team ID',async()=>{
 const calls=[],db={prepare(sql){return{bind(...args){calls.push({sql,args});return{async all(){return{results:sql.includes('FROM sm_fixtures')?fixtures:lineup}}}}}}};
 const r=await faRecentLineupEvidence(db,50,'2026-10-30T19:00:00Z');
 assert.equal(r.projected.length,11);
 assert.equal(calls.length,2);
 assert.match(calls[0].sql,/state IN \('FT','AET','FTP'\)/);
 assert.match(calls[0].sql,/LIMIT 8/);
 assert.match(calls[1].sql,/role='lineup'/);
 assert.equal(calls[1].args[0],50);
 assert.equal(await faRecentLineupEvidence(null,50,'2026-10-30T19:00:00Z'),null);
});

test('Historical names and malformed formation positions cannot produce fabricated roles',()=>{
 assert.equal(faHistoricalRole('7:2'),null);
 assert.equal(faHistoricalRole('1:1'),'Τερματοφύλακας');
 assert.equal(faLineupName('João Félix'),'joao felix');
});
