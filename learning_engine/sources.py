"""CC0 OpenFootball ingestion with strict validation and source provenance."""
from __future__ import annotations
import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime, timezone
from urllib.request import Request, urlopen
from typing import Any

SEASONS = ('2024-25', '2025-26', '2026-27')
LEAGUES = ('en.1', 'de.1', 'es.1', 'it.1', 'fr.1')
DATASETS = tuple((season, league) for season in SEASONS for league in LEAGUES) + (
    ('2024-25', 'gr.1'), ('2025-26', 'gr.1'))
RAW_BASE = 'https://raw.githubusercontent.com/openfootball/football.json/master/'
MAX_DOWNLOAD = 1_500_000


@dataclass(frozen=True)
class Match:
    league: str
    season: str
    day: date
    home: str
    away: str
    home_goals: int | None
    away_goals: int | None
    dataset: str

    @property
    def finished(self) -> bool:
        return self.home_goals is not None and self.away_goals is not None


def read_scores(value: Any) -> tuple[int | None, int | None]:
    if isinstance(value, dict):
        value = value.get('ft')
    if isinstance(value, list) and len(value) == 2 and all(type(x) is int and 0 <= x <= 20 for x in value):
        return value[0], value[1]
    return None, None


def parse_dataset(content: bytes, season: str, league: str) -> list[Match]:
    payload = json.loads(content)
    if not isinstance(payload, dict) or not isinstance(payload.get('matches'), list):
        raise ValueError('Expected OpenFootball JSON with matches list')
    fixtures = payload['matches']
    if not 1 <= len(fixtures) <= 2000:
        raise ValueError('Suspicious OpenFootball fixture count')
    out: list[Match] = []
    seen: set[tuple] = set()
    for row in fixtures:
        if not isinstance(row, dict):
            raise ValueError('Invalid fixture row')
        try:
            dt = date.fromisoformat(row['date'])
            home = row['team1'].strip()
            away = row['team2'].strip()
        except (TypeError, ValueError, AttributeError, KeyError) as exc:
            raise ValueError('Fixture missing valid date/team names') from exc
        if not home or not away or home == away or len(home) > 150 or len(away) > 150:
            raise ValueError('Invalid team names')
        if dt.year < int(season[:4]) or dt.year > int(season[:4]) + 1:
            raise ValueError('Fixture date inconsistent with season')
        key = (dt, home, away)
        if key in seen:
            raise ValueError('Duplicate fixture identity')
        seen.add(key)
        home_g, away_g = read_scores(row.get('score'))
        out.append(Match(league, season, dt, home, away, home_g, away_g, f'{season}/{league}.json'))
    return out


def download_dataset(season: str, league: str, *, timeout: int = 20) -> tuple[list[Match], dict]:
    if (season, league) not in DATASETS:
        raise ValueError('Dataset not on approved allowlist')
    path = f'{season}/{league}.json'
    url = RAW_BASE + path
    req = Request(url, headers={'Accept': 'application/json', 'User-Agent': 'Tiki-Data-Learning-Engine/1.0'})
    with urlopen(req, timeout=timeout) as reply:
        if reply.status != 200:
            raise OSError(f'OpenFootball source HTTP {reply.status}')
        data = reply.read(MAX_DOWNLOAD + 1)
    if len(data) > MAX_DOWNLOAD:
        raise ValueError('Unexpectedly large source dataset')
    matches = parse_dataset(data, season, league)
    meta = {'path': path, 'url': url, 'sha256': hashlib.sha256(data).hexdigest(),
            'records': len(matches), 'finished': sum(m.finished for m in matches),
            'fetched_at_utc': datetime.now(timezone.utc).isoformat(timespec='seconds')}
    return matches, meta


def dataset_integrity(all_matches: list[Match]) -> None:
    if not all_matches:
        raise ValueError('Zero matches')
    seen = set()
    for m in all_matches:
        key = (m.dataset, m.day, m.home, m.away)
        if key in seen:
            raise ValueError('Duplicate across downloaded dataset')
        seen.add(key)
