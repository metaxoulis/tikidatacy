"""Read-only chronological research on archived Sportmonks match statistics.

Usage: python -m research.archive_stats_shadow /path/to/exported_archive.sqlite
Requires numpy and scikit-learn. NEVER publishes a production model.
All source columns are local archive columns. No provider secrets are needed.
"""
from __future__ import annotations

import argparse
import json
import math
import sqlite3
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path


FINAL_STATES = ("FT", "AET", "FTP")
EMBARGO_DAYS = 3
WINDOW = 8
HALF_LIFE_DAYS = 60
PREVIOUS_SEASON_WEIGHT = 0.55


def _season_start(kickoff):
    """For any fixture, use its own season and immediately previous season."""
    season_year = kickoff.year if kickoff.month >= 7 else kickoff.year - 1
    return datetime(season_year - 1, 7, 1)


def _current_season_start(kickoff):
    season_year = kickoff.year if kickoff.month >= 7 else kickoff.year - 1
    return datetime(season_year, 7, 1)


def _date(value):
    return datetime.fromisoformat(str(value).replace(" ", "T").replace("Z", "+00:00")).replace(tzinfo=None)


def _valid_number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) and 0 <= n <= 100000 else None
    except (TypeError, ValueError):
        return None


def archive_fields(connection):
    """Use every distinct observed stat, preserving provider namespaces."""
    statistics = ["stat:" + str(row[0]) for row in connection.execute(
        "SELECT DISTINCT stat FROM sm_statistics WHERE stat IS NOT NULL ORDER BY stat")]
    xg = ["xg:" + str(row[0]) for row in connection.execute(
        "SELECT DISTINCT stat FROM sm_xg WHERE stat IS NOT NULL ORDER BY stat")]
    return statistics + xg


def archived_game_stats(connection, fixture_id, home_id, away_id):
    """Current-game statistics are stored only for future matches' features."""
    result = {home_id: {}, away_id: {}}
    for table, prefix in (("sm_statistics", "stat:"), ("research_xg", "xg:")):
        for team, name, value in connection.execute(
            "SELECT team_id, stat, value FROM " + table + " WHERE fixture_id=?",
            (fixture_id,),
        ):
            if team not in result:
                continue
            v = _valid_number(value)
            if v is not None:
                result[team][prefix + str(name)] = v
    return result


def _recent_history(past, kickoff):
    """Exclude anything older than the immediately preceding football season."""
    return [(day, stats) for day, stats in past if _season_start(kickoff) <= day < kickoff][-WINDOW:]


def _averages(past, fields, kickoff):
    """Time-weight only completed previous matches, never current-match statistics."""
    recent = _recent_history(past, kickoff)
    season_boundary = _current_season_start(kickoff)
    weighted = [(row, math.exp(-math.log(2) * max(0, (kickoff - day).total_seconds() / 86400) / HALF_LIFE_DAYS)
                 * (PREVIOUS_SEASON_WEIGHT if day < season_boundary else 1.0))
                for day, row in recent]
    out = []
    for field in ("goals_for", "goals_against", *fields):
        valid = [(row[field], weight) for row, weight in weighted if field in row]
        out.append(sum(v * w for v, w in valid) / sum(w for _, w in valid)
                   if valid else math.nan)
        if field not in ("goals_for", "goals_against"):
            out.append(len(valid) / WINDOW)
    return out


