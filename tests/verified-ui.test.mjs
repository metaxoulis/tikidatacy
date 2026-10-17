import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('public pages contain no provider branding or switching controls',()=>{
 for(const file of ['frontend-v13/home-v23.html','frontend-v13/predictions.html']){
  const html=read(file);
  assert(!['SportAPI.ai','AllSportsAPI','providerSelect','predictionSource','Πηγή δεδομένων'].some(word=>html.includes(word)),file);
 }
 const home=read('frontend-v13/home-v23.js');
 assert(!home.includes("SportAPI.ai + AllSportsAPI · Ενημερώθηκε"));
 const predictions=read('frontend-v13/app.js');
 assert(predictions.includes("const url='/api/home-focus'"));
 assert(!predictions.includes("$('#predictionSource')"));
});
test('old match centre redirects to prediction-only page in deployed worker',()=>{
 const worker=read('frontend/worker.js');
 assert(worker.includes("Location:'/predictions'"));
 assert(!worker.includes("if(path==='/data'||path==='/data/')return asset(HTML_DATA"));
 assert(worker.includes("focus-home-v4"));
});
