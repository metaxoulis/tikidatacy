-- Read-only signal check run inside D1 (tiki_sportmonks_archive) on 2026-10-30.
-- Same recency rule as research/archive_stats_shadow.py: current + previous season only, last 8 games,
-- 60-day half-life, x0.55 for the previous season, 3-day embargo, >=3 prior games with statistics,
-- 60%/80% chronological day cut (the middle validation fold is unused: nothing is tuned here).
-- Models are binned rates fitted on the training fold only: goals-form deciles, shots-on-target deciles,
-- and a 5x5 goals x shots-on-target grid, each shrunk toward the training base rate (m = 10).
WITH fx AS MATERIALIZED (
 SELECT id, starting_at AS d, julianday(starting_at) AS t, home_id, away_id, home_score AS hs, away_score AS aw FROM sm_fixtures
 WHERE state IN ('FT','AET','FTP') AND starting_at >= '2025-07-01' AND starting_at < '2026-10-28'
   AND home_score BETWEEN 0 AND 15 AND away_score BETWEEN 0 AND 15 AND home_id IS NOT NULL AND away_id IS NOT NULL AND home_id <> away_id),
sot AS MATERIALIZED (SELECT s.fixture_id, s.team_id, MAX(s.value) AS v FROM sm_statistics s JOIN fx ON fx.id=s.fixture_id WHERE s.stat='shots-on-target' AND s.value BETWEEN 0 AND 100 GROUP BY s.fixture_id, s.team_id),
tm AS MATERIALIZED (
 SELECT fx.id AS fid, fx.t, fx.d, fx.home_id AS team, fx.hs AS gf, fx.aw AS ga, sh.v AS sf, sa.v AS sa FROM fx LEFT JOIN sot sh ON sh.fixture_id=fx.id AND sh.team_id=fx.home_id LEFT JOIN sot sa ON sa.fixture_id=fx.id AND sa.team_id=fx.away_id
 UNION ALL
 SELECT fx.id, fx.t, fx.d, fx.away_id, fx.aw, fx.hs, sa.v, sh.v FROM fx LEFT JOIN sot sh ON sh.fixture_id=fx.id AND sh.team_id=fx.home_id LEFT JOIN sot sa ON sa.fixture_id=fx.id AND sa.team_id=fx.away_id),
pr AS MATERIALIZED (
 SELECT x.fid, x.team, p.gf, p.ga, p.sf, p.sa,
  exp(-0.6931471805599453*(x.t-p.t)/60.0) * CASE WHEN p.d < ((CASE WHEN CAST(substr(x.d,6,2) AS INT)>=7 THEN CAST(substr(x.d,1,4) AS INT) ELSE CAST(substr(x.d,1,4) AS INT)-1 END) || '-07-01') THEN 0.55 ELSE 1.0 END AS w,
  ROW_NUMBER() OVER (PARTITION BY x.fid, x.team ORDER BY p.t DESC) AS rn
 FROM tm x JOIN tm p ON p.team=x.team AND p.t <= x.t-3 AND p.d >= ((CASE WHEN CAST(substr(x.d,6,2) AS INT)>=7 THEN CAST(substr(x.d,1,4) AS INT)-1 ELSE CAST(substr(x.d,1,4) AS INT)-2 END) || '-07-01')),
ft AS MATERIALIZED (
 SELECT fid, team, SUM(w*gf)/SUM(w) AS gf, SUM(w*ga)/SUM(w) AS ga,
  SUM(CASE WHEN sf IS NOT NULL THEN w*sf END)/SUM(CASE WHEN sf IS NOT NULL THEN w END) AS sf,
  SUM(CASE WHEN sa IS NOT NULL THEN w*sa END)/SUM(CASE WHEN sa IS NOT NULL THEN w END) AS sa,
  SUM(sf IS NOT NULL AND sa IS NOT NULL) AS nstat
 FROM pr WHERE rn<=8 GROUP BY fid, team),
ds AS MATERIALIZED (
 SELECT substr(fx.d,1,10) AS day, fx.hs, fx.aw,
  (h.gf+h.ga+a.gf+a.ga)/2.0 AS tg, (h.sf+h.sa+a.sf+a.sa)/2.0 AS ts,
  (h.gf-h.ga)-(a.gf-a.ga) AS dg, (h.sf-h.sa)-(a.sf-a.sa) AS dsot,
  MIN(h.gf+a.ga, a.gf+h.ga) AS bg, MIN(h.sf+a.sa, a.sf+h.sa) AS bs
 FROM fx JOIN ft h ON h.fid=fx.id AND h.team=fx.home_id JOIN ft a ON a.fid=fx.id AND a.team=fx.away_id
 WHERE h.nstat>=3 AND a.nstat>=3),
