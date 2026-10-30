import test from 'node:test';
import assert from 'node:assert/strict';
import {faLineupName,faHistoricalRole,faHistorySeasonStart,faLineupNameMatch,faAnalyzeLineupEvidence,faRecentLineupEvidence,faEnrichProviderLineups} from '../frontend/recent-lineup-evidence.mjs';

const mk=(date,id,formation='4-4-2')=>({id,starting_at:date+' 19:00:00',home_id:50,away_id:60,home_formation:formation,away_formation:'4-3-3'});
const fixtures=[mk('2026-10-20',400),mk('2026-10-12',399),mk('2026-10-01',398),mk('2026-09-23',397)];
// Sportmonks rows for a 4-4-2: 1 goalkeeper, 2 defence, 3 midfield, 4 attack.
const field=i=>i===0?'1:1':i<=4?'2:'+i:i<=8?'3:'+(i-4):'4:'+(i-8);
const group=i=>i===0?24:i<=4?25:i<=8?26:27;
const lineup=fixtures.flatMap(f=>Array.from({length:11},(_,i)=>({
 fixture_id:f.id,team_id:50,player_id:100+i,player_name:'Player '+(i+1),jersey_number:i+1,position_id:group(i),role:'lineup',
 formation_field:field(i),formation_position:i+1
})));

test('Positions are historical estimates, including keeper, not official positions',()=>{
 const e=faAnalyzeLineupEvidence(fixtures,lineup,50,'2026-10-30T19:00:00Z');
 assert.equal(e.matches_observed,4);
 assert.equal(e.projected.length,11);
 assert.equal(e.formation,'4-4-2');
 assert.equal(e.positionFor(' PLAYER 1 ').position,'Τερματοφύλακας');
 assert.equal(e.positionFor('Player 2').position,'Αμυντικός');
 assert.equal(e.positionFor('Player 10').position,'Επιθετικός');
 assert.equal(e.positionFor('Somebody Else'),null);
 assert.equal(e.projected[0].source,'recent_historical_projection');
 assert.equal(e.verified,false);
});

