/* SportAPI.ai adapter — server-side only. NEVER import into browser scripts.
 * Authentication: the secret is injected by Cloudflare as env.SPORTAPI_AI_KEY.
 * This module does not estimate predictions. Missing probabilities stay null.
 */
export const SPORTAPI_ENDPOINT = 'https://sportapi.ai/api/fixtures/date/';
const TEAM_MAX = 150;
const MAX_FIXTURES = 600;
const MAX_JSON_BYTES = 950000;
const FINISHED = new Set(['FT','FINISHED','FULL_TIME','AET','PEN','PENALTY_SHOOTOUT']);
const LEAGUES = new Map([
  ['premier league','epl'],['english premier league','epl'],
  ['la liga','laliga'],['spanish la liga','laliga'],
  ['bundesliga','bundesliga'],['german bundesliga','bundesliga'],
  ['serie a','seriea'],['italian serie a','seriea'],
  ['ligue 1','ligue1'],['french ligue 1','ligue1'],
  ['uefa champions league','ucl'],['champions league','ucl'],
  ['uefa europa league','uel'],['europa league','uel'],
  ['uefa conference league','uecl'],['conference league','uecl'],
  ['super league 1','greece'],['super league greece','greece'],
  ['greek super league','greece'],['cypriot first division','cyprus'],
  ['cyprus first division','cyprus']
]);

function safeName(raw) {
  return typeof raw === 'string' && raw.trim().length > 0 && raw.trim().length <= TEAM_MAX
    ? raw.trim() : null;
}
function safeGoals(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 25 ? v : null;
}
function safeTime(row) {
  const candidate = row.datetime || row.kickoff || row.start_time || row.start_at;
  if (typeof candidate !== 'string' || !/\d{4}-\d{2}-\d{2}T/.test(candidate)) return null;
  const millis = Date.parse(candidate);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}
export function normalizeSportApiFixtures(payload) {
  const rows = Array.isArray(payload?.fixtures) ? payload.fixtures : Array.isArray(payload?.data?.fixtures) ? payload.data.fixtures : null;
  if (!rows || payload.success === false || rows.length > MAX_FIXTURES) return null;
  const matches = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rawId = row.id;
    if (!/^\d{1,14}$/.test(String(rawId ?? ''))) continue;
    const id = 'sportapi-' + rawId;
    const home = safeName(typeof row.home_team === 'string' ? row.home_team : row.home_team?.name);
    const away = safeName(typeof row.away_team === 'string' ? row.away_team : row.away_team?.name);
    const date = safeTime(row);
    if (!home || !away || !date || home === away || seen.has(id)) continue;
    seen.add(id);
    const leagueName = String(row.league_name || row.league?.name || row.league || '').trim();
    const normalized = leagueName.toLowerCase().replace(/\s+/g,' ');
    const league = LEAGUES.get(normalized) || safeName(leagueName) || 'unknown';
    const status = String(row.status?.short || row.status || '').toUpperCase();
    const finished = FINISHED.has(status);
    const homeScore = finished ? safeGoals(row.home_score) : null;
    const awayScore = finished ? safeGoals(row.away_score) : null;
    matches.push({
      id, league, date, home, away,
      p1:null,px:null,p2:null,over25:null,under25:null,btts:null,no_btts:null,
      mu_home:null,mu_away:null,
      status:finished && homeScore !== null && awayScore !== null ? 'FINISHED' : status || 'UNKNOWN',
      home_score:homeScore,away_score:awayScore,
      provider:'sportapi.ai',provider_id:String(rawId),model_available:false
    });
  }
  return matches.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
}
export async function fetchSportApiFixtures(key, date, fetchImpl = fetch) {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),7500);
  try {
    const response = await fetchImpl(SPORTAPI_ENDPOINT + date, {
      method:'GET', headers:{'X-Api-Key':key,Accept:'application/json'},
      signal:controller.signal,redirect:'error'
    });
    if (!response.ok) return null; // 401 / 403 / 429 / 5xx: no retry storms
    const len=Number(response.headers.get('content-length')||0);
    if (len>MAX_JSON_BYTES) return null;
    const body = await response.text();
    if (body.length>MAX_JSON_BYTES) return null;
    const normalized = normalizeSportApiFixtures(JSON.parse(body));
    if (!normalized || normalized.length===0) return null;
    return {demo:false,source:'sportapi.ai',provider_mode:'fallback',
      generated_at:new Date().toISOString(),matches:normalized,
      model:{available:false,reason:'Provider fixtures do not include a trained probability model'}};
  } catch {
    return null; // do not log request headers, secrets, URLs or provider error bodies
  } finally {
    clearTimeout(timeout);
  }
}
