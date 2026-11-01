import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=n=>readFileSync(new URL('../frontend-v13/'+n+'.html',import.meta.url),'utf8');
// AdSense rejected the site (2026-11-01) for inaccurate declarations: the pages said AdSense was not active while its
// script loaded, and left the operator and a private contact "to be published before the AdSense application".
test('legal pages name the operator and a contact address, and describe AdSense as it is',()=>{
 for(const n of ['privacy','contact','about','terms']){
  const html=page(n);
  assert.match(html,/Nicolaos Metaxa/,n);assert.match(html,/mailto:tikidatainfo@gmail\.com/,n);
 }
 for(const n of ['privacy','cookies','terms','about'])assert.match(page(n),/Google AdSense/,n);
 assert.match(page('privacy'),/dataprotection\.gov\.cy/);
 assert.match(page('privacy'),/policies\.google\.com\/technologies\/partner-sites/);
});

test('no page still claims AdSense is off, or that details will come later',()=>{
 for(const n of ['privacy','cookies','contact','about','terms']){
  const html=page(n);
  for(const stale of [/Δεν έχουμε ενεργοποιήσει Google AdSense/,/Δεν υπάρχει ακόμη ενεργ/,/δεν έχει οριστικοποιηθεί/,/πριν από αίτηση ενεργοποίησης AdSense/,/πρέπει ακόμη να δημοσιευτούν/,/χρειάζονται οριστικοποίηση/,/Μελλοντικό AdSense/,/Sportmonks/])
   assert.doesNotMatch(html,stale,n+': '+stale);
 }
 assert.match(page('cookies'),/tiki\.mobile\.fixture\.snapshot\.football-api\.v1/,'the storage key the site really uses');
});

// Without ?lang=el the legal routes serve these English pages, and that is what reviewers read.
const worker=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
const english=JSON.parse(worker.match(/^const LEGAL_ENGLISH=(.*);$/m)[1]);
const text=n=>english[n].sections.map(([h,b])=>h+' '+b).join(' ');
test('the English legal pages served by default say the same as the Greek ones',()=>{
 for(const n of ['privacy','contact','about','terms']){assert.match(text(n),/Nicolaos Metaxa/,n);assert.match(text(n),/mailto:tikidatainfo@gmail\.com/,n)}
 for(const n of ['privacy','cookies','terms','about'])assert.match(text(n),/Google AdSense/,n);
 for(const n of Object.keys(english))
  for(const stale of [/not yet been published/,/still being finalised/,/not enabled by default/,/have not yet activated/,/working on a private support contact/,/before advertising services/])
   assert.doesNotMatch(text(n),stale,n+': '+stale);
});

test('emails are never hidden by Cloudflare, and the CSP lets Google\'s consent message load',()=>{
 for(const n of ['privacy','cookies','contact','about','terms'])
  for(const link of page(n).match(/<a [^>]*href="mailto:[^"]*"[^>]*>[^<]*<\/a>/g)||[])
   assert.ok(page(n).includes('<!--email_off-->'+link+'<!--/email_off-->'),n);
 assert.match(text('contact'),/<!--email_off--><a href="mailto:tikidatainfo@gmail\.com">/);
 const ads=worker.match(/^const ADS_ORIGINS="([^"]*)";$/m)[1],csp=worker.match(/^const CSP="(.*)";$/m)[1];
 assert.ok(ads.split(' ').includes('https://*.google.com'),'fundingchoicesmessages.google.com serves the consent message');
 assert.match(csp,/script-src 'self' https:\/\/pagead2\.googlesyndication\.com "\+ADS_ORIGINS\+"/);
 assert.match(csp,/style-src 'self' 'unsafe-inline'/,'the consent message injects its own styles');
});

test('every page carries Google\'s Privacy & messaging tag, with its snippet served from our origin',()=>{
 const fn=worker.slice(worker.indexOf('function tdAdsensePublisherId('),worker.indexOf('function tdHtmlWithAdsenseVerification('));
 const inject=new Function(fn+worker.slice(worker.indexOf('function tdHtmlWithAdsenseVerification('),worker.indexOf('}',worker.indexOf('function tdHtmlWithAdsenseVerification('))+1)+';return tdHtmlWithAdsenseVerification')();
 const html=inject('<html><head></head><body></body></html>',{});
 assert.match(html,/<script async src="https:\/\/fundingchoicesmessages\.google\.com\/i\/pub-3859805035970267\?ers=1"><\/script><script src="\/fc-present\.js" defer><\/script>/);
 assert.match(html,/adsbygoogle\.js\?client=ca-pub-3859805035970267/);
 assert.match(worker,/if\(path==='\/fc-present\.js'\)return asset\(FC_PRESENT_JS,'application\/javascript; charset=utf-8'\)/);
 const bundled=JSON.parse(worker.match(/^const FC_PRESENT_JS=(.*);$/m)[1]);
 assert.equal(bundled,readFileSync(new URL('../frontend-v13/fc-present.js',import.meta.url),'utf8'));
 assert.match(bundled,/googlefcPresent/);
 for(const n of ['privacy','cookies'])assert.match(page(n),/Πριν προβληθούν διαφημίσεις/,n);
 assert.match(text('privacy'),/Before ads are shown to visitors/);
});
