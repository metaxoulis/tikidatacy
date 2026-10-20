import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitEuropeanStrength, europeanGoalShift} from '../frontend/european-strength.mjs';

const teamKey = (name, id) => Number.isInteger(id) ? 'sportmonks:' + id : String(name).toLowerCase();
const fixture = (home_id, away_id, league_key = 'ucl') =>
  ({home: 'Home', away: 'Away', home_id, away_id, league_key});

test('historical UEFA opponent ranking is chronological, deduplicated and embargoed', () => {
  const records = [];
  for (let i = 0; i < 10; i++) {
    const day = '2026-09-' + String(i + 1).padStart(2, '0');
    records.push({dataset_slug: 'ucl-2026-27', match_date: day,
      home_team: 'Benfica', away_team: 'Peer', home_team_id: 605, away_team_id: 300,
      home_score: 2, away_score: 0});
    records.push({dataset_slug: 'uel-2026-27', match_date: day,
      home_team: 'Peer2', away_team: 'Omonia', home_team_id: 400, away_team_id: 700,
      home_score: 2, away_score: 0});
  }
  records.push({...records[0]}); // duplicate venue / fixture
  records.push({...records[0], match_date: '2026-10-20'}); // too recent
  records.push({...records[0], dataset_slug: 'sm462-2026-27'}); // not UEFA
  const snap = fitEuropeanStrength(records, teamKey, null, new Date('2026-10-21T00:00:00Z'));
  assert.equal(snap.trained_matches, 20);
  assert.equal(snap.clubs['sportmonks:605'].matches, 10);
  assert.ok(snap.clubs['sportmonks:605'].elo > 1500);
  assert.ok(snap.clubs['sportmonks:700'].elo < 1500);
  const model = {european_strength: snap};
  const adj = europeanGoalShift(fixture(605, 700), model, teamKey);
  assert.ok(adj.applied);
  assert.ok(adj.log_shift > 0 && adj.log_shift <= .35);
  assert.equal(europeanGoalShift(fixture(700, 605), model, teamKey).log_shift, -adj.log_shift);
  assert.equal(europeanGoalShift(fixture(605, 700, 'epl'), model, teamKey).applied, false);
  assert.equal(europeanGoalShift(fixture(605, 999), model, teamKey).applied, false);
  const snapshotWithFuture = fitEuropeanStrength([...records, {...records[0],
    match_date: '2099-01-01', home_score: 15}], teamKey, null, new Date('2026-10-21T00:00:00Z'));
  assert.deepEqual(snapshotWithFuture, snap);
});

test('ambiguous identities are not equated across countries', () => {
  const identity = (_name, id) => Number.isInteger(id) ? 'sportmonks:' + id : null;
  const snap = fitEuropeanStrength([
    {dataset_slug: 'uecl-2026-27', match_date: '2026-09-01',
      home_team: 'Olympiakos', away_team: 'Olympiacos', home_team_id: 101, away_team_id: 202,
      home_score: 1, away_score: 0}
  ], identity, null, new Date('2026-10-21T00:00:00Z'));
  assert.equal(Object.keys(snap.clubs).length, 2);
  assert.equal(snap.clubs['sportmonks:101'].matches, 1);
  assert.equal(europeanGoalShift(fixture(101, 202), {european_strength: snap}, identity).applied, false);
});

test('embedded Worker candidate is opt-in, default forecast stays unchanged', async () => {
  const code = readFileSync(new URL('../frontend/worker.js', import.meta.url), 'utf8');
  assert.match(code, /\/\* european-strength:start \*\//);
  assert.match(code, /european_strength:fitEuropeanStrength\(rows,fhTeamKey,identity,asOfDate\)/);
  assert.match(code, /options\?\.europeanStrengthPreview\?europeanGoalShift/);
  const {fhTrain, fhEstimate} = await import('data:text/javascript;base64,' +
    Buffer.from(code + '\nexport {fhTrain,fhEstimate};').toString('base64'));
  const rows = [];
  const add = (league, day, h, a, hid, aid, gh, ga) => rows.push({
    dataset_slug: league + '-2026-27', match_date: day, home_team: h, away_team: a,
    home_team_id: hid, away_team_id: aid, home_score: gh, away_score: ga,
    source_provider: 'sportmonks'});
  for (let i = 0; i < 50; i++) {
    const day = new Date(Date.UTC(2026, 4, 1 + i)).toISOString().slice(0, 10);
    add('sm462', day, 'Benfica', 'Porto', 605, 652, 2, 1);
    add('sm253', day, 'Omonia', 'APOEL', 700, 701, 2, 1);
  }
  for (let i = 0; i < 10; i++) {
    const day = '2026-09-' + String(i + 1).padStart(2, '0');
    add('ucl', day, 'Benfica', 'Other Club', 605, 300, 2, 0);
    add('uecl', day, 'Other Club 2', 'Omonia', 400, 700, 2, 0);
  }
  const model = fhTrain(rows, new Date('2026-10-21T00:00:00Z'));
  assert.equal(model.european_strength.trained_matches, 20);
  const f = {home: 'Benfica', away: 'Omonia', home_id: 605, away_id: 700,
    league_key: 'ucl'};
  // The production prediction gate is not bypassed.
  assert.equal(fhEstimate(f, model), null);
  const original = fhEstimate(f, model, {experimentalPreview: true});
  const research = fhEstimate(f, model, {experimentalPreview: true, europeanStrengthPreview: true});
  assert.ok(original && research);
  assert.equal(original.strength.european_preview, null);
  assert.ok(research.strength.european_preview.applied);
  assert.ok(research.p1 > original.p1);
  assert.ok(research.p2 < original.p2);
  assert.ok(Math.abs(research.p1 + research.px + research.p2 - 100) < 0.01);
});
