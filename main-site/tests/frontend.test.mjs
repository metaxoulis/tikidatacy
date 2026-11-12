import assert from 'node:assert/strict';
import test from 'node:test';
import {hasPrediction,PredictionCard,MatchCard} from '../assets/components.js';
import {loadFixtures} from '../assets/data.js';
const mk=(id,p1,px,p2)=>({id,league:'seriea',home:'Frosinone Calcio',away:'Roma',date:new Date(Date.now()+86400000).toISOString(),p1,px,p2,over25:58,under25:42,btts:55,no_btts:45});
test('does not claim a prediction from missing or invalid odds',()=>{
 assert.equal(hasPrediction(mk(1,49,26,25)),true);
 for(const m of [mk(2,null,null,null),mk(3,70,50,-20),mk(4,44,20,20)])assert.equal(hasPrediction(m),false);
});
test('hides unpredicted fixtures without inventing probabilities',async()=>{
 const previous=global.fetch;
 global.fetch=async()=>new Response(JSON.stringify({matches:[mk(1,49,26,25),mk(2,null,null,null)],warnings:[]}));
 try{const result=await loadFixtures({demo:false});assert.deepEqual(result.matches.map(x=>x.id),[1]);assert.equal(result.excluded,1)}finally{global.fetch=previous}
});
test('renders team/league crests and three numeric probability tracks',()=>{
 const match=mk(3,49,26,25),card=PredictionCard({match});
 assert.match(card,/team-crest/);assert.match(card,/league-symbol/);assert.equal((card.match(/prob-track/g)||[]).length,3);
 assert.equal((MatchCard({match}).match(/prob-track/g)||[]).length,3);
});