// v0.50 (Darren, 25 Oct): a 'Takeaway' pot did not take the 'Takeaways' spends (exact match only).
// Pots now match their category loosely (case, a trailing s), pick an existing category when made, and ⋯ → 🏷 Category links one.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const pot = (r, name) => r.pots.find(p => p.name === name);

function withSpend(cat) {
  const s = M.FAKE();
  M.addSpend(s, '2024-11-08', '18', 'Kt takeaway');
  M.setSpendCat(s, String(s.spends[s.spends.length - 1].id), cat);
  return s;
}

test('a pot named "takeaway" takes the "Takeaways" spends, made after the spend', () => {
  const s = withSpend('Takeaways');
  assert.strictEqual(M.addPot(s, '100', 'takeaway'), null);
  const r = M.compute(s, '2024-11-08');
  near(pot(r, 'takeaway').spent, 18, 'spent from the pot');
  near(pot(r, 'takeaway').left, 82, 'left in the pot');
  assert.strictEqual(r.spends.find(x => x.name === 'Kt takeaway').pot, 'takeaway');
});

test('a new pot picks the existing category spelling', () => {
  const s = M.FAKE();
  M.addPot(s, '50', 'takeaway');
  assert.strictEqual(s.pots.find(p => p.name === 'takeaway').cat, 'Takeaways');
});

test('a pot with a brand new name makes that a category, so spends can pick it', () => {
  const s = M.FAKE();
  M.addPot(s, '50', 'Mia treats');
  assert.ok(M.categories(s).includes('Mia treats'));
});

test('⋯ → Category links a pot to another category', () => {
  const s = withSpend('Takeaways');
  M.addPot(s, '100', 'Food out');
  near(pot(M.compute(s, '2024-11-08'), 'Food out').spent, 0, 'not linked yet');
  assert.strictEqual(M.setPotCat(s, 'Food out', 'takeaways'), null);
  assert.strictEqual(s.pots.find(p => p.name === 'Food out').cat, 'Takeaways');
  near(pot(M.compute(s, '2024-11-08'), 'Food out').spent, 18, 'now linked');
  assert.strictEqual(M.setPotCat(s, 'Food out', '  '), 'pot');
  assert.strictEqual(M.setPotCat(s, 'nope', 'Fuel'), 'unknown');
});
