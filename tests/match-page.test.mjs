import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../frontend-v13/mobile-ui.js',import.meta.url),'utf8');
const helpers=ui.slice(ui.indexOf('function matchCenterForm('),ui.indexOf('function details(){'));
function page(locale){
 const c=vm.createContext({Intl,Date,Number,Math,window:{__tdLocale:locale},E:x=>String(x??''),source:()=>'Ιστορικό ομάδων',badge:()=>'',logoH:()=>null,logoA:()=>null,
  stageLabel:()=>null,valid123:p=>p&&[p.p1,p.px,p.p2].every(Number.isFinite),pct:v=>typeof v==='number'?v+'%':'—',row:(a,b)=>'<row>'+a+'='+b+'</row>',historicalRow:g=>'<game>'+g.home+'</game>'});
 vm.runInContext(helpers+'\nObject.assign(globalThis,{xg3,teamScore,formToken,forecastPanel,formPanel,xgPanel,factsPanel,matchCenterHero});',c);
 return c;
}
// The Karmiotissa – Olympiakos Nicosia page from 2026-10-30: provider names are longer than the history names.
const m={home:'Karmiotissa Pano Polemidion',away:'Olympiakos Nicosia',league:'1st Division',date:'2026-10-30T17:00:00Z',status:'NS',
 p1:17.4,px:23.6,p2:59,over25:46.3,under25:53.7,btts:45.6,most_likely_score:{score:'0-1'},mu_home:0.8102759233229812,mu_away:1.7170298163861881};
const h=(date,home,hs,as,away,result)=>({date,home,away,home_score:hs,away_score:as,result});
const d={history:{home:[h('2026-10-25','Karmiotissa',0,5,'Apollon','L'),h('2026-10-17','Krasava ENY Ypsonas FC',2,1,'Karmiotissa','L'),h('2026-10-09','Karmiotissa',0,3,'Omonia Nicosia','L'),
  h('2026-09-20','Aris Limassol',0,0,'Karmiotissa','D'),h('2026-09-12','Karmiotissa',1,1,'Omonia Aradippou','D')],
 away:[h('2026-10-24','Olympiakos',1,1,'Krasava ENY Ypsonas FC','D'),h('2026-10-11','Olympiakos',1,2,'Aris Limassol','L')],head_to_head:[]},
 current_season_form:{home:{played:4,wins:0,draws:1,losses:3,goals_for:1,goals_against:12},away:{played:3,wins:0,draws:3,losses:0,goals_for:3,goals_against:3}}};

test('expected goals are always given to three decimals, in the reader\'s number format',()=>{
 assert.equal(page('el').xg3(0.8102759233229812),'0,810');
 assert.equal(page('en').xg3(1.7170298163861881),'1.717');
 assert.equal(page('en').xg3(2),'2.000');
 assert.equal(page('en').xg3(null),'—');
 const html=page('el').forecastPanel(m,m,m,false);
 assert.match(html,/0,810/);assert.match(html,/1,717/);
 assert.doesNotMatch(html,/0\.8102759|1\.7170298/,'no raw model floats');
});

test('form comes from each team\'s own history rows even when names differ from the fixture',()=>{
 const c=page('el');
 assert.deepEqual([...c.teamScore(d.history.home[1],m.home)],[1,2],'away loss 2-1: for 1, against 2');
 assert.deepEqual([...c.teamScore(d.history.home[0],m.home)],[0,5]);
 const html=c.formPanel(m,d);
 assert.doesNotMatch(html,/Δεν υπάρχουν καταγεγραμμένοι/);
 assert.match(html,/Γκολ <b>2 : 11<\/b>/);
 const home=html.slice(0,html.indexOf('Olympiakos Nicosia'));
 assert.equal((home.match(/tdm-form-token L/g)||[]).length,3,'three defeats for Karmiotissa');
 assert.match(html,/2026–27 εντός έδρας: 4 αγώνες · 0Ν 1Ι 3Η · 1:12/);
 assert.match(page('en').formPanel(m,d),/2026–27 at home: 4 games · 0W 1D 3L/);
});

test('one language per page: the English page carries no Greek interface text',()=>{
 const c=page('en'),strip=s=>s.replace(/Ιστορικό ομάδων/g,'');
 for(const html of [c.forecastPanel(m,m,m,false),c.formPanel(m,d),c.xgPanel(m,d,false),c.factsPanel(m,d),c.matchCenterHero(m,d,m,false)])
  assert.doesNotMatch(strip(html),/[Ͱ-Ͽ]/,html.slice(0,120));
});

test('the statistics tab separates match xG from the model\'s expected goals',()=>{
 const c=page('el'),pre=c.xgPanel(m,d,false);
 assert.match(pre,/μοντέλο Tiki-Data/);assert.doesNotMatch(pre,/xG αγώνα/);
 const played=c.xgPanel(m,{...d,xg:{available:true,home:1.23456,away:0.4}},false);
 assert.match(played,/xG αγώνα/);assert.match(played,/1,235/);assert.match(played,/0,400/);
});

test('five tabs at most; links to the retired tabs land on the overview',()=>{
 const body=ui.slice(ui.indexOf('function details(){'),ui.indexOf('async function fetchDeep('));
 assert.match(body,/\['summary',L\('Επισκόπηση','Overview'\)\]/);
 for(const gone of ["'analysis'","'info'","'news'"])assert.doesNotMatch(body,new RegExp("\\["+gone+","));
 assert.match(body,/if\(!tabs\.some\(\(\[k\]\)=>k===state\.tab\)\)state\.tab='summary'/);
 assert.doesNotMatch(ui,/data-tab="info"/);
});
