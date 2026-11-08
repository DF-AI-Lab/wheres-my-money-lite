// v0.49 (Darren, 25 Oct): a spend's ⋯ can change its amount and its name. Fake data only.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

test('change a spend amount: a good amount sticks, a bad one is an error, a gone spend is ignored', () => {
  const s = M.FAKE(), costa = s.spends.find(x => x.name === 'Costa');
  assert.strictEqual(M.setSpendAmount(s, String(costa.id), '£7.25'), null);
  assert.strictEqual(costa.amount, 7.25);
  assert.strictEqual(M.setSpendAmount(s, String(costa.id), 'abc'), 'spend');
  assert.strictEqual(M.setSpendAmount(s, String(costa.id), '0'), 'spend');
  assert.strictEqual(costa.amount, 7.25);
  assert.strictEqual(M.setSpendAmount(s, '999', '5'), null);
});

test('rename a spend: trimmed, empty = error, the category stays', () => {
  const s = M.FAKE(), costa = s.spends.find(x => x.name === 'Costa'), cat = costa.cat;
  assert.strictEqual(M.renameSpend(s, String(costa.id), '  Costa Coffee '), null);
  assert.strictEqual(costa.name, 'Costa Coffee');
  assert.strictEqual(costa.cat, cat);
  assert.strictEqual(M.renameSpend(s, String(costa.id), '   '), 'spend');
  assert.strictEqual(costa.name, 'Costa Coffee');
});
