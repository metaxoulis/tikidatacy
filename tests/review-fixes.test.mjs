import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Findings of the 2 November 2026 site review.
const ui=readFileSync(new URL('../frontend-v13/mobile-ui.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../frontend/worker.js',import.meta.url),'utf8');

test('kick-off times use one time zone everywhere: the visitor\'s, labelled',()=>{
 assert.doesNotMatch(ui,/Asia\/Nicosia/,'cards used local time while the match page used Cyprus time');
 assert.doesNotMatch(ui,/L\('ώρα Κύπρου','Cyprus time'\)/);
 assert.match(ui,/const localTime=d=>L\('τοπική ώρα','local time'\)/);
 assert.match(ui,/'<time datetime="'\+E\(m\.date\)\+'">'\+E\(kickoff\)\+' · '\+E\(localTime\(m\.date\)\)\+'<\/time>'/);
});

test('the homepage "today" figures count today only; the week is on the button',()=>{
 assert.match(ui,/stat\(todayAll\.length,t\('αγώνες σήμερα','matches today'\)\)/);
 assert.match(ui,/todayAll=state\.matches\.filter\(m=>dayKey\(m\.date\)===today\)/);
 assert.match(ui,/t\('Όλοι οι αγώνες','All matches'\)\+\(loading\?'':' \('\+state\.matches\.length\+'\)'\)/);
});

test('match cards are crawlable links, not ARIA buttons',()=>{
 assert.match(ui,/<article class="tdm-card tdm-match-compact" data-open="'\+E\(m\.id\)\+'"><a class="tdm-card-link" href="\/predictions\?match='\+encodeURIComponent\(m\.id\)\+'">/);
 assert.doesNotMatch(ui,/class="tdm-card tdm-match-compact" role="button"/);
 assert.match(ui,/if\(e\.target\.closest\('a\[href\]'\)&&\(e\.ctrlKey\|\|e\.metaKey\|\|e\.shiftKey\|\|e\.altKey\)\)return;e\.preventDefault\(\);openMatch/,'a modified click still opens a new tab');
});

test('canonical, language alternates and description follow in-app navigation',()=>{
 assert.match(ui,/function syncHead\(\)/);
 assert.match(ui,/try\{syncHead\(\)\}catch\{\}\}/);
 for(const sel of ['link[rel="canonical"]','meta[name="description"]','meta[name="robots"]','meta[property="og:url"]'])assert.ok(ui.includes("tag('"+sel+"'"),sel);
 assert.match(ui,/for\(const \[lang,gr\] of \[\['en',false\],\['el',true\],\['x-default',false\]\]\)/);
 const locale=JSON.parse(worker.match(/^const LOCALE_JS=(.*);$/m)[1]);
 assert.doesNotMatch(locale,/document\.title='Tiki-Data — Football Intelligence/,'English mode no longer pins one generic title');
 assert.doesNotMatch(locale,/meta\.content='Live football scores, 1X2 predictions/);
});

test('Football-API match pages get their own SEO tags and are listed in the sitemap',()=>{
 const id=String.raw`/^(?:sportmonks|football-api(?:-fixture)?)-[1-9]\d{0,13}$/`;
 assert.ok(worker.includes("if(id&&"+id+".test(id)){"),'seoPage');
 assert.ok(worker.includes("if(m&&"+id+".test(m.id||'')&&m.home&&m.away)entries.push"),'sitemap');
});

test('the CSP admits the Cloudflare Web Analytics beacon, which the privacy policy discloses',()=>{
 const csp=worker.match(/^const CSP="(.*)";$/m)[1];
 assert.match(csp,/script-src [^;]*https:\/\/static\.cloudflareinsights\.com/);
 assert.match(csp,/connect-src [^;]*https:\/\/cloudflareinsights\.com/);
 assert.match(readFileSync(new URL('../frontend-v13/privacy.html',import.meta.url),'utf8'),/Cloudflare Web Analytics/);
 assert.match(JSON.parse(worker.match(/^const LEGAL_ENGLISH=(.*);$/m)[1]).privacy.sections.map(x=>x[1]).join(' '),/Cloudflare Web Analytics/);
});
