// The API token and Poisson calculations remain entirely in Cloudflare Pages server code.
// This module handles only public, already-computed fixture probabilities.
import {hasPrediction} from './components.js?v=9';
const API_URL='/api/fixtures';
const demoFixtures=()=>[
 {id:'demo-1',league:'ucl',home:'Orion FC',away:'Vega City',date:new Date(Date.now()+3600000*18).toISOString(),p1:48,px:27,p2:25,over25:58,under25:42,btts:62,no_btts:38},
 {id:'demo-2',league:'epl',home:'Riverton Athletic',away:'Northbridge',date:new Date(Date.now()+3600000*30).toISOString(),p1:52,px:24,p2:24,over25:61,under25:39,btts:59,no_btts:41},
 {id:'demo-3',league:'laliga',home:'Catalina',away:'Seaside United',date:new Date(Date.now()+3600000*45).toISOString(),p1:57,px:23,p2:20,over25:63,under25:37,btts:51,no_btts:49},
 {id:'demo-4',league:'seriea',home:'Alba Sporting',away:'Torino Stars',date:new Date(Date.now()+3600000*58).toISOString(),p1:49,px:26,p2:25,over25:56,under25:44,btts:55,no_btts:45},
 {id:'demo-5',league:'bundesliga',home:'Ruhr City',away:'Bavaria 04',date:new Date(Date.now()+3600000*67).toISOString(),p1:46,px:25,p2:29,over25:66,under25:34,btts:64,no_btts:36}
];
let pending;
export async function loadFixtures({demo=false}={}){
 if(demo)return {matches:demoFixtures(),demo:true,warnings:[],status:'demo',coverage:[]};
 if(!pending)pending=(async()=>{
   const response=await fetch(API_URL,{cache:'no-store'});
   let body;try{body=await response.json()}catch{throw Error('Η πηγή δεδομένων δεν επέστρεψε JSON.')}
   if(!response.ok)throw Error(body?.message||'Αδυναμία λήψης δεδομένων.');
   if(!Array.isArray(body.matches))throw Error('Μη έγκυρη μορφή δεδομένων αγώνων.');
   // Normalize only; never invent results if the API returned zero fixtures.
   const candidates=body.matches.filter(m=>m&&m.id!=null&&m.home&&m.away&&m.date&&Number.isFinite(Date.parse(m.date)));
   const matches=candidates.filter(hasPrediction).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
   const excluded=candidates.length-matches.length;
   const warnings=Array.isArray(body.warnings)?[...body.warnings]:[];
   if(excluded)warnings.push(excluded+' αγώνες χωρίς έγκυρη πρόβλεψη αποκρύφτηκαν από τη λίστα.');
   return {matches,demo:false,warnings,status:'ready',coverage:body.coverage||[],excluded,generated_at:body.generated_at};
 })().catch(err=>{pending=null;throw err});
 return pending;
}
export function chooseFeatured(matches){return matches.find(hasPrediction)||matches[0]||null}