def build_features(connection, asof, min_observed=3):
    """Return chronological, leakage-safe fixture features and immutable labels.

    For a match at kickoff T, only *finished matches played by T-3 days* can
    enter rolling form. Current-match statistics are never used for the row.
    Same-day matches cannot enter each other's features.
    """
    cutoff = _date(asof) - timedelta(days=EMBARGO_DAYS)
    # Neither training labels nor historical inputs may predate the prior season.
    dataset_start = _season_start(_date(asof))
    fields = archive_fields(connection)
    names = ["goals_for", "goals_against"]
    for stat in fields:
        names.extend((stat + ":avg", stat + ":coverage"))
    columns = ["home:" + name for name in names] + ["away:" + name for name in names]
    histories = defaultdict(lambda: deque(maxlen=64))
    pending = deque()
    rows, exclusions = [], defaultdict(int)
    sql = """SELECT id,league_id,starting_at,home_id,away_id,home_score,away_score
             FROM sm_fixtures
             WHERE state IN ('FT','AET','FTP')
               AND home_score BETWEEN 0 AND 15 AND away_score BETWEEN 0 AND 15
               AND starting_at IS NOT NULL
             ORDER BY starting_at,id"""
    for fixture, league, start, home, away, hg, ag in connection.execute(sql):
        if not home or not away or home == away:
            exclusions["invalid_teams"] += 1
            continue
        try:
            kickoff = _date(start)
        except ValueError:
            exclusions["invalid_date"] += 1
            continue
        if kickoff > cutoff:
            exclusions["cutoff"] += 1
            continue
        if kickoff < dataset_start:
            exclusions["older_than_previous_season"] += 1
            continue
        maturity = kickoff - timedelta(days=EMBARGO_DAYS)
        while pending and pending[0][0] <= maturity:
            kickoff_previous, h, a, hstats, astats = pending.popleft()
            histories[h].append((kickoff_previous, hstats))
            histories[a].append((kickoff_previous, astats))
        hhistory, ahistory = histories[home], histories[away]
        # A record with a final score but no statistics can still support
        # goal-form features, not statistical coverage.
        sufficient = all(
            sum(any(k.startswith(("stat:", "xg:")) for k in stats)
                for _, stats in _recent_history(history, kickoff)) >= min_observed
            for history in (hhistory, ahistory)
        )
        if sufficient:
            vector = _averages(hhistory, fields, kickoff) + _averages(ahistory, fields, kickoff)
            rows.append({"fixture_id": fixture, "league_id": league, "date": kickoff.isoformat(),
                         "x": vector, "home_goals": int(hg), "away_goals": int(ag),
                         "outcome": 0 if hg > ag else 1 if hg == ag else 2})
        else:
            exclusions["insufficient_prior_stats"] += 1
        current = archived_game_stats(connection, fixture, home, away)
        pending.append((
            kickoff, home, away,
            {**current[home], "goals_for": float(hg), "goals_against": float(ag)},
            {**current[away], "goals_for": float(ag), "goals_against": float(hg)},
        ))
    return {"columns": columns, "rows": rows, "stats": fields, "exclusions": dict(exclusions)}


def date_folds(rows):
    """Allocate entire UTC kickoff days, not random matches, to each fold."""
    days = sorted(set(r["date"][:10] for r in rows))
    if len(days) < 30:
        raise ValueError("At least 30 distinct dates are required for chronological evaluation")
    first, second = days[max(1, int(len(days) * .6))], days[max(2, int(len(days) * .8))]
    train = [i for i, r in enumerate(rows) if r["date"][:10] < first]
    valid = [i for i, r in enumerate(rows) if first <= r["date"][:10] < second]
    test = [i for i, r in enumerate(rows) if r["date"][:10] >= second]
    if min(len(train), len(valid), len(test)) < 100:
        raise ValueError("Need at least 100 fixtures in each chronological fold")
    return train, valid, test, (first, second)


