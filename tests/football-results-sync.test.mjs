import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {faHistoryMatch,faResultRow,faSyncResults,faAuditRow,faForecastLogWrites} from '../frontend/football-primary.mjs';

const sql=f=>readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8');
function d1(sqlite){
 return {prepare(q){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(q).get(...args)||null},
  async all(){return {results:sqlite.prepare(q).all(...args)}},async run(){return sqlite.prepare(q).run(...args)}}},
  async batch(stmts){const out=[];for(const s of stmts)out.push(await s.run());return out}};
}
function env(){
 const tiki=new DatabaseSync(':memory:'),trial=new DatabaseSync(':memory:');
 tiki.exec(sql('20261029_team_badges.sql'));
 const badge=tiki.prepare("INSERT INTO team_badges VALUES(?,?,'',?,X'89',?,'sportmonks_export',?,'exact name','2026-10-29T00:00:00Z')");
 badge.run(17,'Chelsea','image/png','a','sportmonks:team:18');badge.run(19,'Manchester United','image/png','b','sportmonks:team:14');
 tiki.exec(sql('20261029_football_training_results.sql'));tiki.exec(sql('20261029_audit_fixtures.sql'));trial.exec(sql('20261028_football_trial.sql'));
 return {tiki,TIKI_DB:d1(tiki),FOOTBALL_TRIAL_DB:d1(trial),FOOTBALL_API_KEY:'private-key',FOOTBALL_API_KEY_SECRET:'private-secret'};
}
const match=(id,o={})=>({id,status:'FINISHED',date:'2026-10-31',competition:{id:2,name:'Premier League'},home:{id:17,name:'Chelsea',logo:'https://cdn.football-api.com/x?key=private'},
 away:{id:19,name:'Manchester United'},scores:{ft_score:'2 - 1',et_score:'',score:'2 - 1'},...o});
const NOW=Date.parse('2026-11-02T04:00:00Z');

test('history rows keep only whitelisted fields and the 90-minute score',()=>{
 const m=faHistoryMatch(match(5,{scores:{ft_score:'1 - 1',et_score:'2 - 1',score:'2 - 1'}}));
 assert.equal(m.home_score,1);assert.equal(m.away_score,1);assert.ok(!JSON.stringify(m).includes('private'));
 assert.equal(faHistoryMatch(match(6,{status:'IN PLAY'})),null);
 assert.equal(faHistoryMatch(match(7,{scores:{ft_score:''}})),null);
 assert.equal(faHistoryMatch(match(8,{away:{id:17,name:'Chelsea'}})),null);
});
test('teams map to archived Sportmonks identities; unmapped sides and uncovered competitions are skipped',()=>{
 const id=new Map([[17,18],[19,14]]);
 const {row}=faResultRow(faHistoryMatch(match(5)),id,'t');
 assert.equal(row.home_team_id,18);assert.equal(row.away_team_id,14);assert.equal(row.dataset_slug,'epl-2026-27');assert.equal(row.fa_home_id,17);
 assert.equal(faResultRow(faHistoryMatch(match(6,{away:{id:999,name:'Unknown FC'}})),id,'t').skip,'unmapped_team');
 assert.equal(faResultRow(faHistoryMatch(match(7,{competition:{id:154,name:'National League'}})),id,'t').skip,'invalid');
});
test('sync fetches finished results once, stores mapped rows idempotently and reports what it skipped',async()=>{
 const e=env();let calls=0,url;
 const get=async u=>{calls++;url=new URL(u);return Response.json({success:true,data:{match:[match(5),match(6,{away:{id:999,name:'Unknown FC'}})]}})};
 const first=await faSyncResults(e,NOW,get);
 assert.equal(first.status,'ok');assert.equal(first.stored,1);assert.equal(first.skipped.unmapped_team,1);assert.deepEqual(first.unmapped_teams,['Unknown FC (999)']);
 assert.equal(first.from,'2026-10-26');assert.equal(first.to,'2026-11-01');
 assert.equal(url.pathname,'/matches/history.json');assert.equal(url.searchParams.get('competition_id'),'1,2,3,4,5,9,44,244,245,446');
 const again=await faSyncResults(e,NOW,get);
 assert.equal(again.from,'2026-10-29','the next run starts two days before the newest stored result');assert.equal(calls,2);
 await faSyncResults(e,NOW,get);assert.equal(calls,2,'the same window inside six hours reuses the stored page');
 const rows=e.tiki.prepare('SELECT * FROM football_training_results').all();
 assert.equal(rows.length,1);assert.equal(rows[0].home_team_id,18);assert.equal(rows[0].home_score,2);
 const audit=e.tiki.prepare('SELECT * FROM audit_fixtures ORDER BY fixture_id').all();
 assert.equal(audit.length,2,'the audit keeps unmapped clubs too');assert.equal(audit[0].fixture_id,'football-api-5');assert.equal(audit[0].kickoff,'2026-10-31T00:00:00Z');
});
test('sync never reaches further back than 14 days and does nothing without storage',async()=>{
 const e=env();e.tiki.exec("INSERT INTO football_training_results VALUES(1,'epl-2026-27','epl','2026-09-01','A','B',1,2,0,0,3,4,'t')");
 const r=await faSyncResults(e,NOW,async()=>Response.json({success:true,data:{match:[]}}));
 assert.equal(r.from,'2026-10-19');
 assert.equal((await faSyncResults({},NOW)).status,'unavailable');
});

