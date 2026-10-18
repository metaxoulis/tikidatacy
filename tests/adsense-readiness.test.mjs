import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('public informational pages are bundled and routed by the Pages worker',()=>{
 const worker=get('frontend/worker.js');
 for(const page of ['about','privacy','terms','cookies','contact']){
   assert.match(worker,new RegExp("if\\(path==='\\/"+page+"'"));
   const src=get('frontend-v13/'+page+'.html');
   const match=worker.match(new RegExp('^const LEGAL_'+page.toUpperCase()+'=(.*);$','m'));
   assert.ok(match,'missing '+page+' HTML bundle');
   assert.equal(JSON.parse(match[1]),src);
   assert.match(src,/Tiki-Data/);
 }
});
test('footer links remain visible after unified match center rerenders',()=>{
 const js=get('frontend-v13/mobile-ui.js');
 assert.match(js,/const SITE_FOOTER=/);
 assert.match(js,/\+'<\/main>'\+SITE_FOOTER/);
 for(const page of ['about','privacy','terms','cookies','contact'])assert.ok(js.includes('/'+page));
});
test('no ad network script or fake cookie CMP is activated',()=>{
 const worker=get('frontend/worker.js');
 assert.doesNotMatch(worker,/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
 assert.match(worker,/const ADSENSE_ROBOTS=/);
 assert.match(worker,/const ADSENSE_SITEMAP=/);
});
