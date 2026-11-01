import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');
const original=readFileSync(new URL('../frontend-v13/cookie-panel.js',import.meta.url),'utf8');
test('the cookie panel is bundled, served, and loaded with Google consent messaging',()=>{
 const bundled=JSON.parse(worker.match(/^const COOKIE_PANEL_JS=(.*);$/m)[1]);
 assert.equal(bundled,original);
 assert.match(worker,/if\(path==='\/cookie-panel\.js'\)return asset\(COOKIE_PANEL_JS,'application\/javascript; charset=utf-8'\)/);
 assert.match(worker,/<script defer src="\/cookie-panel\.js"><\/script>/);
 assert.match(original,/fc\.callbackQueue\.push\(fc\.showRevocationMessage\)/);
 assert.doesNotMatch(original,/(?:document\.cookie|localStorage\.setItem)/);
 assert.match(original,/sessionStorage\.setItem\(KEY/);
 assert.equal(JSON.parse(worker.match(/^const LEGAL_COOKIES=(.*);$/m)[1]),readFileSync(new URL('../frontend-v13/cookies.html',import.meta.url),'utf8'));
 assert.equal(JSON.parse(worker.match(/^const LEGAL_PRIVACY=(.*);$/m)[1]),readFileSync(new URL('../frontend-v13/privacy.html',import.meta.url),'utf8'));
});
