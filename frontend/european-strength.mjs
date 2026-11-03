/*
 * Tiki-Data cross-competition research feature.
 *
 * A chronological, opponent-relative EUROPEAN Elo anchor. This is NOT the
 * official UEFA coefficient table or a claim of calibrated 1X2 skill.
 * Only verified historical UEFA full-time scores with stable identities
 * should be passed to this function. It uses no D1 reads and no network.
 */
const EUROPEAN_KEYS = new Set(['ucl', 'uel', 'uecl']);
const DAY_MS = 86400000;
const limited = (x, a, b) => Math.max(a, Math.min(b, x));

export function fitEuropeanStrength(rows, teamKey, identity, asOfDate = new Date()) {
  if (typeof teamKey !== 'function') throw new TypeError('teamKey_required');
  const now = new Date(asOfDate);
  if (!Number.isFinite(now.getTime())) throw new TypeError('invalid_as_of_date');
  const cutoff = Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00Z') - 3 * DAY_MS;
  const seen = new Set(), matches = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const league = String(row?.dataset_slug || '').split('-').slice(0, -2).join('-');
    if (!EUROPEAN_KEYS.has(league)) continue;
    const day = Date.parse(String(row.match_date || '') + 'T00:00:00Z');
    const homeGoals = row.home_score, awayGoals = row.away_score;
    if (!Number.isFinite(day) || day >= cutoff ||
        !Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) ||
        homeGoals < 0 || homeGoals > 15 || awayGoals < 0 || awayGoals > 15) continue;
    const home = teamKey(row.home_team, row.home_team_id, identity);
    const away = teamKey(row.away_team, row.away_team_id, identity);
    if (!home || !away || home === away) continue;
    const key = String(row.match_date) + '|' + home + '|' + away;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({day, home, away, homeGoals, awayGoals});
  }
  matches.sort((a, b) => a.day - b.day || a.home.localeCompare(b.home) || a.away.localeCompare(b.away));

  const clubs = Object.create(null);
  const get = k => clubs[k] || (clubs[k] = {elo: 1500, matches: 0});
  for (const m of matches) {
    const h = get(m.home), a = get(m.away);
    const expectation = 1 / (1 + Math.pow(10, (a.elo - h.elo - 55) / 400));
    const observed = m.homeGoals > m.awayGoals ? 1 : m.homeGoals === m.awayGoals ? .5 : 0;
    const margin = 1 + .12 * Math.min(3, Math.abs(m.homeGoals - m.awayGoals));
    const change = 24 * margin * (observed - expectation);
    h.elo = limited(h.elo + change, 1200, 1800);
    a.elo = limited(a.elo - change, 1200, 1800);
    h.matches++;
    a.matches++;
  }
  return {method: 'historical_uefa_opponent_elo_v1', cutoff: new Date(cutoff).toISOString().slice(0, 10),
    trained_matches: matches.length, clubs: Object.fromEntries(Object.entries(clubs).map(([k, v]) =>
      [k, {elo: Number(v.elo.toFixed(4)), matches: v.matches}]))};
}

/*
 * Research-only symmetric adjustment to goal intensities. If either club has
 * insufficient UEFA history, apply NO adjustment. No forced favourite.
 * Official coefficients may be added later only as dated, verified snapshots
 * and must be evaluated independently of this historical-Elo feature.
 */
export function europeanGoalShift(fixture, model, teamKey) {
  const unused = {log_shift: 0, applied: false, reason: 'insufficient_verified_european_history'};
  if (!EUROPEAN_KEYS.has(fixture?.league_key) ||
      typeof teamKey !== 'function' ||
      model?.european_strength?.method !== 'historical_uefa_opponent_elo_v1')
    return {...unused, reason: 'not_applicable'};
  const ratings = model.european_strength.clubs;
  const homeKey = teamKey(fixture.home, fixture.home_id, model.team_identity);
  const awayKey = teamKey(fixture.away, fixture.away_id, model.team_identity);
  if (!homeKey || !awayKey || homeKey === awayKey) return {...unused, reason: 'invalid_team_identity'};
  const h = ratings?.[homeKey], a = ratings?.[awayKey];
  if (!h || !a || h.matches < 3 || a.matches < 3) return unused;
  const support = Math.min(h.matches, a.matches);
  const reliability = support / (support + 8);
  const logShift = limited(.35 * ((h.elo - a.elo) / 400) * reliability, -.35, .35);
  return {log_shift: logShift, applied: true, method: 'historical_uefa_opponent_elo_v1',
    confidence: 'experimental_unvalidated', european_samples: {home: h.matches, away: a.matches},
    home_elo: h.elo, away_elo: a.elo};
}
