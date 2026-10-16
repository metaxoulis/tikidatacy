"""Deterministic research-only numerical tests; no network access or secrets."""
from datetime import date, timedelta
from math import isfinite
import unittest

from learning_engine.advanced import score_probabilities_dc, fit_rho, predict_dc, evaluate_dc
from learning_engine.model import score_probabilities
from learning_engine.sources import Match
from learning_engine.pipeline import quality_gates


def sample_games():
    start=date(2024,8,1)
    clubs=[f'Team {n}' for n in range(10)]
    results=[]
    for n in range(400):
        home=clubs[n%10]
        away=clubs[(n*3+1)%10]
        if home==away:
            away=clubs[(n*3+2)%10]
        h=(n*7+2)%4
        a=(n*11+1)%3
        results.append(Match('en.1','2024-25' if n<200 else '2025-26',
                             start+timedelta(days=n//3),home,away,h,a,'synthetic'))
    return results


class AdvancedNumericTests(unittest.TestCase):
    def test_joint_grid_normalized_and_markets_complementary(self):
        for h,a,rho in [(1.4,1.0,-.09),(.5,2.0,.07),(2.3,1.1,0.)]:
            x=score_probabilities_dc(h,a,rho)
            p=x['p']
            self.assertAlmostEqual(p['home']+p['draw']+p['away'],1.,places=11)
            self.assertAlmostEqual(p['over25']+p['under25'],1.,places=11)
            self.assertAlmostEqual(p['btts']+p['no_btts'],1.,places=11)
            self.assertTrue(all(0<=v<=1 and isfinite(v) for v in p.values()))
            self.assertEqual(len(x['scorelines']),5)
            self.assertTrue(all(0<=v['probability']<=1 for v in x['scorelines']))

    def test_zero_rho_agrees_with_poisson(self):
        for h,a in [(1.6,1.1),(2.4,.7),(1.1,1.7)]:
            base=score_probabilities(h,a)
            dc=score_probabilities_dc(h,a,0)['p']
            for key in ('home','draw','away'):
                self.assertAlmostEqual(base[key],dc[key],places=11)
            self.assertLess(abs(base['over25']-dc['over25']), 2e-6)  # finite 0..12 goal grid vs analytic tail

    def test_positive_correlation_increases_zero_zero(self):
        base=score_probabilities_dc(1.4,1.2,0)
        modified=score_probabilities_dc(1.4,1.2,-.08)
        self.assertGreater(modified['p']['draw'],base['p']['draw'])

    def test_bad_parameters_rejected(self):
        for h,a,rho in [(0,1,0),(1,0,0),(1,1,.3),(4,4,.2)]:
            with self.assertRaises(ValueError):
                score_probabilities_dc(h,a,rho)

    def test_no_model_when_club_history_unknown(self):
        target=Match('en.1','2026-27',date(2026,10,20),'New Club','Other Club',None,None,'x')
        self.assertIsNone(predict_dc(sample_games(),target))

    def test_future_results_do_not_change_rho_or_probability(self):
        games=sample_games()
        target=Match('en.1','2025-26',date(2024,12,8),'Team 1','Team 4',None,None,'x')
        extra=games+[
            Match('en.1','2025-26',target.day,'Team 1','Team 4',20,0,'x'),
            Match('en.1','2025-26',target.day-timedelta(days=1),'Team 1','Team 4',20,0,'x')
        ]
        self.assertEqual(fit_rho(games,target),fit_rho(extra,target))
        self.assertEqual(predict_dc(games,target),predict_dc(extra,target))

    def test_optimization_bounds_and_holdout_result(self):
        games=sample_games()
        target=Match('en.1','2025-26',date(2024,12,8),'Team 1','Team 4',None,None,'x')
        corr=fit_rho(games,target)
        self.assertTrue(-.18<=corr['rho']<=.18)
        self.assertGreater(corr['observations'],80)
        evaluation=evaluate_dc(games,'2025-26',6,180)
        self.assertEqual(evaluation['candidate']['n'],evaluation['independent']['n'])
        self.assertTrue(evaluation['candidate']['n']>=0)
        if evaluation['candidate']['n']:
            self.assertTrue(isfinite(evaluation['candidate']['brier']))

    def test_stale_feed_blocks_release(self):
        now=date(2026,10,16)
        games=[Match('en.1','2026-27',now-timedelta(days=25+n),'A','B',2,1,'x')
               for n in range(4)]
        quality=quality_gates(games,now)
        self.assertFalse(quality['passed'])
        self.assertTrue(any('Stale final-score feed' in reason for reason in quality['reasons']))


if __name__=='__main__':
    unittest.main()
