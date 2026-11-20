import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTable } from '../tables.mjs';
const L = ['Premier League Table','Search','Team','Played','Form, Last 6 games, Oldest first',
 '1','Arsenal','10','9','0','1','15','5','10','27','L','Result Loss','W','Result Win','W','Result Win',
 '2','Brighton & Hove Albion','10','7','1','2','26','7','19','22','W','Result Win',
 '3','Leeds','10','2','1','7','8','20','−12','7','No Result','No Result','L','Result Loss','Key'];
test('parses rows, form and negative goal difference', () => {
  const r = parseTable(L);
  assert.equal(r.length, 3);
  assert.deepEqual(r[0], { pos: 1, team: 'Arsenal', p: 10, w: 9, d: 0, l: 1, gf: 15, ga: 5, gd: 10, pts: 27, form: ['L', 'W', 'W'] });
  assert.equal(r[1].team, 'Brighton & Hove Albion');
  assert.equal(r[2].gd, -12);
  assert.deepEqual(r[2].form, ['L']);
});
