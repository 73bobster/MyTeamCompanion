import test from 'node:test';
import assert from 'node:assert/strict';
import { toRows } from '../live-loader.mjs';

const fx = (over = {}) => ({
  fixture: { id: 101, date: '2026-11-21T15:00:00+00:00', status: { short: '2H', long: 'Second Half', elapsed: 67, extra: null } },
  league: { id: 179, season: 2026 }, teams: { home: { id: 257, name: 'Rangers' }, away: { id: 247, name: 'Celtic' } },
  goals: { home: 2, away: 1 }, score: { halftime: { home: 1, away: 0 } },
  events: [
    { time: { elapsed: 12, extra: null }, team: { id: 257 }, player: { name: 'A Striker' }, assist: { name: 'B Winger' }, type: 'Goal', detail: 'Normal Goal' },
    { time: { elapsed: 45, extra: 2 }, team: { id: 247 }, player: { name: 'C Mid' }, assist: { name: null }, type: 'Card', detail: 'Yellow Card' },
  ], ...over,
});
const map = new Map([['257', 1], ['247', 2]]);

test('fixtures and events are flattened with our club ids', () => {
  const r = toRows([fx()], map);
  assert.equal(r.fixtures.length, 1);
  assert.deepEqual([r.fixtures[0].home_club_id, r.fixtures[0].away_club_id, r.fixtures[0].home_goals, r.fixtures[0].elapsed], [1, 2, 2, 67]);
  assert.deepEqual(r.events.map((e) => [e.seq, e.minute, e.extra, e.club_id, e.type]), [[1, 12, null, 1, 'Goal'], [2, 45, 2, 2, 'Card']]);
});
test('competitions the app does not use are dropped', () => {
  assert.equal(toRows([fx({ league: { id: 140, season: 2026 } })], map).fixtures.length, 0);
});
test('an unknown club keeps its name and a null id', () => {
  const r = toRows([fx({ teams: { home: { id: 999, name: 'Mystery' }, away: { id: 247, name: 'Celtic' } } })], map);
  assert.equal(r.fixtures[0].home_club_id, null);
  assert.equal(r.fixtures[0].home_name, 'Mystery');
});
