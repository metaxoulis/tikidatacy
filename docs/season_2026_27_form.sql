-- Tiki-Data factual 2026-27 season evidence.
-- Applies to normalized, provider-confirmed Sportmonks full-time scores only.
-- The season label is taken from the existing dataset_slug, not a guess about club form.
-- UEFA qualifying matches from July 2026 are included.
-- Date cutoff is exclusive: omit matches from the three most recent UTC calendar days.
-- This is descriptive match history, NOT a calibrated 1X2 forecast.
-- A season_id from Sportmonks remains preferable for future generalized ingestion.
CREATE VIEW IF NOT EXISTS td_2026_27_verified_results AS
SELECT fixture_id,dataset_slug,league_key,match_date,home_team_id,away_team_id,
       home_team,away_team,home_score,away_score,observed_at
FROM sportmonks_training_results
WHERE dataset_slug LIKE '%-2026-27'
  AND match_date >= '2026-07-01'
  AND match_date < date('now','-3 days')
  AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  AND home_team_id > 0 AND away_team_id > 0
  AND home_team_id <> away_team_id;

CREATE VIEW IF NOT EXISTS td_2026_27_team_form AS
WITH sides AS (
  SELECT home_team_id AS team_id,home_team AS team_name,league_key,'home' AS venue,
         home_score AS goals_for,away_score AS goals_against
  FROM td_2026_27_verified_results
  UNION ALL
  SELECT away_team_id AS team_id,away_team AS team_name,league_key,'away' AS venue,
         away_score AS goals_for,home_score AS goals_against
  FROM td_2026_27_verified_results
)
SELECT team_id,MAX(team_name) AS team_name,venue,COUNT(*) AS played,
       SUM(CASE WHEN goals_for > goals_against THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN goals_for = goals_against THEN 1 ELSE 0 END) AS draws,
       SUM(CASE WHEN goals_for < goals_against THEN 1 ELSE 0 END) AS losses,
       SUM(goals_for) AS goals_for,SUM(goals_against) AS goals_against,
       SUM(CASE WHEN league_key IN ('ucl','uel','uecl') THEN 1 ELSE 0 END) AS uefa_matches,
       SUM(CASE WHEN league_key NOT IN ('ucl','uel','uecl') THEN 1 ELSE 0 END) AS domestic_matches
FROM sides
GROUP BY team_id,venue;
