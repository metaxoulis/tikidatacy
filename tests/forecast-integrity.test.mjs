import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {forecastIntegrity,normalizedCachedHistory} from '../frontend/forecast-integrity.mjs';
const worker=fs.readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
const {fhName,fhIdentity,fhTeamKey,fhTrain,fhEstimate,fhLeague,smBuildFocus,tdRecoveryPayload,tdSavedForecast}=await import('data:text/javascript;base64,'+Buffer.from(worker+'\nexport {fhName,fhIdentity,fhTeamKey,fhTrain,fhEstimate,fhLeague,smBuildFocus,tdRecoveryPayload,tdSavedForecast};').toString('base64'));

test('Greek Olympiacos and Cypriot Olympiakos never share a profile',()=>{
 assert.equal(fhName('Olympiacos F.C.'),fhName('Olympiakos Piraeus'));
 assert.notEqual(fhName('Olympiacos F.C.'),fhName('Olympiakos'));
});
test('observed names from both providers resolve consistently',()=>{
 for(const [a,b] of [['Inter','FC Internazionale Milano'],['LOSC Lille','Lille OSC'],['Real Betis','Real Betis Balompié'],['St. Pauli','FC St. Pauli 1910'],['FSV Mainz 05','1. FSV Mainz 05'],['Larissa','AE Lárissa']])assert.equal(fhName(a),fhName(b));
});
test('stable IDs separate homonyms and ambiguous legacy rows are rejected',()=>{
 const identity=fhIdentity([{home_team:'United',away_team:'Visitors',home_team_id:1,away_team_id:9},{home_team:'United',away_team:'Visitors',home_team_id:2,away_team_id:9}]);
 assert.equal(fhTeamKey('United',1,identity),'sportmonks:1');
 assert.equal(fhTeamKey('United',2,identity),'sportmonks:2');
 assert.equal(fhTeamKey('United',null,identity),null);
});
test('completed domestic scores enter training with IDs and embargo; duplicates/future/bad scores do not',()=>{
 const r={id:10,date:'2026-09-10T19:00:00Z',league_id:462,league:'Primeira Liga',home:'Benfica',away:'Porto',home_id:605,away_id:652,home_score:2,away_score:1};
 const rows=normalizedCachedHistory([r,r,{...r,id:11,date:'2099-01-01T00:00:00Z'},{...r,id:12,home_score:null},{...r,id:13,home_id:652}],fhLeague,Date.parse('2026-10-20'));
 assert.equal(rows.length,1);assert.equal(rows[0].league_key,'sm462');assert.equal(rows[0].home_team_id,605);
 assert.equal(fhLeague('1. Division','',253),'cyprus');
});
test('past training does not learn team aliases from future observations',()=>{
 const rows=Array.from({length:90},(_,i)=>({dataset_slug:'epl-2025-26',match_date:'2026-01-'+String(i%28+1).padStart(2,'0'),home_team:'A',away_team:'B',home_score:1,away_score:0}));
 rows.push({...rows[0],match_date:'2099-01-01',home_team_id:999,away_team_id:888});
 const model=fhTrain(rows,new Date('2026-10-20'));
 assert.equal(model.team_identity.aliases.a,undefined);
});
test('no unpublished calibration or provider fallback can create a UEFA model forecast',()=>{
 const v={matches:20,competitions:{cyprus:12,uel:8}};
 const model={all_teams:{a:{home:v},b:{away:v}}};
 const f={id:'test',home:'A',away:'B',league_key:'uel',status:'NS',date:'2026-10-22T19:00:00Z'};
 assert.equal(forecastIntegrity(f,model,fhTeamKey).status,'withheld');
 assert.equal(fhEstimate(f,model),null);
 const out=smBuildFocus([f],[],model,Date.parse('2026-10-20'));
 assert.equal(out.matches[0].p1,null);assert.equal(out.matches[0].forecast_review.status,'withheld');
 assert.equal(tdSavedForecast(f),null);
 assert.match(worker,/p=m\.forecast_review\?\.status==='withheld'\?null:m\.model\|\|saved/);
});
test('an acceptance flag cannot bypass independent evaluation and domestic coverage',()=>{
 const venue={matches:20,competitions:{uel:20}};
 const m={all_teams:{a:{home:venue},b:{away:venue}},cross_competition_validation:{accepted:true}};
 const f={home:'A',away:'B',league_key:'uel'};
 assert.deepEqual(forecastIntegrity(f,m,fhTeamKey).reasons,['insufficient_domestic_venue_history','cross_competition_calibration_not_established']);
});


test('UEFA keeps certification withheld but offers only labeled, identity-safe numerical research previews',()=>{
 const home={matches:12,attack:1.25,defence:.8,competitions:{ucl:10,'sm462':2}},away={matches:9,attack:1.0,defence:1.12,competitions:{ucl:7,'sm462':2}};
 const model={model_version:'tiki-identity-balanced-poisson-v11',trained_at:new Date().toISOString(),cutoff:'2026-10-17',global:{matches:200,hmean:1.55,amean:1.15},all_teams:{'sportmonks:101':{home},'sportmonks:202':{away}},cross_competition_validation:{accepted:false}};
 const f={id:'sportmonks-400',home:'Home',away:'Away',home_id:101,away_id:202,league_key:'ucl',status:'NS',date:new Date(Date.now()+48*3600000).toISOString()};
 assert.equal(forecastIntegrity(f,model,fhTeamKey).status,'withheld');
 assert.equal(fhEstimate(f,model),null);
 const p=fhEstimate(f,model,{experimentalPreview:true});
 assert.ok(p);assert.equal(p.tier,'team');assert.ok(Math.abs(p.p1+p.px+p.p2-100)<1);
 const out=smBuildFocus([f],[],model,Date.now());
 assert.equal(out.matches[0].forecast_review.status,'withheld');
 assert.equal(out.matches[0].p1,null);
 assert.ok(out.matches[0].experimental_preview?.preview_only);
 assert.equal(out.matches[0].experimental_preview?.validated,false);
 assert.ok(Math.abs(out.matches[0].experimental_preview.p1+out.matches[0].experimental_preview.px+out.matches[0].experimental_preview.p2-100)<1);
 const noId=smBuildFocus([{...f,id:'sportmonks-401',home_id:null}],[],model,Date.now());
 assert.equal(noId.matches[0].experimental_preview,null);
 const tiny={...model,all_teams:{'sportmonks:101':{home:{...home,matches:2}},'sportmonks:202':{away}}};
 assert.equal(smBuildFocus([f],[],tiny,Date.now()).matches[0].experimental_preview,null);
});