test('Formation rows are read against that match formation, as Sportmonks numbers them',()=>{
 assert.equal(faHistoricalRole('1:1'),'Τερματοφύλακας');
 assert.equal(faHistoricalRole('4:1','4-3-3'),'Επιθετικός');
 assert.equal(faHistoricalRole('4:2','4-4-2'),'Επιθετικός');
 assert.equal(faHistoricalRole('4:2','3-5-2'),'Επιθετικός');
 assert.equal(faHistoricalRole('3:1','4-2-3-1'),'Αμυντικός μέσος');
 assert.equal(faHistoricalRole('4:2','4-2-3-1'),'Μεσοεπιθετικός');
 assert.equal(faHistoricalRole('5:1','4-2-3-1'),'Επιθετικός');
 assert.equal(faHistoricalRole('3:1','4-1-4-1'),'Αμυντικός μέσος');
 assert.equal(faHistoricalRole('4:3','4-1-4-1'),'Μέσος');
 assert.equal(faHistoricalRole('3:2','3-4-2-1'),'Μέσος');
 assert.equal(faHistoricalRole('4:1','3-4-2-1'),'Μεσοεπιθετικός');
 assert.equal(faHistoricalRole('3:2','4-3-3'),'Μέσος');
 // Without a usable formation only the goalkeeper row or the position group is trusted.
 assert.equal(faHistoricalRole('4:1',null),null);
 assert.equal(faHistoricalRole('6:1','4-3-3',27),'Επιθετικός');
 assert.equal(faHistoricalRole(null,null,25),'Αμυντικός');
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

test('Lineups older than about two months keep positions but give no projected XI',()=>{
 const e=faAnalyzeLineupEvidence(fixtures,lineup,50,'2026-12-25T19:00:00Z');
 assert.equal(e.projected,null);
 assert.equal(e.positionFor('Player 10').position,'Επιθετικός');
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

test('Abbreviated Football-API names match one Sportmonks player of the same team',()=>{
 const people=['Maroan Sannadi','Beñat Prados','Javi Navarro','Jesús Navarro','Micky van de Ven'].map((name,i)=>{
  const norm=faLineupName(name);return {norm,tokens:norm.split(' '),name,number:[21,6,31,12,37][i]};
 });
 assert.equal(faLineupNameMatch('M. Sannadi',null,people)?.name,'Maroan Sannadi');
 assert.equal(faLineupNameMatch('B. Prados Diaz',8,people)?.name,'Beñat Prados');
 assert.equal(faLineupNameMatch('J. Navarro',null,people),null);
 assert.equal(faLineupNameMatch('J. Navarro',12,people)?.name,'Jesús Navarro');
 assert.equal(faLineupNameMatch('V. van Dijk',4,people),null);
 assert.equal(faLineupNameMatch('A. Sannadi',null,people),null);
});

test('Bench-only players get their Sportmonks position group',()=>{
 const sub=fixtures.map(f=>({fixture_id:f.id,team_id:50,player_id:300,player_name:'Ander Herrera',jersey_number:20,position_id:26,role:'bench',formation_field:null}));
 const e=faAnalyzeLineupEvidence(fixtures,[...lineup,...sub],50,'2026-10-30T19:00:00Z');
 assert.equal(e.positionFor('A. Herrera',20).position,'Μέσος');
 assert.ok(!e.projected.some(p=>p.name==='Ander Herrera'));
});

test('Projected XI follows the usual formation instead of the eleven most frequent names',()=>{
 // Four 4-3-3 games; a fifth centre-back starts as often as the strikers but the shape has room for four.
 const games=[mk('2026-10-20',500,'4-3-3'),mk('2026-10-12',499,'4-3-3'),mk('2026-10-01',498,'4-3-3'),mk('2026-09-23',497,'4-3-3')];
 const shape=['1:1','2:1','2:2','2:3','2:4','3:1','3:2','3:3','4:1','4:2','4:3'];
 const rows=games.flatMap((f,g)=>shape.map((pos,i)=>{
  const id=i===8&&g%2===0?120:200+i;  // the extra defender took the striker slot in the two newest games
  return {fixture_id:f.id,team_id:50,player_id:id,player_name:id===120?'Spare Defender':'Starter '+i,jersey_number:id%100,
   position_id:id===120?25:undefined,role:'lineup',formation_field:id===120?'2:5':pos};
 }));
 const e=faAnalyzeLineupEvidence(games,rows,50,'2026-10-30T19:00:00Z');
 assert.equal(e.formation,'4-3-3');
 const count=role=>e.projected.filter(p=>p.position===role).length;
 assert.deepEqual([count('Τερματοφύλακας'),count('Αμυντικός'),count('Μέσος'),count('Επιθετικός')],[1,4,3,3]);
 assert.equal(e.projected[0].position,'Τερματοφύλακας');
 assert.equal(e.projected.at(-1).position,'Επιθετικός');
});

test('Read-only DB queries are limited to recent matches and matching team ID',async()=>{
 const calls=[],db={prepare(sql){return{bind(...args){calls.push({sql,args});return{async all(){return{results:sql.includes('FROM sm_fixtures')?fixtures:lineup}}}}}}};
 const r=await faRecentLineupEvidence(db,50,'2026-10-30T19:00:00Z');
 assert.equal(r.projected.length,11);
 assert.equal(calls.length,2);
 assert.match(calls[0].sql,/state IN \('FT','AET','FTP'\)/);
 assert.match(calls[0].sql,/LIMIT 8/);
 assert.match(calls[1].sql,/role IN \('lineup','bench'\)/);
 assert.match(calls[1].sql,/^SELECT /);
 assert.equal(calls[1].args[0],50);
 assert.equal(await faRecentLineupEvidence(null,50,'2026-10-30T19:00:00Z'),null);
});

test('Historical names and malformed formation positions cannot produce fabricated roles',()=>{
 assert.equal(faHistoricalRole('7:2'),null);
 assert.equal(faHistoricalRole('1:1'),'Τερματοφύλακας');
 assert.equal(faLineupName('João Félix'),'joao felix');
});

test('Flanks: Sportmonks counts home columns from the right touchline and away columns from the left',()=>{
 // Real Athletic Club rows: the home right-back is 2:1, the away left-back is 2:1.
 const games=[mk('2026-10-20',700),{...mk('2026-10-12',701),home_id:60,away_id:50,away_formation:'4-4-2'},mk('2026-10-01',702)];
 // Players 2-5 are left-back, left and right centre-back, right-back in every game.
 const back=(home,i)=>'2:'+(home?5-i:i);
 const rows=games.flatMap(f=>Array.from({length:11},(_,i)=>({fixture_id:f.id,team_id:50,player_id:100+i,player_name:'Player '+(i+1),
  jersey_number:i+1,position_id:group(i),role:'lineup',formation_field:i>=1&&i<=4?back(f.home_id===50,i):field(i)})));
 const e=faAnalyzeLineupEvidence(games,rows,50,'2026-10-30T19:00:00Z');
 assert.deepEqual([2,3,4,5].map(n=>e.positionFor('Player '+n).lateral),[0,.33,.67,1]);
 assert.equal(e.projected.find(p=>p.name==='Player 1').lateral,null,'the keeper has no flank');
});

test('Another transliteration matches only through the same shirt number and a near-identical surname',()=>{
 // Nice and Rennes on 2026-10-30: Football-API against the archived Sportmonks spellings.
 const people=['Mousa Tamari','Mohamed Abdelmonem','Mohamed Amoura','Elye Wahi','Nicolas Lemaître','Mahamadou Nagida'].map((name,i)=>{
  const norm=faLineupName(name);return {norm,tokens:norm.split(' '),name,number:[11,5,9,11,16,18][i]};
 });
 assert.equal(faLineupNameMatch('Moussa Al-Taamari',11,people)?.name,'Mousa Tamari');
 assert.equal(faLineupNameMatch('Moussa Al-Taamari',null,people),null,'never without the shirt number');
 assert.equal(faLineupNameMatch('Moussa Al-Taamari',7,people),null);
 assert.equal(faLineupNameMatch('Kevin Tamaro',4,people),null,'a near surname with another number is someone else');
 assert.equal(faLineupNameMatch('Mohamed Abdel Monem',5,people)?.name,'Mohamed Abdelmonem');
 assert.equal(faLineupNameMatch('Mohamed El Amine Amoura',9,people)?.name,'Mohamed Amoura');
 assert.equal(faLineupNameMatch('Sepe Elye Wahi',11,people)?.name,'Elye Wahi');
 assert.equal(faLineupNameMatch('Nicolas Lemaitre',16,people)?.name,'Nicolas Lemaître');
 assert.equal(faLineupNameMatch('Mahamadou Aboubakar Nagida',18,people)?.name,'Mahamadou Nagida');
});
