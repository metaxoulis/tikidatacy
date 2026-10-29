import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const worker=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
const bundles={
  JS:'frontend-v13/app.js',
  MOBILE_UI_JS:'frontend-v13/mobile-ui.js',
  MOBILE_UI_CSS:'frontend-v13/mobile-ui.css',
  HOME_V23_JS:'frontend-v13/home-v23.js',
  HOME_V23_CSS:'frontend-v13/home-v23.css',
  HTML_HOME:'frontend-v13/home-v23.html',
  HTML_PREDICTIONS:'frontend-v13/predictions.html',
  JS_DATA:'frontend-v13/data.js',
  CSS_DATA:'frontend-v13/data.css',
  HTML_DATA:'frontend-v13/data.html',
  LEGAL_CSS:'frontend-v13/legal.css',
  LEGAL_THEME_JS:'frontend-v13/legal-theme.js'
};
for(const [key,source] of Object.entries(bundles)){
 test('Cloudflare embedded '+key+' exactly matches '+source,()=>{
  const match=worker.match(new RegExp('^const '+key+'=(.*);$','m'));
  assert(match,'Missing bundle constant '+key);
  const embedded=JSON.parse(match[1]);
  const original=readFileSync(new URL('../'+source,import.meta.url),'utf8');
  assert.equal(embedded,original,'Bundler silently modified asset '+key);
  if(source.endsWith('.js'))assert.doesNotThrow(()=>new vm.Script(embedded,{filename:source}),'Invalid bundled JS');
 });
}
test('No retired backend origin or embedded API credentials',()=>{
 assert(!worker.includes('cc7f36f5.tiki-data.pages.dev'));
 assert(!worker.includes('sk_live_'));
 assert(worker.includes("tdHomeHandler(req,env,ctx)"));
 assert(worker.includes("tdPredictionsHandler(req,env,ctx)"));
});
