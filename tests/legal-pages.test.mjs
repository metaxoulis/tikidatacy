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
