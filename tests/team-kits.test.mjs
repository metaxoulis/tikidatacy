import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {faTeamKit,faMatchKits} from '../frontend/team-kits.mjs';

test('known clubs get their traditional colours; unknown clubs keep the neutral token',()=>{
 assert.deepEqual(faTeamKit(24),{primary:'#ee2523',secondary:'#ffffff',pattern:'stripes',source:'club_colours'});
 assert.equal(faTeamKit(135).pattern,'hoops');assert.equal(faTeamKit(141).pattern,'halves');assert.equal(faTeamKit(586).pattern,'band');
 assert.equal(faTeamKit(999999),null);
 assert.deepEqual(faMatchKits(24,999999),{home:faTeamKit(24),away:null});
});

test('clashing colours: the away club is shown in its second colour',()=>{
 const k=faMatchKits(137,7);
 assert.equal(k.home.primary,'#e20a17');
 assert.deepEqual(k.away,{primary:'#ffffff',secondary:'#c8102e',pattern:'plain',source:'club_colours_alternate'});
 assert.equal(faMatchKits(79,9).away.primary,'#ffffff','black against black');
 assert.equal(faMatchKits(24,22).away.source,'club_colours','red and blue stay as they are');
});

test('every listed kit is well formed and keyed by a team in the badge table',()=>{
 const src=readFileSync(new URL('../frontend/team-kits.mjs',import.meta.url),'utf8');
 const ids=[...src.matchAll(/(\d+):\['(#[0-9a-f]{6})','(#[0-9a-f]{6})','(plain|stripes|hoops|halves|band)'\]/g)];
 assert.ok(ids.length>140);
 assert.equal(new Set(ids.map(m=>m[1])).size,ids.length,'no club listed twice');
 for(const m of ids)assert.ok(faTeamKit(Number(m[1])),m[1]);
});
