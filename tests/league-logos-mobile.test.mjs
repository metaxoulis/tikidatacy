import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('league mark renders its real image only, without visible acronym',()=>{
 const source=read('frontend-v13/app.js');
 assert(source.includes("(logo?logoImage(logo,'logo-image league-image'):'<span class=\"league-fallback\">'"));
 assert(!source.includes("'+esc(labbr(s))+(logo?logoImage"));
 assert(source.includes("im.classList.contains('league-image')"));
 assert(source.includes("p.classList.remove('has-real-logo')"));
});
test('verified catalogue logo fallback works on homepage and match cards',()=>{
 const home=read('frontend-v13/home-v23.js');
 assert(home.includes('hKnownTeamLogo(name)'));
 assert(home.includes('hAliases'));
 assert(home.includes('home-crest-logo'));
 assert(home.includes('leagueEmblem(m.league,m.league_logo,m.league_key)'));
 assert(!home.includes('<span class="league-icon">TD</span>'));
 const app=read('frontend-v13/app.js');
 assert(app.includes("competition(m.league,'small-league',m.league_key)"));
});
test('no invalid literal escaped linebreak and viewport-wide mobile cards',()=>{
 const homeCss=read('frontend-v13/home-v23.css');
 assert(!homeCss.includes('\\\\n@media'));
 assert(homeCss.includes('max-width:100%'));
 const css=read('frontend-v13/styles.css');
 assert(css.includes('.league-badge.has-real-logo'));
 assert(css.includes('.td-mobile-teams{width:100%'));
});
