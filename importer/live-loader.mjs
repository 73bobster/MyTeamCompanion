// Reference implementation of the live-games step for the football-data loader (the one that runs on Robert's PC every minute).
// One API-Football call per run (GET /fixtures?live=all) returns every game in play with its score, minute and events, so the cost is
// one request a minute however many games are on. Games that have just ended drop out of "live=all"; fetchEnded() asks for those by id.
//   FOOTBALL_DATABASE_URL (owner/loader role on football-data)  API_FOOTBALL_KEY
//   node importer/live-loader.mjs          # one pass; run it every 60 seconds
// toRows() is pure and tested (importer/test/live-loader.test.mjs). Club ids written are ref.clubs.id (via ref.external_ids).

const UK_COMPS = new Set([39, 40, 41, 42, 45, 48, 179, 180, 181, 183, 184, 2, 3, 848]); // leagues, cups, Europe the app understands

export function toRows(apiFixtures, clubIdByApi) {
  const fixtures = [], events = [];
  for (const f of apiFixtures || []) {
    if (!UK_COMPS.has(f.league && f.league.id)) continue;
    const id = f.fixture.id;
    fixtures.push({
      fixture_id: id, competition_id: f.league.id, season: f.league.season, kickoff: f.fixture.date,
      status_short: f.fixture.status.short, status_long: f.fixture.status.long, elapsed: f.fixture.status.elapsed, extra: f.fixture.status.extra ?? null,
      home_club_id: clubIdByApi.get(String(f.teams.home.id)) ?? null, away_club_id: clubIdByApi.get(String(f.teams.away.id)) ?? null,
      home_name: f.teams.home.name, away_name: f.teams.away.name,
      home_goals: f.goals.home, away_goals: f.goals.away, ht_home: f.score && f.score.halftime ? f.score.halftime.home : null, ht_away: f.score && f.score.halftime ? f.score.halftime.away : null,
    });
    (f.events || []).forEach((e, i) => events.push({
      fixture_id: id, seq: i + 1, minute: e.time.elapsed, extra: e.time.extra ?? null,
      club_id: clubIdByApi.get(String(e.team && e.team.id)) ?? null,
      // substitutions: player_name = the player going off, assist_name = the player coming on
      player_name: e.player && e.player.name, assist_name: e.assist && e.assist.name, type: e.type, detail: e.detail,
    }));
  }
  return { fixtures, events };
}

const FX_COLS = ['fixture_id', 'competition_id', 'season', 'kickoff', 'status_short', 'status_long', 'elapsed', 'extra', 'home_club_id', 'away_club_id', 'home_name', 'away_name', 'home_goals', 'away_goals', 'ht_home', 'ht_away'];
const EV_COLS = ['fixture_id', 'seq', 'minute', 'extra', 'club_id', 'player_name', 'assist_name', 'type', 'detail'];

export async function save(client, { fixtures, events }) {
  await client.query('begin');
  try {
    for (const f of fixtures) {
      const vals = FX_COLS.map((c) => f[c]);
      await client.query(`insert into ref.live_fixtures (${FX_COLS.join(',')}, updated_at) values (${FX_COLS.map((_, i) => '$' + (i + 1)).join(',')}, now())
        on conflict (fixture_id) do update set ${FX_COLS.slice(1).map((c) => `${c}=excluded.${c}`).join(',')}, updated_at=now()`, vals);
      await client.query('delete from ref.live_events where fixture_id=$1', [f.fixture_id]);
    }
    for (const e of events) await client.query(`insert into ref.live_events (${EV_COLS.join(',')}) values (${EV_COLS.map((_, i) => '$' + (i + 1)).join(',')})`, EV_COLS.map((c) => e[c]));
    // tidy: nothing older than a day is useful
    await client.query("delete from ref.live_fixtures where kickoff < now() - interval '1 day'");
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; }
}

const api = async (path) => {
  const r = await fetch('https://v3.football.api-sports.io' + path, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } });
  if (!r.ok) throw new Error('API-Football ' + r.status);
  return (await r.json()).response || [];
};

// games we stored as in play that are no longer in live=all: fetch their final state (up to 20 ids per call)
export async function fetchEnded(client, liveIds) {
  const { rows } = await client.query("select fixture_id from ref.live_fixtures where status_short in ('1H','HT','2H','ET','BT','P','INT','LIVE') and updated_at > now() - interval '5 hours'");
  const missing = rows.map((r) => Number(r.fixture_id)).filter((id) => !liveIds.has(id)).slice(0, 20);
  return missing.length ? api('/fixtures?ids=' + missing.join('-')) : [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pg } = await import('pg'); // npm i pg (only needed to run it, not to test it)
  const client = new pg.Client({ connectionString: process.env.FOOTBALL_DATABASE_URL });
  await client.connect();
  try {
    const map = new Map((await client.query("select external_id, entity_id from ref.external_ids where entity='club' and provider='api-football'")).rows.map((r) => [String(r.external_id), Number(r.entity_id)]));
    const live = await api('/fixtures?live=all');
    const ended = await fetchEnded(client, new Set(live.map((f) => f.fixture.id)));
    const out = toRows([...live, ...ended], map);
    await save(client, out);
    console.log(`live ${out.fixtures.length} fixtures, ${out.events.length} events`);
  } finally { await client.end(); }
}
