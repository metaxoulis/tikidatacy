"""Regression checks for research-only, time-safe feature extraction."""
import sqlite3
import unittest
from datetime import datetime, timedelta

from research.archive_stats_shadow import build_features, date_folds, _recent_history, _averages


def synthetic_archive():
    db = sqlite3.connect(":memory:")
    db.executescript("""
    CREATE TABLE sm_fixtures (
        id INTEGER, league_id INTEGER, starting_at TEXT,
        home_id INTEGER, away_id INTEGER, home_score INTEGER,
        away_score INTEGER, state TEXT
    );
    CREATE TABLE sm_statistics (fixture_id INTEGER, team_id INTEGER, stat TEXT, value REAL);
    CREATE TABLE sm_xg (fixture_id INTEGER, team_id INTEGER, stat TEXT, value REAL);
    CREATE TEMP TABLE research_xg AS SELECT fixture_id,team_id,stat,value FROM sm_xg;
    """)
    start = datetime(2026, 1, 1)
    for i in range(12):
        date = (start + timedelta(days=4*i)).strftime("%Y-%m-%d %H:%M:%S")
        fixture = i + 1
        db.execute("INSERT INTO sm_fixtures VALUES (?,?,?,?,?,?,?,?)",
                   (fixture, 1, date, 10, 20, 2, 1, "FT"))
        db.executemany("INSERT INTO sm_statistics VALUES (?,?,?,?)",
                       [(fixture, 10, "shots-total", 1000 if i == 11 else 5+i),
                        (fixture, 20, "shots-total", 8+i)])
        db.executemany("INSERT INTO sm_xg VALUES (?,?,?,?)",
                       [(fixture, 10, "5304", 1.3), (fixture, 20, "5304", .8)])
    db.commit()
    # Refresh TEMP copy after the fixture inserts.
    db.execute("DELETE FROM research_xg")
    db.execute("INSERT INTO research_xg SELECT fixture_id,team_id,stat,value FROM sm_xg")
    return db


class ArchiveStatsShadowTests(unittest.TestCase):
    def test_all_observed_stats_included_without_current_match_leak(self):
        with synthetic_archive() as db:
            archive = build_features(db, "2026-03-15", min_observed=1)
        self.assertIn("stat:shots-total", archive["stats"])
        self.assertIn("xg:5304", archive["stats"])
        self.assertEqual(len(archive["columns"]), 2*(2 + 2*len(archive["stats"])))
        fixture_two = next(r for r in archive["rows"] if r["fixture_id"] == 2)
        position = archive["columns"].index("home:stat:shots-total:avg")
        self.assertEqual(fixture_two["x"][position], 5)
        xg_position = archive["columns"].index("home:xg:5304:avg")
        self.assertAlmostEqual(fixture_two["x"][xg_position], 1.3)

    def test_current_future_match_does_not_appear(self):
        with synthetic_archive() as db:
            archive = build_features(db, "2026-02-01", min_observed=1)
        self.assertNotIn(12, {r["fixture_id"] for r in archive["rows"]})

    def test_same_day_forecasts_are_isolated(self):
        with synthetic_archive() as db:
            db.execute("INSERT INTO sm_fixtures VALUES (?,?,?,?,?,?,?,?)",
                       (99, 1, "2026-02-20 21:00:00", 10, 20, 9, 0, "FT"))
            db.executemany("INSERT INTO sm_statistics VALUES (?,?,?,?)",
                           [(99, 10, "shots-total", 9999), (99, 20, "shots-total", 9999)])
            db.execute("INSERT INTO sm_fixtures VALUES (?,?,?,?,?,?,?,?)",
                       (100, 1, "2026-02-20 22:00:00", 10, 20, 0, 2, "FT"))
            db.executemany("INSERT INTO sm_statistics VALUES (?,?,?,?)",
                           [(100, 10, "shots-total", 2), (100, 20, "shots-total", 3)])
            archive = build_features(db, "2026-03-15", min_observed=1)
        first = next(r for r in archive["rows"] if r["fixture_id"] == 99)
        second = next(r for r in archive["rows"] if r["fixture_id"] == 100)
        self.assertEqual(first["x"], second["x"])

    def test_two_season_limit_and_recency_weighting(self):
        kickoff = datetime(2026, 10, 20)
        history = [
            (datetime(2024, 10, 1), {"goals_for": 2, "goals_against": 2, "stat:shots-total": 999}),
            (datetime(2025, 8, 1), {"goals_for": 1, "goals_against": 2, "stat:shots-total": 3}),
            (datetime(2026, 10, 1), {"goals_for": 2, "goals_against": 0, "stat:shots-total": 15}),
        ]
        recent = _recent_history(history, kickoff)
        self.assertEqual(len(recent), 2)
        self.assertEqual(recent[0][0].year, 2025)
        vector = _averages(history, ["stat:shots-total"], kickoff)
        self.assertGreater(vector[2], 10)  # Current season outweighs prior-season stats.
        self.assertLess(vector[2], 15)
        self.assertEqual(vector[3], 2 / 8)

    def test_previous_season_only_never_uses_two_years_back(self):
        kickoff = datetime(2026, 10, 20)
        stale = [(datetime(2024, 5, 1), {"stat:shots-total": 1000})]
        self.assertEqual(_recent_history(stale, kickoff), [])
        self.assertTrue(__import__("math").isnan(_averages(stale, ["stat:shots-total"], kickoff)[2]))

    def test_train_validation_test_dates_do_not_overlap(self):
        rows = [{"date": (datetime(2026,1,1)+timedelta(days=i)).isoformat()}
                for i in range(200) for _ in range(10)]
        train, validation, test, boundaries = date_folds(rows)
        self.assertEqual(len(set(train+validation+test)), len(rows))
        self.assertTrue(max(rows[i]["date"] for i in train) <
                        min(rows[i]["date"] for i in validation))
        self.assertTrue(max(rows[i]["date"] for i in validation) <
                        min(rows[i]["date"] for i in test))


if __name__ == "__main__":
    unittest.main()
