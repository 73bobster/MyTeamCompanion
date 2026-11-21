// GET /api/live  ->  { at, fixtures: [...], events: [...] }
// Live and just-finished UK/European games, read from public.live_board in the Statto Sweepstake database (kept up to date by that app's
// poller, tools/poller.mjs, every minute with one live=all call). Read-only role myteamcompanion_live_ro; its address lives in the Pages
// environment variable LIVE_DATABASE_URL. Answers are cached at the edge for 20 seconds, so any number of open apps cost one database read per 20s.
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

const BOARD = `select fixture_id, league_id, kickoff, state, updated_at from public.live_board
  where kickoff > now() - interval '6 hours' and kickoff < now() + interval '1 hour' and updated_at > now() - interval '6 hours' order by kickoff`;

// board rows -> the flat shape the app reads
export function shape(rows) {
  const fixtures = [], events = [];
  for (const r of rows) {
    const st = typeof r.state === 'string' ? JSON.parse(r.state) : r.state, t = st.teams || {}, id = Number(r.fixture_id);
    fixtures.push({
      fixture_id: id, competition_id: r.league_id, kickoff: r.kickoff, status_short: st.status && st.status.short, status_long: st.status && st.status.long,
      elapsed: st.status ? st.status.elapsed : null, extra: null, home_club_id: t.home && t.home.id, away_club_id: t.away && t.away.id,
      home_name: t.home && t.home.name, away_name: t.away && t.away.name, home_goals: st.goals ? st.goals.home : null, away_goals: st.goals ? st.goals.away : null, updated_at: r.updated_at,
    });
    (st.events || []).forEach((e, i) => events.push({ fixture_id: id, seq: i + 1, minute: e.x, extra: e.e, club_id: e.team, player_name: e.pname, assist_name: e.aname, type: e.type, detail: e.detail }));
  }
  return { fixtures, events };
}

export async function onRequestGet({ env, request, waitUntil }) {
  const json = (o, s = 200, ttl = 0) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': ttl ? 'public, max-age=' + ttl : 'no-store' } });
  if (!env.LIVE_DATABASE_URL) return json({ error: 'not configured' }, 503);
  const cache = caches.default, key = new Request(new URL(request.url).origin + '/api/live', { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const { fixtures, events } = shape(await sql(env.LIVE_DATABASE_URL, BOARD));
    const res = json({ at: new Date().toISOString(), fixtures, events }, 200, TTL);
    if (waitUntil) waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}
