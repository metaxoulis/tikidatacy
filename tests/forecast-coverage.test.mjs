import test from 'node:test';
import assert from 'node:assert/strict';
import {cvPoisson,cvForecastAll,cvBuildHistory,cvForecast} from '../frontend/forecast-coverage.mjs';
const league={provider:'sportapi',league_id:'24',league:'Test League'};
const future='2099-10-17T19:00:00Z';
const match=(id,home,away,extra={})=>({...league,id:String(id),home,away,home_id:String(home),away_id:String(away),date:future,status:'NS',...extra});
test('every returned fixture receives all seven coherent probabilities',()=>{
 const games=Array.from({length:200},(_,i)=>match(i,'H'+i,'A'+i));
 const out=cvForecastAll(games);
 assert.equal(out.length,games.length);
 for(const {model} of out){
  assert.equal(model.method,'generic_poisson_prior_no_team_data');assert.equal(model.confidence,'very_low');assert.equal(model.validated,false);
  for(const key of ['p1','px','p2','over25','under25','btts','no_btts'])assert(Number.isFinite(model[key])&&model[key]>=0&&model[key]<=100);
  assert(Math.abs(model.p1+model.px+model.p2-100)<1e-7);
  assert(Math.abs(model.over25+model.under25-100)<1e-7);
  assert(Math.abs(model.btts+model.no_btts-100)<1e-7);
 }
});
test('historic results contribute only when they occurred BEFORE kickoff and same provider / league',()=>{
 const base=['2099-10-10T11:00:00Z','2099-10-11T11:00:00Z','2099-10-12T11:00:00Z','2099-10-18T11:00:00Z'];
 const history=base.flatMap((date,i)=>[match('h'+i,'A','X'+i,{date,status:'FT',home_score:3,away_score:0}),match('a'+i,'Y'+i,'B',{date,status:'FT',home_score:0,away_score:1})]);
 const game=match('fixture','A','B');
 const modeled=cvForecast(game,cvBuildHistory(history));
 assert.equal(modeled.coverage,'recent_finished_fixtures');assert.equal(modeled.sample_size.home,3);assert.equal(modeled.sample_size.away,3);
 const trimmed=cvForecast(game,cvBuildHistory(history.filter(x=>Date.parse(x.date)<Date.parse(future))));
 assert.deepEqual(modeled,trimmed);
 const spoof=cvForecast(game,cvBuildHistory(history.map(x=>({...x,provider:'allsportsapi'}))));
 assert.equal(spoof.confidence,'very_low');
});
test('finished/started matches marked as retrospective, never claimed as historical forecasts',()=>{
 const f=match(1,'A','B',{date:'2020-01-01T13:00:00Z',status:'FT',home_score:1,away_score:1});
 const model=cvForecastAll([f])[0].model;assert.equal(model.retrospective,true);assert.equal(model.validated,false);
});
test('verified standings inputs take precedence without a fake accuracy certification',()=>{
 const sample={...cvPoisson(1.7,1.0),method:'provisional_poisson_standings'};
 const x=cvForecastAll([match(3,'A','B')],new Map([['3',sample]]))[0].model;
 assert.equal(x.coverage,'team_standings');assert.equal(x.confidence,'experimental');assert.equal(x.validated,false);
});
