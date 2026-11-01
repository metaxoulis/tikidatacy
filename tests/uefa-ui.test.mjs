import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('all UEFA menus stay visible on days with no games',()=>{
 const j=readFileSync(new URL('../frontend-v13/mobile-ui.js',import.meta.url),'utf8');
 assert.match(j,/const UEFA_FILTERS=/);
 assert.match(j,/const leagues=\[\.\.\.UEFA_FILTERS/);
 assert.match(j,/predictions\?league=/);
 assert.match(j,/Δεν υπάρχουν διαθέσιμοι αγώνες στο τρέχον επταήμερο για αυτή τη διοργάνωση/);
 assert.doesNotMatch(j,/αγώνες από το Sportmonks/,"the site names Football-API as its source");
});
test('bundled mobile UI and its CSS match source',()=>{
 const w=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
 for(const [key,path] of [['MOBILE_UI_JS','mobile-ui.js'],['MOBILE_UI_CSS','mobile-ui.css']]){
   const m=w.match(new RegExp('^const '+key+'=(.*);$','m'));assert.ok(m);
   assert.equal(JSON.parse(m[1]),readFileSync(new URL('../frontend-v13/'+path,import.meta.url),'utf8'));
 }
});
