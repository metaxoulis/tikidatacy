import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
test('live conditional Poisson uses previously computed and cached xG context without waiting for upstream history',()=>{
 const beginning=code.indexOf('async function smComputeLiveSnapshot(');
 const end=code.indexOf('async function smRebuildLiveSnapshot(',beginning);
 const live=code.slice(beginning,end);
 assert.match(live,/tdContextPair\(env\?\.TIKI_DB,env.SPORTMONKS_API_TOKEN,m,false\)/);
 assert.match(live,/tdContextForecast\(base\?/);
 assert.match(live,/contextual_model_available:!!adapted/);
 assert.doesNotMatch(live,/tdFetchContext\(/);
});
