import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fhSMLeague,fhSMDisplay} from '../frontend/focus-home.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Cypriot 1. Division only resolves when country is Cyprus',()=>{
 assert.equal(fhSMLeague('1. Division','Cyprus'),'cyprus');
 assert.equal(fhSMLeague('1. Division','Switzerland'),null);
 assert.equal(fhSMLeague('Super League','Greece'),'greece');
 assert.equal(fhSMLeague('Super League','China'),null);
});
test('real upcoming matches remain visible without fake probability estimates',()=>{
 const f={id:'sportmonks-1',home:'Unknown United',away:'Another Town',league:'Premier League',league_key:'epl',status:'NS',date:'2099-10-17T19:00:00Z',logos:{home:null,away:null}};
 const result=fhSMDisplay([f],null);
 assert.equal(result.matches.length,1);
 assert.equal(result.predictions_available,0);
 assert.equal(result.matches[0].model,null);
});
test('old APIs and diagnostic endpoints are absent from release Worker',()=>{
 const w=read('frontend/worker.js');
 assert(w.includes("if(path==='/api/home-focus')"));
 assert(w.includes("if(path==='/api/live')"));
 for(const x of ['/api/allsports/','/api/sport/','/api/home-v23','/api/fixtures','/api/logo/team/','/api/sportmonks/stage','/api/sportmonks/health','SPORTAPI_AI_KEY','ALLSPORTS_API_KEY'])assert(!w.includes(x),x);
 assert(w.includes('https://cdn.sportmonks.com'));
 assert(read('frontend-v13/app.js').includes('sportmonksLogo'));
 assert(read('frontend-v13/home-v23.js').includes("fetch('/api/live'"));
});