test('audit rows use the public match id, kickoff, stored badges and the 90-minute score',()=>{
 const m=faHistoryMatch(match(5,{fixture_id:900,scheduled:'19:45',scores:{ft_score:'1 - 1',et_score:'2 - 1'}}));
 const a=faAuditRow(m,new Set([17]));
 assert.equal(a.fixture_id,'football-api-fixture-900');assert.equal(a.kickoff,'2026-10-31T19:45:00Z');
 assert.equal(a.home_logo,'/badges/17.png');assert.equal(a.away_logo,null);assert.equal(a.home_score,1);
 assert.equal(faAuditRow({...m,competition_id:154},new Set()),null);
});
test('forecast log: published pre-match forecasts only, more than two hours ahead, once per model cutoff',()=>{
 const binds=[];const env={TIKI_DB:{prepare:q=>{assert.match(q,/INSERT OR IGNORE INTO prospective_forecast_log/);return {bind:(...v)=>{binds.push(v);return {}}}}}};
 const now=Date.parse('2026-10-30T12:00:00Z'),model={model_version:'v11',cutoff:'2026-10-27'};
 const g=(id,o)=>({id,status:'NS',model:{},p1:50,px:30,p2:20,date:'2026-10-30T19:00:00Z',...o});
 const w=faForecastLogWrites(env,[g('football-api-fixture-1'),g('football-api-fixture-2',{date:'2026-10-30T13:30:00Z'}),g('football-api-fixture-3',{model:null}),g('football-api-fixture-4',{status:'1ST'})],model,now);
 assert.equal(w.length,1);assert.deepEqual(binds[0],['football-api-fixture-1:2026-10-30T19:00:00Z','v11','2026-10-27','2026-10-30T12:00:00.000Z',.5,.3,.2]);
 assert.equal(faForecastLogWrites(env,[g('football-api-fixture-1')],model,now).length,0,'already logged for this cutoff');
 assert.equal(faForecastLogWrites(env,[g('football-api-fixture-1')],{...model,cutoff:'2026-10-28'},now).length,1,'a retrained model logs again');
});
test('the scheduled training route runs training again, without Sportmonks steps',()=>{
 const w=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
 assert.match(w,/path==='\/api\/internal\/train'\)return tdRunScheduledTraining\(req,env\)/);
 const body=w.slice(w.indexOf('async function tdRunScheduledTraining('),w.indexOf('async function tdTrainingStatus('));
 assert.doesNotMatch(body,/tdMaybeSyncHistory\(|tdSyncRequestedUefaTeamHistory\(|SPORTMONKS_API_TOKEN/);
 assert.match(body,/faSyncResults\(env\)/);
});
