import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const worker=read('frontend/worker.js');
const {fhEstimate,liveOutlook,forecastIntegrity,fhTeamKey}=await import('data:text/javascript;base64,'+Buffer.from(worker+'\nexport {fhEstimate,liveOutlook,forecastIntegrity,fhTeamKey};').toString('base64'));

test('live endpoint is KV-based and cannot scan D1',()=>{
 const live=worker.slice(worker.indexOf('async function tdProviderLive('),worker.indexOf('async function tdProviderFocus('));
 assert.ok(live.includes('tdPublishedModel(env)'));
 assert.ok(live.includes('fhEstimate(m,published,{experimentalPreview:true})'));
 assert.ok(live.includes('liveOutlook(m,fitted,liveStats)'));
 assert.ok(live.includes('const liveStats=liveStatSummary(m.statistics,m.home_id,m.away_id)'));
 assert.ok(live.includes('prematch_prediction:pregame'));
 assert.ok(!live.includes('TIKI_DB'));
 assert.ok(!live.includes('.prepare('));
 assert.ok(!live.includes('tdSavedForecast'));
});

test('unvalidated UEFA sample yields distinctly labeled live conditional forecast',()=>{
 const home={matches:12,attack:1.25,defence:0.8,competitions:{ucl:10,sm462:2}};
 const away={matches:9,attack:1,defence:1.12,competitions:{ucl:7,sm462:2}};
 const model={model_version:'tiki-identity-balanced-poisson-v11',trained_at:new Date().toISOString(),cutoff:'2026-10-17',
  global:{matches:200,hmean:1.55,amean:1.15},
  all_teams:{'sportmonks:101':{home},'sportmonks:202':{away}},
  cross_competition_validation:{accepted:false}};
 const match={id:'sportmonks-400',home:'Home',away:'Away',home_id:101,away_id:202,league_key:'ucl',
  home_score:1,away_score:0,minute:50,status:'2H',date:new Date().toISOString()};
 assert.equal(forecastIntegrity(match,model,fhTeamKey).status,'withheld');
 assert.equal(fhEstimate(match,model),null);
 const sample=fhEstimate(match,model,{experimentalPreview:true});
 assert.ok(sample);assert.equal(sample.method,'licensed_historical_venue_poisson');
 const outlook=liveOutlook(match,sample);
 assert.ok(outlook);assert.equal(outlook.validated,false);
 assert.equal(outlook.minute,50);
 assert.deepEqual(outlook.observed_score,[1,0]);
 assert.ok(Math.abs(outlook.p1+outlook.px+outlook.p2-100)<1);
 assert.equal(liveOutlook({...match,minute:null},sample),null);
});
