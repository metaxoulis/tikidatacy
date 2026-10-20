-- Tiki-Data 2026-27 exact-fixture Sportmonks team-ID recovery
-- Applied to production D1 on 2026-10-20. Idempotent for rebuilds.
-- Before: 903 eligible results. Exactly 162 rows recovered. After: 1,065.
-- Source of identity: SAME fixture_id, teams, league, match date and final score
-- already present in independently stored UEFA verified match evidence.
-- Do NOT infer IDs from team names alone. Avoid Olympic/Olympiacos collisions.
-- Newer than three UTC calendar days remains excluded from model evidence.
--
-- Optional preflight:
-- SELECT COUNT(*) FROM sportmonks_training_results m
-- JOIN uefa_match_evidence e ON e.fixture_id=m.fixture_id
-- WHERE (m.home_team_id IS NULL OR m.away_team_id IS NULL)
-- AND m.league_key=e.league_key AND m.match_date=e.match_date
-- AND m.home_team=e.home_team AND m.away_team=e.away_team
-- AND m.home_score=e.home_score AND m.away_score=e.away_score;

UPDATE sportmonks_training_results AS m
SET home_team_id=COALESCE(m.home_team_id,e.home_team_id),
    away_team_id=COALESCE(m.away_team_id,e.away_team_id)
FROM uefa_match_evidence AS e
WHERE e.fixture_id=m.fixture_id
  AND m.dataset_slug LIKE '%-2026-27'
  AND m.match_date >= '2026-07-01'
  AND m.match_date < date('now','-3 days')
  AND (m.home_team_id IS NULL OR m.away_team_id IS NULL)
  AND e.home_team_id>0 AND e.away_team_id>0
  AND e.home_team_id<>e.away_team_id
  AND m.league_key=e.league_key AND m.match_date=e.match_date
  AND m.home_team=e.home_team AND m.away_team=e.away_team
  AND m.home_score=e.home_score AND m.away_score=e.away_score
  AND (m.home_team_id IS NULL OR m.home_team_id=e.home_team_id)
  AND (m.away_team_id IS NULL OR m.away_team_id=e.away_team_id);

-- Post-application checks:
-- SELECT count(*) FROM td_2026_27_verified_results; -- 1065 as of 2026-10-20
-- SELECT league_key,count(*) FROM td_2026_27_verified_results GROUP BY league_key;
-- Remaining 154 older records without complete IDs require provider-confirmed
-- identity evidence, not fuzzy name matching.
-- This operation improves historical form coverage only. It does not validate
-- 1X2 probabilities or waive independent chronological calibration checks.
