import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('wide navigation is mounted inside the header, and moves safely on resize',()=>{
 const js=read('frontend-v13/mobile-ui.js'),css=read('frontend-v13/mobile-ui.css');
 assert.match(js,/header\.insertBefore\(nav,auth\)/);
 assert.match(js,/root\.append\(nav\)/);
 assert.match(js,/addEventListener\('resize',syncResponsiveNavigation\)/);
 assert.match(css,/@media\(min-width:781px\)\{[\s\S]*\.tdm-top>\.tdm-bottom\{/);
 assert.match(css,/@media\(max-width:780px\)\{/);
});
test('unknown loading counts are not shown as zero',()=>{
 assert.match(read('frontend-v13/mobile-ui.js'),/state\.loading&&!state\.matches\.length\?'—':y/);
});
test('Cloudflare embedded worker preserves byte-identical source UI',()=>{
 const worker=read('frontend/worker.js');
 for(const [name,path] of [['MOBILE_UI_JS','frontend-v13/mobile-ui.js'],['MOBILE_UI_CSS','frontend-v13/mobile-ui.css']]){
  const m=worker.match(new RegExp('^const '+name+'=(.*);$','m'));
  assert.ok(m,name+' bundle exists');assert.equal(JSON.parse(m[1]),read(path),name+' parity');
 }
});
