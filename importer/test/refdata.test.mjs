import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { slugFor, clubSlug, buildSql } from '../refdata.mjs';

const REF_NAMES = ['Aberdeen','Airdrie United','Alloa Athletic','Arbroath','Arsenal','Aston Villa','Ayr Utd','Barnsley','Birmingham','Blackburn','Blackpool','Bolton','Bournemouth','Brechin','Brentford','Brighton','Bristol City','Burnley','Burton Albion','Cardiff','Celtic','Charlton','Chelsea','Cove Rangers','Coventry','Crystal Palace','Derby','Dumbarton','Dundee','Dundee Utd','Dunfermline','Everton','Falkirk','Fulham','Hamilton Academical','Heart Of Midlothian','Hibernian','Huddersfield','Hull City','Inverness CT','Ipswich','Kilmarnock','Leeds','Leicester','Lincoln','Liverpool','Livingston','Luton','Manchester City','Manchester United','Middlesbrough','Millwall','Milton Keynes Dons','Montrose','Morton','Motherwell','Newcastle','Norwich','Nottingham Forest','Oxford United','Partick','Peterborough','Plymouth','Portsmouth','Preston','QPR','Queen of the South',"Queen's Park",'Raith Rovers','Rangers','Reading','Ross County','Rotherham','ST Johnstone','ST Mirren','Sheffield Utd','Sheffield Wednesday','Southampton','Stenhousemuir','Stoke City','Sunderland','Swansea','Tottenham','Watford','West Brom','West Ham','Wigan','Wolves','Wrexham','Wycombe'];

test('every football-data club name maps to a club the app knows', () => {
  const s = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const known = new Set(eval(s.match(/const UK_CLUBS=(\[\[.*?\]\]);/s)[1]).map((c) => clubSlug(c[0])));
  const bad = REF_NAMES.filter((n) => !known.has(slugFor(n)));
  assert.deepEqual(bad, []);
  const slugs = REF_NAMES.map(slugFor);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs are unique');
});

test('buildSql keeps only known clubs, keeps nulls null and cleans escaped text', () => {
  const r = buildSql({
    clubs: [{ id: 53, name: 'Rangers', short_name: 'Rangers', code: 'RAN', venue: 'Ibrox Stadium', city: 'Glasgow', capacity: 50817, founded: 1873, logo: 'https://media.api-sports.io/football/teams/257.png' },
            { id: 999, name: 'Poland', is_national_team: true }],
    squad: [{ club_id: 53, season: 2026, player_id: 7, name: 'Sean O&apos;Donnell', name_key: 'sean odonnell', position: 'DEF', shirt: null, nationality: 'Scotland', birth_date: '2000-01-02', height_cm: null, photo_url: null, on_loan: false },
            { club_id: 999, season: 2026, player_id: 8, name: 'X' }],
    stats: [{ club_id: 53, season: 2026, comp_id: 179, player_id: 7, appearances: 5, starts: null, goals: null }],
    comps: [{ id: 179, name: 'Premiership', nation_code: 'SCO' }],
  });
  assert.equal(r.clubs, 1); assert.equal(r.squad, 1); assert.equal(r.stats, 1);
  assert.match(r.sql, /'rangers',53/);
  assert.match(r.sql, /Sean O''Donnell/);
  assert.doesNotMatch(r.sql, /&apos;/);
  assert.match(r.sql, /,null,'Scotland'/); // shirt number unknown stays null
  assert.match(r.sql, /\(.*'rangers',2026,179,7,5,null,null,null,null/); // unknown stats are null, not 0
});
