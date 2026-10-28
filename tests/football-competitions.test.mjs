import test from 'node:test';
import assert from 'node:assert/strict';
import {faCoveredCompetition,faTeamLogos} from '../frontend/football-primary.mjs';

test('top flights, UEFA and the seven countries\' domestic cups are covered',()=>{
 assert.equal(faCoveredCompetition({competition_id:2,country:'England',league:'Premier League'}),'epl');
 assert.equal(faCoveredCompetition({competition_id:244,country:'',league:'UEFA Champions League'}),'ucl');
 assert.equal(faCoveredCompetition({competition_id:150,country:'England',league:'EFL Cup'}),'fa150');
 assert.equal(faCoveredCompetition({competition_id:167,country:'Germany',league:'DFB Cup'}),'fa167');
 assert.equal(faCoveredCompetition({competition_id:171,country:'Greece',league:'Cup'}),'fa171');
 assert.equal(faCoveredCompetition({competition_id:901,country:'England',league:'FA Cup'}),'fa901');
 assert.equal(faCoveredCompetition({competition_id:902,country:'Spain',league:'Copa del Rey'}),'fa902');
 assert.equal(faCoveredCompetition({competition_id:903,country:'Italy',league:'Coppa Italia'}),'fa903');
 assert.equal(faCoveredCompetition({competition_id:904,country:'France',league:'Coupe de France'}),'fa904');
 assert.equal(faCoveredCompetition({competition_id:905,country:'Cyprus',league:'Cup'}),'fa905');
});
test('lower divisions and other countries\' cups are excluded',()=>{
 for(const row of [{competition_id:154,country:'England',league:'National League'},{competition_id:155,country:'England',league:'National League North / South'},
  {competition_id:180,country:'Italy',league:'Coppa Italia Serie C'},{competition_id:87,country:'Italy',league:'Serie B'},
  {competition_id:100,country:'Austria',league:'ÖFB Cup'},{competition_id:206,country:'Norway',league:'NM Cupen'},{competition_id:null,country:'Greece',league:'Cup'}])
  assert.equal(faCoveredCompetition(row),null,row.league);
});
test('each side gets its own badge: stored badge first, archived identity second, never both blanked by the other',()=>{
 const model={team_identity:{aliases:{'bayern munich':'sportmonks:503'},ambiguous:[]}};
 const key=n=>String(n).toLowerCase();
 const game={home:'Bayern Munich',home_id:10,away:'Magdeburg',away_id:11};
 const none=faTeamLogos(game,model,new Set(),key);
 assert.equal(none.home,'https://cdn.sportmonks.com/images/soccer/teams/23/503.png');assert.equal(none.away,null);
 const stored=faTeamLogos(game,model,new Set([10,11]),key);
 assert.equal(stored.home,'/badges/10.png');assert.equal(stored.away,'/badges/11.png');
});
test('competition logos resolve by league key, or by name for cups without a known ID',async()=>{
 const {faLeagueLogo,faLeagueLogoKey}=await import('../frontend/football-primary.mjs');
 const stored=new Set(['ucl','fa167','name-england-fa-cup','name-cyprus-cyprus-cup']);
 assert.equal(faLeagueLogo({league_key:'ucl',league:'UEFA UEFA Champions League',country:''},stored),'/league-logos/ucl.png');
 assert.equal(faLeagueLogo({league_key:'fa167',league:'DFB Cup',country:'Germany'},stored),'/league-logos/fa167.png');
 assert.equal(faLeagueLogoKey({league:'FA Cup',country:'England'}),'name-england-fa-cup');
 assert.equal(faLeagueLogo({league_key:'fa999',league:'FA Cup',country:'England'},stored),'/league-logos/name-england-fa-cup.png');
 assert.equal(faLeagueLogo({league_key:'fa998',league:'Cyprus Cup',country:'Cyprus'},stored),'/league-logos/name-cyprus-cyprus-cup.png');
 assert.equal(faLeagueLogo({league_key:'fa997',league:'Coppa Italia',country:'Italy'},stored),null);
});
test('worker trains Greek Super League (Sportmonks 325) as greece and reads up to 40000 licensed rows',async()=>{
 const fs=await import('node:fs');const w=fs.readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
 assert.match(w,/325:'greece'/);assert.doesNotMatch(w,/271:'greece'/);
 assert.match(w,/FROM sportmonks_training_results WHERE match_date <= date\('now','-3 day'\) ORDER BY match_date DESC LIMIT 40000/);
});