def evaluate(archive):
    """Compare stat-enhanced research candidates with goal-form baselines.

    The test fold is never used to select hyperparameters. Results stay in
    research: this script deliberately has no Cloudflare write or deploy path.
    """
    import numpy as np
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import log_loss

    rows, columns = archive["rows"], archive["columns"]
    train, valid, test, boundaries = date_folds(rows)
    data = np.asarray([r["x"] for r in rows], dtype=float)
    # Baseline receives exactly the same historical goals and match sample,
    # without current or previous non-goal match statistics.
    baseline_idx = [i for i, col in enumerate(columns) if col.endswith("goals_for") or col.endswith("goals_against")]
    if len(baseline_idx) != 4:
        raise ValueError("Invalid goal-only baseline column mapping")
    def pipeline(c):
        return make_pipeline(SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True),
                             StandardScaler(), LogisticRegression(C=c, max_iter=600, random_state=0))
    def score(y, idx, model, x, classes):
        p = model.predict_proba(x[idx])
        labels = np.arange(classes)
        truth = np.eye(classes)[y[idx]]
        return {"n": len(idx),
                "brier": float(np.mean(np.sum((p - truth) ** 2, axis=1))),
                "log_loss": float(log_loss(y[idx], p, labels=labels))}
    reports = {}
    for target in ("1x2", "over25", "btts"):
        label = lambda r: (r["outcome"] if target == "1x2" else
                           int(r["home_goals"] + r["away_goals"] > 2) if target == "over25" else
                           int(r["home_goals"] > 0 and r["away_goals"] > 0))
        y = np.asarray([label(r) for r in rows])
        classes = 3 if target == "1x2" else 2
        if len(set(y[train])) != classes:
            reports[target] = {"status": "blocked", "reason": "missing target class in train"}
            continue
        candidates = {}
        for kind, indices in (("goals_only", baseline_idx), ("all_history_stats", list(range(len(columns))))):
            x = data[:, indices]
            trials = []
            for c in (.03, .3, 3.):
                m = pipeline(c)
                m.fit(x[train], y[train])
                trials.append((score(y, valid, m, x, classes)["log_loss"], c, m))
            _, c, chosen = min(trials, key=lambda v: v[0])
            candidates[kind] = {"regularization_c": c,
                                "validation": score(y, valid, chosen, x, classes),
                                "test": score(y, test, chosen, x, classes)}
        baseline = candidates["goals_only"]
        enhanced = candidates["all_history_stats"]
        gain_brier = baseline["test"]["brier"] - enhanced["test"]["brier"]
        gain_log = baseline["test"]["log_loss"] - enhanced["test"]["log_loss"]
        reports[target] = {"status": "research_only", "baseline": baseline,
                           "enhanced": enhanced, "test_brier_gain": gain_brier,
                           "test_log_loss_gain": gain_log,
                           "passes_minimum_gain": gain_brier >= .002 and gain_log >= .002}
    return {"status": "RESEARCH_ONLY_NOT_PUBLISHED",
            "rows": len(rows), "statistics_types": len(archive["stats"]),
            "columns": len(columns), "split_boundaries": boundaries,
            "fold_sizes": {"train": len(train), "validation": len(valid), "test": len(test)},
            "exclusions": archive["exclusions"], "targets": reports}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path, help="Local SQLite export of tiki_sportmonks_archive")
    parser.add_argument("--asof", default=datetime.now(timezone.utc).date().isoformat())
    parser.add_argument("--output", type=Path, default=Path("archive_stats_shadow_report.json"))
    args = parser.parse_args()
    # Immutable read-only connection; TEMP tables/indexes are local only.
    with sqlite3.connect("file:" + str(args.database.resolve()) + "?mode=ro", uri=True) as db:
        # xG had no fixture_id index in the original archive. A temporary copy
        # avoids an O(fixtures x xG) full-table scan; the source DB is unchanged.
        db.execute("CREATE TEMP TABLE research_xg AS SELECT fixture_id,team_id,stat,value FROM sm_xg")
        db.execute("CREATE INDEX research_xg_fixture ON research_xg(fixture_id)")
        # Query archived_game_stats temporarily reads the local indexed view.
        archive = build_features(db, args.asof)
    result = evaluate(archive)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"status": result["status"], "rows": result["rows"],
                      "statistics_types": result["statistics_types"], "report": str(args.output)}))


if __name__ == "__main__":
    main()
