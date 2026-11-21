// Copies club, squad and season-stat reference data from the shared football-data database into this app's tables.
//   node importer/refdata.mjs --clubs c.json --squad s.json --stats st.json --comps comps.json --out refdata.sql
// The JSON files are exported from football-data (schema "ref") with psql by .github/workflows/sync-football-data.yml.
// Only clubs the app knows (importer ALIASES + clubSlug) are kept. Nulls stay null: an unknown stat is never 0.
import fs from 'node:fs';

export const clubSlug = (n) => String(n || '').toLowerCase().replace(/&/g, 'and').replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// football-data club name -> the name the app uses (anything not listed is used as it is)
export const ALIASES = {
  'Dundee Utd': 'Dundee United', 'ST Mirren': 'St Mirren', 'ST Johnstone': 'St Johnstone', 'Heart Of Midlothian': 'Heart of Midlothian',
  'Inverness CT': 'Inverness Caledonian Thistle', 'Partick': 'Partick Thistle', 'Morton': 'Greenock Morton', 'Ayr Utd': 'Ayr United',
  'Hamilton Academical': 'Hamilton Academical', 'Dunfermline': 'Dunfermline Athletic', 'Newcastle': 'Newcastle United',
  'Tottenham': 'Tottenham Hotspur', 'West Ham': 'West Ham United', 'Wolves': 'Wolverhampton Wanderers', 'Brighton': 'Brighton & Hove Albion',
  'Leeds': 'Leeds United', 'Norwich': 'Norwich City', 'Leicester': 'Leicester City', 'Derby': 'Derby County', 'QPR': 'Queens Park Rangers',
  'Blackburn': 'Blackburn Rovers', 'Bolton': 'Bolton Wanderers', 'Cardiff': 'Cardiff City', 'Coventry': 'Coventry City',
  'Birmingham': 'Birmingham City', 'Charlton': 'Charlton Athletic', 'Lincoln': 'Lincoln City', 'Preston': 'Preston North End',
  'Swansea': 'Swansea City', 'West Brom': 'West Bromwich Albion', 'Luton': 'Luton Town', 'Plymouth': 'Plymouth Argyle',
  'Peterborough': 'Peterborough United', 'Sheffield Utd': 'Sheffield United', 'Wigan': 'Wigan Athletic', 'Rotherham': 'Rotherham United',
  'Wycombe': 'Wycombe Wanderers', 'Huddersfield': 'Huddersfield Town', 'Ipswich': 'Ipswich Town', 'Hull City': 'Hull City', 'Brechin': 'Brechin City',
  'Airdrie United': 'Airdrieonians', 'Queen\'s Park': 'Queen\'s Park', 'Cove Rangers': 'Cove Rangers',
};
export const slugFor = (refName) => clubSlug(ALIASES[refName] || refName);

const q = (v) => (v == null || v === '' ? 'null' : "'" + String(v).replace(/'/g, "''") + "'");
const n = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 'null' : String(Number(v)));
const decode = (s) => (s == null ? s : String(s).replace(/&apos;|&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
const POS = new Set(['GK', 'DEF', 'MID', 'ATT']);
const pos = (p) => (POS.has(p) ? p : null);

export function buildSql({ clubs, squad, stats, comps }, now = new Date()) {
  const bySlug = new Map(), byRef = new Map(), skipped = [];
  for (const c of clubs) {
    if (c.is_national_team) continue;
    const slug = slugFor(c.name);
    if (!slug) continue;
    if (bySlug.has(slug)) { skipped.push(c.name + ' (duplicate slug ' + slug + ')'); continue; }
    bySlug.set(slug, c); byRef.set(String(c.id), slug);
  }
  const out = ['begin;', 'truncate public.pro_squad, public.pro_player_stats, public.pro_competitions;'];
  const cv = [...bySlug].map(([slug, c]) => `(${q(slug)},${n(c.id)},${q(decode(c.name))},${q(decode(c.short_name))},${q(c.code)},${q(decode(c.venue))},${q(decode(c.city))},${n(c.capacity)},${n(c.founded)},${q(c.logo)},now())`);
  if (cv.length) out.push(`insert into public.pro_clubs(slug,ref_id,name,short_name,code,venue,city,capacity,founded,logo_url,updated_at) values\n${cv.join(',\n')}\non conflict (slug) do update set ref_id=excluded.ref_id,name=excluded.name,short_name=excluded.short_name,code=excluded.code,venue=excluded.venue,city=excluded.city,capacity=excluded.capacity,founded=excluded.founded,logo_url=excluded.logo_url,updated_at=now();`);
  const sv = squad.filter((s) => byRef.has(String(s.club_id))).map((s) => `(${q(byRef.get(String(s.club_id)))},${n(s.season)},${n(s.player_id)},${q(decode(s.name))},${q(s.name_key)},${q(pos(s.position))},${n(s.shirt)},${q(decode(s.nationality))},${q(s.birth_date)},${n(s.height_cm)},${q(s.photo_url)},${s.on_loan ? 'true' : 'false'})`);
  for (let i = 0; i < sv.length; i += 500) out.push(`insert into public.pro_squad(slug,season,ref_player_id,name,name_key,position,shirt,nationality,birth_date,height_cm,photo_url,on_loan) values\n${sv.slice(i, i + 500).join(',\n')}\non conflict do nothing;`);
  const tv = stats.filter((s) => byRef.has(String(s.club_id))).map((s) => `(${q(byRef.get(String(s.club_id)))},${n(s.season)},${n(s.comp_id)},${n(s.player_id)},${n(s.appearances)},${n(s.starts)},${n(s.minutes)},${n(s.goals)},${n(s.assists)},${n(s.yellow)},${n(s.red)},${n(s.clean_sheets)},${n(s.goals_conceded)},${n(s.saves)},${n(s.rating)})`);
  for (let i = 0; i < tv.length; i += 500) out.push(`insert into public.pro_player_stats(slug,season,comp_id,ref_player_id,appearances,starts,minutes,goals,assists,yellow,red,clean_sheets,goals_conceded,saves,rating) values\n${tv.slice(i, i + 500).join(',\n')}\non conflict do nothing;`);
  const cmv = comps.map((c) => `(${n(c.id)},${q(decode(c.name))},${q(c.nation_code)})`);
  if (cmv.length) out.push(`insert into public.pro_competitions(comp_id,name,nation_code) values ${cmv.join(',')} on conflict do nothing;`);
  out.push('commit;');
  return { sql: out.join('\n') + '\n', clubs: cv.length, squad: sv.length, stats: tv.length, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = Object.fromEntries(process.argv.slice(2).reduce((r, v, i, all) => (v.startsWith('--') ? [...r, [v.slice(2), all[i + 1]]] : r), []));
  const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8') || 'null') || [];
  const r = buildSql({ clubs: rd(a.clubs), squad: rd(a.squad), stats: rd(a.stats), comps: rd(a.comps) });
  if (!r.clubs) { console.error('No clubs read: refusing to write an empty load.'); process.exit(1); }
  fs.writeFileSync(a.out || 'refdata.sql', r.sql);
  console.log(`clubs ${r.clubs}, squad rows ${r.squad}, stat rows ${r.stats}` + (r.skipped.length ? `\nskipped: ${r.skipped.join('; ')}` : ''));
}
