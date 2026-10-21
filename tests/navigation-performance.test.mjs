import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../frontend-v13/mobile-ui.js',import.meta.url),'utf8');

test('mobile UI parses after navigation changes',()=>{
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'mobile-ui.js'}));
});

test('primary navigation uses the History API and supports browser back/forward',()=>{
  assert.match(source,/function routeForView\(v\)/);
  assert.match(source,/history\.pushState/);
  assert.match(source,/window\.addEventListener\('popstate',syncRouteFromLocation\)/);
  assert.doesNotMatch(source,/location\.assign\('\/transparency'\)/);
});

test('match detail links keep navigation inside the SPA',()=>{
  assert.match(source,/function openMatch\(id,targetPath=null\)/);
  assert.match(source,/params\.get\('match'\)/);
  assert.match(source,/q\.set\('match',id\)/);
});

test('unchanged fixture snapshots do not force a full UI render',()=>{
  assert.match(source,/function matchRenderKey\(m\)/);
  assert.match(source,/const signature=matchListRenderKey\(nextMatches\),changed=signature!==lastPaintSignature/);
  assert.match(source,/if\(!changed\)return false/);
});

test('transparency fetches are deduplicated during SPA navigation',()=>{
  assert.match(source,/let auditLoaded=false,auditPromise=null/);
  assert.match(source,/if\(auditLoaded\)return Promise\.resolve\(\)/);
  assert.match(source,/if\(auditPromise\)return auditPromise/);
});

test('fixture polling pauses on account and transparency views',()=>{
  assert.match(source,/\['transparency','account'\]\.includes\(state\.view\)/);
  assert.match(source,/now-lastFixtureRequestAt<30000/);
  assert.match(source,/now-lastLiveRequestAt<15000/);
});
