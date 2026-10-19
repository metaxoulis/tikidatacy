import assert from 'node:assert/strict';
import fs from 'node:fs';
const worker=fs.readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
const {fhTrain,fhEstimate,smBuildFocus}=await import('data:text/javascript;base64,'+Buffer.from(worker+'\nexport {fhTrain,fhEstimate,smBuildFocus};').toString('base64'));
const s=worker;new Function(JSON.parse(s.match(/const MOBILE_UI_JS=("(?:[^"\\]|\\.)*");/)[1]));
const rows=[];let day=0;
const add=(h,a,hg,ag,league='epl')=>rows.push({dataset_slug:league+'-2025-26',match_date:new Date(Date.UTC(2026,0,1)+day++*86400000).toISOString().slice(0,10),home_team:h,away_team:a,home_score:hg,away_score:ag,source_provider:'sportmonks'});
for(let i=0;i<20;i++){add('Strong','Weak',3,0);add('Weak','Strong',0,3);add('Average','Strong',1,2);add('Average','Weak',2,1);}
for(let i=0;i<6;i++){add('Test A','Strong',1,1,'uel');add('Test B','Weak',1,1,'uel');}
const model=fhTrain(rows,new Date('2026-10-19T00:00:00Z'));
assert.ok(model.all_teams.strong.home.attack>model.all_teams.weak.home.attack);
// Identical goals scored/conceded against stronger opponents imply stronger attack.
assert.ok(model.all_teams['test a'].home.attack>model.all_teams['test b'].home.attack);
const p=fhEstimate({home:'Test A',away:'Strong',league_key:'uel'},model);
assert.equal(p.tier,'team');assert.equal(p.strength.iterations,8);
assert.ok(Math.abs(p.p1+p.px+p.p2-100)<.01);
const unknown=fhEstimate({home:'Unknown',away:'Weak',league_key:'uel'},model);
assert.equal(unknown.tier,'partial_team');assert.equal(unknown.confidence,'low');
const noTeams=fhEstimate({home:'Missing A',away:'Missing B',league_key:'uel'},model);
assert.equal(noTeams.tier,'cross_league');assert.equal(noTeams.confidence,'very_low');
const fixtures=[['Test A','Strong'],['Unknown','Weak'],['Missing A','Missing B']].map(([home,away],i)=>({id:'test-'+i,home,away,date:'2026-10-22T12:00:00Z',league_key:'uel',status:'NS'}));
const focus=smBuildFocus(fixtures,[],model,Date.parse('2026-10-19T00:00:00Z'));
assert.equal(focus.coverage.with_prediction,3);assert.equal(focus.matches.length,3);
const dupe=fhTrain([...rows,rows[0],{...rows[0],match_date:'2026-10-19'}],new Date('2026-10-19T00:00:00Z'));
assert.equal(dupe.all_teams.strong.home.matches,model.all_teams.strong.home.matches);
console.log('PASS: opponent strength, equal scores/different opponents, all fixtures, labeled fallback, cross-competition samples, duplicate protection, date cutoff, UI syntax');
