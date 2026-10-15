import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_LOGOS,LEAGUE_LOGOS,teamBadge,leagueIcon,hasPrediction } from '../assets/components.js';
const clubs=['Frosinone Calcio','US Sassuolo Calcio','Arsenal FC','Chelsea FC','FC Bayern München'];
test('real club crests are mapped from provider metadata',()=>{assert.ok(Object.keys(TEAM_LOGOS).length>=100); for (const team of clubs){assert.match(TEAM_LOGOS[team],/^https:\/\/crests\.football-data\.org\//);assert.match(teamBadge(team),/data-team-logo/);assert.match(teamBadge(team),/<img /);} });
test('league emblems use image assets for available competitions',()=>{for(const league of ['epl','laliga','seriea','bundesliga','ligue1','ucl']){assert.match(LEAGUE_LOGOS[league],/^https:\/\/crests\.football-data\.org\//);assert.match(leagueIcon(league),/data-league-logo/);} });
test('no invented team logos for unknown names',()=>{assert.doesNotMatch(teamBadge('Nonexistent Sports FC'),/data-team-logo/);assert.match(teamBadge('Nonexistent Sports FC'),/crest-art/);});
test('model validity untouched',()=>{assert.equal(hasPrediction({p1:null,px:null,p2:null}),false);assert.equal(hasPrediction({p1:50,px:25,p2:25}),true);});
