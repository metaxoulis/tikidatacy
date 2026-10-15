import {test} from "node:test";
import assert from "node:assert/strict";
import {teamBadge,leagueBadge,MatchCard,hasPrediction,fairOdd} from "../assets/components.js";
const match={id:1,home:"Frosinone Calcio",away:"US Sassuolo Calcio",league:"seriea",date:"2026-10-17T18:45:00Z",p1:47.8,px:23.6,p2:28.6,over25:55,under25:45,btts:53,no_btts:47};
test("logos are original illustrative assets with per-team identities",()=>{const a=teamBadge(match.home),b=teamBadge(match.away);assert.match(a,/team-crest/);assert.match(b,/team-crest/);assert.notEqual(a,b);assert.match(leagueBadge("seriea"),/league-identity/)});
test("fair odds are mathematical model probabilities, never bookmaker quotes",()=>{assert.equal(fairOdd(50),"2.00");assert.equal(fairOdd(25),"4.00");assert.equal(fairOdd(0),"—");assert.equal(fairOdd(NaN),"—")});
test("do not invent predictions",()=>{assert.equal(hasPrediction(match),true);const m={...match,p1:null,px:null,p2:null};assert.equal(hasPrediction(m),false);assert.doesNotMatch(MatchCard({match:m}),/ΘΕΩΡΗΤΙΚΗ ΑΠΟΔΟΣΗ/)});
test("model summaries keep probabilities intact",()=>{const html=MatchCard({match});assert.match(html,/47.8%|48%/);assert.match(html,/ΘΕΩΡΗΤΙΚΗ ΑΠΟΔΟΣΗ/);assert.match(html,/ΔΕΝ είναι τιμή στοιχηματικής/)});
