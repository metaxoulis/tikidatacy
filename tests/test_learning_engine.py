import unittest
from datetime import date, timedelta
from learning_engine.sources import Match, parse_dataset, read_scores
from learning_engine.model import score_probabilities, predict, baseline, eligible_history, metrics
from learning_engine.pipeline import quality_gates, fit_profiles, train, write_reports
import json
from tempfile import TemporaryDirectory
from pathlib import Path

def generate(league='en.1',start=date(2024,8,1),season='2024-25',count=240):
    teams=[f'Team {i}' for i in range(12)]
    out=[]
    for n in range(count):
        home=teams[n % 12]
        away=teams[(n*5+1) % 12]
        if home==away:away=teams[(n*5+2)%12]
        out.append(Match(league,season,start+timedelta(days=n//4),home,away,n%4,(n*7)%3,f'{season}/{league}.json'))
    return out

class ModelTests(unittest.TestCase):
    def test_parse_score_forms(self):
        self.assertEqual(read_scores({'ft':[2,1]}),(2,1))
        self.assertEqual(read_scores([0,0]),(0,0))
        self.assertEqual(read_scores([True,False]),(None,None))
        self.assertEqual(read_scores({'ht':[1,0]}),(None,None))
        self.assertEqual(read_scores(['3','1']),(None,None))

    def test_valid_source(self):
        data=json.dumps({'name':'test','matches':[{'date':'2025-09-01','team1':'A','team2':'B','score':[1,2]}]}).encode()
        rows=parse_dataset(data,'2025-26','en.1')
        self.assertEqual((rows[0].home_goals,rows[0].away_goals),(1,2))
        with self.assertRaises(ValueError):
            parse_dataset(json.dumps({'matches':[{'date':'2025-09-01','team1':'A','team2':'B'},{'date':'2025-09-01','team1':'A','team2':'B'}]}).encode(),'2025-26','en.1')

    def test_normalization(self):
        z=score_probabilities(1.7,1.2)
        self.assertAlmostEqual(z['home']+z['draw']+z['away'],1,places=10)
        self.assertTrue(all(0<=x<=1 for x in z.values()))

    def test_no_same_day_or_recent_result_leakage(self):
        games=generate()
        target=Match('en.1','2024-25',date(2024,10,4),'Team 1','Team 2',1,0,'x')
        original=eligible_history(games,target)
        new=Match('en.1','2024-25',target.day,'Team 1','Team 2',20,0,'x')
        near=Match('en.1','2024-25',target.day-timedelta(days=2),'Team 1','Team 2',20,0,'x')
        self.assertEqual(eligible_history(games+[new,near],target),original)
        self.assertEqual(predict(games,target),predict(games+[new,near],target))
        self.assertEqual(baseline(games,target),baseline(games+[new,near],target))

    def test_missing_history_abstains(self):
        match=Match('gr.1','2026-27',date(2026,10,20),'A','B',None,None,'x')
        self.assertIsNone(predict([],match))
        self.assertIsNone(baseline([],match))

    def test_quality_blocks_recent_missing_scores(self):
        now=date(2026,10,15)
        dates=[now-timedelta(days=i+4) for i in range(10)]
        games=[Match('en.1','2026-27',dt,'A',f'Team{n}',None,None,'x') for n,dt in enumerate(dates)]
        r=quality_gates(games,now)
        self.assertFalse(r['passed'])
        self.assertEqual(r['by_league'][0]['recent_completeness'],0)
        games=[Match(m.league,m.season,m.day,m.home,m.away,1,1,m.dataset) for m in games]
        self.assertTrue(quality_gates(games,now)['passed'])

    def test_never_promote_without_prospective_record(self):
        games=generate()
        r=train(games,asof=date(2026,10,15),manifest=[])
        self.assertEqual(r['candidate_status'],'BLOCKED')
        self.assertTrue(any('independently logged' in s for s in r['blockers']))
        with TemporaryDirectory() as p:
            write_reports(r,Path(p))
            self.assertTrue((Path(p)/'REPORT.md').exists())
            self.assertEqual(json.loads((Path(p)/'candidate_model.json').read_text())['candidate_status'],'BLOCKED')

    def test_profile_does_not_use_future_results(self):
        hist=generate()
        asof=date(2024,10,15)
        a=fit_profiles(hist,asof=asof,prior=6,decay=180)
        more=hist+[Match('en.1','2024-25',asof+timedelta(days=2),'Team 1','Team 2',20,0,'x')]
        self.assertEqual(a,fit_profiles(more,asof=asof,prior=6,decay=180))

    def test_metrics(self):
        m=Match('en.1','2025-26',date(2025,9,1),'A','B',2,1,'x')
        z=metrics([({'home':.7,'draw':.2,'away':.1},m)])
        self.assertEqual(z['n'],1)
        self.assertEqual(z['accuracy'],1)
        self.assertAlmostEqual(z['brier'],.14)

if __name__=='__main__':unittest.main()
