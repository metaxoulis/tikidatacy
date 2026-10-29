import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {sportmonksArchive,archiveSafeJSON,archiveCursor} from '../frontend/sportmonks-archive.mjs';
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/20261029_sportmonks_raw_archive.sql',import.meta.url),'utf8'));
 sql.exec("INSERT INTO archive_tasks(task,path,params_json) VALUES('fixture','/v3/football/fixtures','{}')");
 const db={prepare(q){let args=[];return {bind(...a){args=a.map(x=>x instanceof ArrayBuffer?new Uint8Array(x):x);return this},async first(){const row=sql.prepare(q).get(...args)||null;if(row?.payload_gzip)row.payload_gzip=Array.from(row.payload_gzip);return row},async all(){return {results:sql.prepare(q).all(...args)}},async run(){const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes),size_after:1024}}}}}};
 return {sql,env:{SPORTMONKS_RAW_0:db,SPORTMONKS_API_TOKEN:'test-secret'}};
}
const request=action=>new Request('https://example.com/api/internal/sportmonks-archive',{method:'POST',body:JSON.stringify({action,pages:4})});
test('the daily archive budget pauses before upstream calls and leaves the cursor unchanged',async()=>{
 const {sql,env}=setup(),original=globalThis.fetch;
 sql.prepare('INSERT INTO archive_state(key,value) VALUES(?,?)').run('reserved-pages:'+new Date().toISOString().slice(0,10),'15000');
 globalThis.fetch=async()=>{throw Error('upstream must not be called')};
 try{
  const result=await(await sportmonksArchive(request('step'),env)).json();assert.equal(result.paused,'daily_archive_budget');
  const task=sql.prepare('SELECT page,status FROM archive_tasks').get();assert.equal(task.page,1);assert.equal(task.status,'pending');
 }finally{globalThis.fetch=original}
});
test('credentials are redacted without dropping data fields',()=>{
 const text=archiveSafeJSON({data:[{id:1,nullable:null,nested:{value:0}}],pagination:{next_page:'https://api.sportmonks.com/x?api_token=test-secret&page=2'}},'test-secret');
 assert(!text.includes('test-secret'));assert.equal(JSON.parse(text).data[0].nested.value,0);
});
test('compressed pages round trip exactly and checksum detects corruption; a finished task is not fetched again',async()=>{
 const {sql,env}=setup(),original=globalThis.fetch;let calls=0;
 globalThis.fetch=async u=>{calls++;const page=Number(new URL(u).searchParams.get('page'));return Response.json({data:[{id:page,nested:{zero:0,text:'Ελλάδα'}}],pagination:{has_more:page<2}})};
 try{
  const result=await(await sportmonksArchive(request('step'),env)).json();assert.equal(result.status,'complete');assert.equal(result.pages,2);
  const rows=sql.prepare('SELECT * FROM archive_pages ORDER BY page').all();assert.equal(rows.length,2);
  for(const row of rows){const bytes=gunzipSync(row.payload_gzip);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(JSON.parse(bytes).data[0].nested.text,'Ελλάδα')}
  const previous=calls;await sportmonksArchive(request('step'),env);assert.equal(calls,previous);
 }finally{globalThis.fetch=original}
});
test('rate limiting records an incomplete task and resumes at the first missing page',async()=>{
 const {sql,env}=setup(),original=globalThis.fetch;let fail=true;
 globalThis.fetch=async u=>{const page=Number(new URL(u).searchParams.get('page'));return fail&&page===2?Response.json({message:'rate limit'},{status:429}):Response.json({data:[{id:page}],pagination:{has_more:page<3}})};
 try{
  const result=await(await sportmonksArchive(request('step'),env)).json();assert.equal(result.status,'retry');assert.equal(result.next_page,2);assert.equal(result.pages,1);
  assert.equal(sql.prepare('SELECT count(*) n FROM archive_pages').get().n,1);
  fail=false;sql.exec('UPDATE archive_tasks SET lease_until=0');
  const resumed=await(await sportmonksArchive(request('step'),env)).json();assert.equal(resumed.status,'complete');
  assert.equal(sql.prepare('SELECT records FROM archive_tasks').get().records,3);assert.equal(sql.prepare('SELECT count(*) n FROM archive_pages').get().n,3);
 }finally{globalThis.fetch=original}
});

test('deep exports recover the saved next_cursor rather than repeating an invalid 20,000-row offset',async()=>{
 const {sql,env}=setup(),original=globalThis.fetch;
 const previous={data:[{id:20050}],pagination:{has_more:true,next_cursor:'https://api.sportmonks.com/v3/football/fixtures?cursor=after20050'}};
 sql.prepare("INSERT INTO archive_pages VALUES('fixture',401,'/v3/football/fixtures','{}',?,'previous',50,100,100,'t')").run(gzipSync(JSON.stringify(previous)));
 sql.exec("UPDATE archive_tasks SET page=402,records=20050,pages=401");
 const calls=[];
 globalThis.fetch=async u=>{const url=new URL(u),cursor=url.searchParams.get('cursor');calls.push(cursor);assert.equal(url.searchParams.has('page'),false);
  return Response.json({data:[{id:cursor==='after20050'?20051:20052}],pagination:{has_more:cursor==='after20050',next_cursor:cursor==='after20050'?'https://api.sportmonks.com/v3/football/fixtures?cursor=after20051':null}})};
 try{
  const result=await(await sportmonksArchive(request('step'),env)).json();assert.equal(result.status,'complete');assert.equal(result.next_page,404);
  assert.deepEqual(calls,['after20050','after20051']);assert.equal(sql.prepare('SELECT records FROM archive_tasks').get().records,20052);
  assert.throws(()=>archiveCursor('https://example.com/?cursor=secret'),/unapproved_cursor_origin/);
 }finally{globalThis.fetch=original}
});