days AS MATERIALIZED (SELECT day, ROW_NUMBER() OVER (ORDER BY day)-1 AS i, COUNT(*) OVER () AS n FROM (SELECT DISTINCT day FROM ds)),
cut AS MATERIALIZED (SELECT (SELECT day FROM days WHERE i=CAST(n*0.6 AS INT)) AS c1, (SELECT day FROM days WHERE i=CAST(n*0.8 AS INT)) AS c2 FROM days LIMIT 1),
lab AS MATERIALIZED (
 SELECT e.*, CASE WHEN e.day<cut.c1 THEN 'tr' WHEN e.day>=cut.c2 THEN 'te' END AS sp FROM (
  SELECT 'over25' AS k, day, (hs+aw>2) AS y, tg AS g, ts AS s FROM ds
  UNION ALL SELECT 'btts', day, (hs>0 AND aw>0), bg, bs FROM ds
  UNION ALL SELECT 'home_win', day, (hs>aw), dg, dsot FROM ds) e, cut),
q AS MATERIALIZED (SELECT k, g, s, NTILE(10) OVER (PARTITION BY k ORDER BY g) AS g10, NTILE(10) OVER (PARTITION BY k ORDER BY s) AS s10,
  NTILE(5) OVER (PARTITION BY k ORDER BY g) AS g5, NTILE(5) OVER (PARTITION BY k ORDER BY s) AS s5 FROM lab WHERE sp='tr'),
eg10 AS MATERIALIZED (SELECT k, g10 AS q, MAX(g) AS ub FROM q GROUP BY k, g10),
es10 AS MATERIALIZED (SELECT k, s10 AS q, MAX(s) AS ub FROM q GROUP BY k, s10),
eg5 AS MATERIALIZED (SELECT k, g5 AS q, MAX(g) AS ub FROM q GROUP BY k, g5),
es5 AS MATERIALIZED (SELECT k, s5 AS q, MAX(s) AS ub FROM q GROUP BY k, s5),
bins AS MATERIALIZED (
 SELECT l.k, l.sp, l.y,
  COALESCE((SELECT MIN(e.q) FROM eg10 e WHERE e.k=l.k AND e.ub>=l.g),10) AS b1,
  COALESCE((SELECT MIN(e.q) FROM es10 e WHERE e.k=l.k AND e.ub>=l.s),10) AS b2,
  COALESCE((SELECT MIN(e.q) FROM eg5 e WHERE e.k=l.k AND e.ub>=l.g),5)*10+COALESCE((SELECT MIN(e.q) FROM es5 e WHERE e.k=l.k AND e.ub>=l.s),5) AS b3
 FROM lab l WHERE l.sp IS NOT NULL),
base AS MATERIALIZED (SELECT k, AVG(y) AS p, COUNT(*) AS n FROM bins WHERE sp='tr' GROUP BY k),
r1 AS MATERIALIZED (SELECT b.k, b.b1 AS bin, (SUM(b.y)+10*base.p)/(COUNT(*)+10) AS p FROM bins b JOIN base ON base.k=b.k WHERE b.sp='tr' GROUP BY b.k, b.b1),
r2 AS MATERIALIZED (SELECT b.k, b.b2 AS bin, (SUM(b.y)+10*base.p)/(COUNT(*)+10) AS p FROM bins b JOIN base ON base.k=b.k WHERE b.sp='tr' GROUP BY b.k, b.b2),
r3 AS MATERIALIZED (SELECT b.k, b.b3 AS bin, (SUM(b.y)+10*base.p)/(COUNT(*)+10) AS p FROM bins b JOIN base ON base.k=b.k WHERE b.sp='tr' GROUP BY b.k, b.b3),
sc AS MATERIALIZED (
 SELECT t.k, t.y, base.p AS p0, COALESCE(r1.p,base.p) AS pg, COALESCE(r2.p,base.p) AS ps, COALESCE(r3.p,base.p) AS pb
 FROM bins t JOIN base ON base.k=t.k LEFT JOIN r1 ON r1.k=t.k AND r1.bin=t.b1 LEFT JOIN r2 ON r2.k=t.k AND r2.bin=t.b2 LEFT JOIN r3 ON r3.k=t.k AND r3.bin=t.b3
 WHERE t.sp='te'),
dd AS MATERIALIZED (SELECT k, y, p0, pg, ps, pb, (y-pg)*(y-pg)-(y-pb)*(y-pb) AS dc, (y-pg)*(y-pg)-(y-ps)*(y-ps) AS dsx FROM sc)
SELECT k, (SELECT c1 FROM cut) AS train_before, (SELECT c2 FROM cut) AS test_from, (SELECT n FROM base WHERE base.k=dd.k) AS n_train, COUNT(*) AS n_test, ROUND(AVG(y),4) AS test_rate,
 ROUND(AVG((y-p0)*(y-p0)),5) AS brier_base, ROUND(AVG((y-pg)*(y-pg)),5) AS brier_goals, ROUND(AVG((y-ps)*(y-ps)),5) AS brier_sot, ROUND(AVG((y-pb)*(y-pb)),5) AS brier_goals_x_sot,
 ROUND(AVG(dc),5) AS gain_combined, ROUND(sqrt((AVG(dc*dc)-AVG(dc)*AVG(dc))/COUNT(*)),5) AS se_combined,
 ROUND(AVG(dsx),5) AS gain_sot_only, ROUND(sqrt((AVG(dsx*dsx)-AVG(dsx)*AVG(dsx))/COUNT(*)),5) AS se_sot_only
FROM dd GROUP BY k;
