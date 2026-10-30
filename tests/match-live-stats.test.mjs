import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {faDetailStatistics,faDetailXg} from '../frontend/football-primary.mjs';
import {faTrialStatistics} from '../frontend/football-trial.mjs';

const ui=readFileSync(new URL('../frontend-v13/mobile-ui.js',import.meta.url),'utf8');
const slice=(from,to)=>ui.slice(ui.indexOf(from),ui.indexOf(to));
function page(){
 const c=vm.createContext({Intl,Date,Number,Math,window:{__tdLocale:'el'},E:x=>String(x??''),badge:()=>'',logoH:()=>null,logoA:()=>null,
  live:m=>['1ST','2ND','HT','ET'].includes(m.status),faMatch:m=>m.source==='football-api.com',matchLocale:()=>'el-GR'});
 vm.runInContext(slice('const PITCH_LINES=','function lineupPitch(')+'\nfunction L(el,en){return el}\n'+slice('function xg3(','function matchCenterHero(')+
  slice('const statHead=','function newsPanel(')+'\nObject.assign(globalThis,{faPitchLayout,faKeyStats});',c);
 return c;
}
// Nice – Rennes, 2026-10-30, 2nd half: what the provider sent.
const provider=[{type:'attempts_on_goal',home:16,away:14},{type:'corners',home:3,away:6},{type:'expected_goals',home:3.35,away:2.44},
 {type:'possesion',home:47,away:53},{type:'red_cards',home:0,away:0},{type:'shots_on_target',home:7,away:6},{type:'yellow_cards',home:1,away:1}];
const m={home:'Nice',away:'Rennes',status:'2ND',source:'football-api.com'};

test('the provider xG reaches the match page; anything implausible or missing does not',()=>{
 assert.deepEqual(faDetailXg(faTrialStatistics(provider)),{home:3.35,away:2.44,available:true,source:'football-api.com'});
 assert.equal(faDetailXg([{type:'corners',home:3,away:6}]).available,false);
 assert.equal(faDetailXg([{type:'expected_goals',home:3.1,away:null}]).available,false);
 assert.equal(faDetailXg(undefined).available,false);
});

test('the overview shows live xG, possession, shots, corners and cards, and links to the full table',()=>{
 const c=page(),d={statistics:faDetailStatistics(faTrialStatistics(provider)),xg:faDetailXg(faTrialStatistics(provider))};
 const html=c.faKeyStats(m,d);
 assert.match(html,/Live στατιστικά/);
 for(const want of ['<strong>xG</strong><b>3,350</b><b>2,440</b>','<strong>Κατοχή</strong><b>47%</b><b>53%</b>','<strong>Σουτ</strong><b>16</b><b>14</b>',
  '<strong>Σουτ στην εστία</strong><b>7</b><b>6</b>','<strong>Κόρνερ</strong><b>3</b><b>6</b>','<strong>Κόκκινες κάρτες</strong><b>0</b><b>0</b>'])assert.ok(html.includes(want),want);
 assert.match(html,/data-tab="stats"/);
 assert.match(c.faKeyStats({...m,status:'FT'},d),/Στατιστικά αγώνα/);
 assert.equal(c.faKeyStats({...m,status:'NS'},d),'','nothing before kick-off');
 assert.equal(c.faKeyStats({...m,source:'sportmonks'},d),'');
 assert.equal(c.faKeyStats(m,{statistics:[],xg:{available:false}}),'','a competition without statistics shows no empty panel');
 assert.equal(c.faKeyStats(m,{error:'details_unavailable'}),'');
});

const player=(name,position,lateral=.5)=>({name,number:null,position,lateral});
const rennes=()=>[player('Lemaitre','Τερματοφύλακας'),player('Frankowski','Αμυντικός',.1),player('Rouault','Αμυντικός',.4),player('Cresswell','Αμυντικός',.6),
 player('Ait Boudlal','Αμυντικός',.9),player('Rongier','Μέσος',.4),player('Thomasson','Μέσος',.6),player('Al-Taamari','Μεσοεπιθετικός',.1),
 player('Szymanski','Μεσοεπιθετικός',.5),player('Nagida','Μεσοεπιθετικός',.9),player('Dia','Επιθετικός')];

test('one starter without a recorded position is placed by elimination; two are not guessed',()=>{
 const c=page();
 const noKeeper=rennes();noKeeper[0]={...noKeeper[0],position:null};
 const a=c.faPitchLayout(noKeeper,'4-2-3-1');
 assert.equal(a.keeper.name,'Lemaitre','the only player left when nobody else keeps goal');
 assert.equal(a.starters[0].position_source,'inferred_by_elimination');
 const noStriker=rennes();noStriker[10]={...noStriker[10],position:undefined};
 const b=c.faPitchLayout(noStriker,'4-2-3-1');
 assert.equal(b.shape,'4-2-3-1');assert.deepEqual(Array.from(b.rows.at(-1),p=>p.name),['Dia'],'the one line the usual formation is short of');
 const two=rennes();two[10]={...two[10],position:null};two[9]={...two[9],position:null};
 assert.equal(c.faPitchLayout(two,'4-2-3-1'),null);
 const unknownShape=rennes();unknownShape[10]={...unknownShape[10],position:null};
 assert.equal(c.faPitchLayout(unknownShape,null),null,'without a usual formation an outfield gap is not guessed');
 assert.equal(c.faPitchLayout(rennes(),'4-2-3-1').starters.every(p=>!p.position_source),true,'complete lineups are left as they are');
});
