// v0.38 (Darren, 24 Oct): Drive files live in one folder; two copies of the same month never stay.
// Run: node --test tests_js/*.test.js   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

test('drive prune: a second copy of the same month goes, then keep the newest 3 months', () => {
  const f = (id, name, t) => ({id, name, modifiedTime: t});
  const files = [f('nov1', 'b Nov 2024.json', '2024-11-08T10:00:00Z'), f('nov2', 'b Nov 2024.json', '2024-11-08T09:59:00Z'),
                 f('oct', 'b Oct 2024.json', '2024-10-30T00:00:00Z'), f('sep', 'b Sep 2024.json', '2024-09-30T00:00:00Z'),
                 f('aug', 'b Aug 2024.json', '2024-08-30T00:00:00Z')];
  assert.deepStrictEqual(M.drivePrune(files, 3).sort(), ['aug', 'nov2']);
});
