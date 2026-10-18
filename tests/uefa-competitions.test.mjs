import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {classifyUefaLeague} from '../frontend/uefa-competitions.mjs';
test('UEFA competitions recognized by verified European feed metadata',()=>{
 for(const [name,key] of [['Champions League','ucl'],['UEFA Europa League','uel'],['Europa League','uel'],['Conference League','uecl'],['UEFA Europa Conference League','uecl']])assert.equal(classifyUefaLeague(name,'Europe'),key);
 assert.equal(classifyUefaLeague('Champions League','',2),'ucl');
});
test('do not mix other confederations, women or domestic competitions',()=>{
 for(const [name,country,id] of [['AFC Champions League','Asia',null],["Women's Champions League",'Europe',null],['Champions League','Thailand',2],['Champions League','',3],['Europa League','England',null]])assert.equal(classifyUefaLeague(name,country,id),null);
});
test('all three league keys flow through worker normalizer, training and cache',()=>{
 const w=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
 assert.match(w,/const key=classify\(league,country,id\)/);
 assert.match(w,/const SM_FOCUS_CACHE_KEY='focus_historical_v7_uefa'/);
 assert.match(w,/tdAllowedLeague=new Set\(\['epl'.*'ucl','uel','uecl'\]\)/);
 assert.match(w,/function smInplay\(/);
});
