// v0.51 (Darren, 25 Oct): Add a spend and Bills get an All | Categories switch (mock https://claude.ai/artifact/BgPMi2sR3uP4WiKXXzmnd7)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const sum = xs => xs.reduce((a, x) => a + x, 0);

test('catTotals groups loosely, biggest first, empty = Unsorted', () => {
  const g = M.catTotals([
    {name: 'KFC', cat: 'Takeaways', amount: 18},
    {name: 'Tesco', cat: 'Food shopping', amount: 42.1},
    {name: 'Just Eat', cat: 'takeaway', amount: 22.3},
    {name: 'Costa', cat: '', amount: 3.4},
  ]);
  assert.deepStrictEqual(g.map(c => c.name), ['Food shopping', 'Takeaways', 'Unsorted']);
  near(g[1].total, 40.3, 'takeaways');
  assert.deepStrictEqual(g[1].items.map(i => i.name), ['KFC', 'Just Eat']);
  assert.deepStrictEqual(M.catTotals([]), []);
});

test('compute gives spendCats that add up to every spend', () => {
  const r = M.compute(M.FAKE(), '2024-11-08');
  assert.ok(r.spendCats.length >= 2);
  near(sum(r.spendCats.map(c => c.total)), r.spendsAll, 'spends');
  assert.strictEqual(sum(r.spendCats.map(c => c.items.length)), r.spends.length);
});

test('compute gives billCats that add up to the Bills total (pots as one group, paused bills left out)', () => {
  const s = M.FAKE();
  s.bills[0].stopped = true;
  const r = M.compute(s, '2024-11-08');
  near(sum(r.billCats.map(c => c.total)), r.billsTotal + r.potsSet, 'bills');
  const pots = r.billCats.find(c => c.name === 'Pots');
  assert.ok(pots && pots.items.length === r.pots.filter(p => !p.blank).length);
  assert.ok(!r.billCats.some(c => c.items.some(i => i.name === s.bills[0].name)));
});
