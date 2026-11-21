// GET /api/live  ->  { at, fixtures: [...], events: [...] }
// Live and just-finished UK/European games, read from the shared football-data database (tables ref.live_fixtures / ref.live_events,
// filled by the loader on Robert's PC every minute). Read-only role; the address lives in the Pages environment variable
// FOOTBALL_DATABASE_URL. Answers are cached at the edge for 20 seconds, so any number of open apps cost one database read per 20s.
const TTL = 20;

async function sql(url, query) {
  const host = new URL(url).hostname;
  const r = await fetch('https://' + host + '/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': url },
    body: JSON.stringify({ query, params: [] }),
  });
  if (!r.ok) throw new Error('database ' + r.status);
  return (await r.json()).rows || [];
}

const FIXTURES = `select fixture_id, competition_id, kickoff, status_short, status_long, elapsed, extra, home_club_id, away_club_id,
  home_name, away_name, home_goals, away_goals, ht_home, ht_away, updated_at
  from ref.live_fixtures
  where kickoff > now() - interval '6 hours' and kickoff < now() + interval '1 hour' and updated_at > now() - interval '6 hours'
  order by kickoff`;
const EVENTS = `select e.fixture_id, e.seq, e.minute, e.extra, e.club_id, e.player_name, e.assist_name, e.type, e.detail
  from ref.live_events e join ref.live_fixtures f using (fixture_id)
  where f.kickoff > now() - interval '6 hours' and f.kickoff < now() + interval '1 hour' and f.updated_at > now() - interval '6 hours'
  order by e.fixture_id, e.seq`;

export async function onRequestGet({ env, request, waitUntil }) {
  const json = (o, s = 200, ttl = 0) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': ttl ? 'public, max-age=' + ttl : 'no-store' } });
  if (!env.FOOTBALL_DATABASE_URL) return json({ error: 'not configured' }, 503);
  const cache = caches.default, key = new Request(new URL(request.url).origin + '/api/live', { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const [fixtures, events] = await Promise.all([sql(env.FOOTBALL_DATABASE_URL, FIXTURES), sql(env.FOOTBALL_DATABASE_URL, EVENTS)]);
    const res = json({ at: new Date().toISOString(), fixtures, events }, 200, TTL);
    if (waitUntil) waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}
