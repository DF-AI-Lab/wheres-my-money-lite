// Step 2 maths: docs/money.js must give the same numbers as live v3.62 (Python) for the same data.
// Run: node --test tests_js/   (fake data only; the expected numbers come from the live page on the fake statements)
const test = require('node:test');
const assert = require('node:assert');
const Money = require('../docs/money.js');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: ${a} != ${b}`);

test('fake data: bills, spends not in a pot and the card match the live page', () => {
  const s = Money.FAKE();                     // docs/money.js: the fake starting state, a fresh copy each call
  const r = Money.compute(s);
  near(r.billsTotal, 1183.73, 'bills');
  near(r.spendsTotal, 46.70, 'spends');
  // Go A: FAKE now has pots, so spare and the ring are checked in golite.test.js
  near(r.card.used, 45, 'card used'); near(r.card.free, 455, 'card free'); assert.strictEqual(r.card.pctUsed, 9);
});

test('card: payments clear the oldest lines first (creditcard.allocate)', () => {
  const s = {pay: 0, bills: [], spends: [], card: {limit: 500, items: [
    {id: 1, date: '2026-10-05', amount: 100, name: 'Correction', kind: 'correction'},
    {id: 2, date: '2026-10-06', amount: -40, name: 'Paid off', kind: 'paid'},
    {id: 3, date: '2026-10-10', amount: 25, name: 'Fuel', kind: 'spend'}]}};
  const c = Money.compute(s).card;
  near(c.used, 85, 'used'); near(c.free, 415, 'free'); assert.strictEqual(c.pctUsed, 17);
  assert.deepStrictEqual(c.rows.map(r => [r.status, r.left]), [['part', 60], ['credit', 0], ['owed', 25]]);
});

test('Used box adds a Correction line so used matches what you typed', () => {
  const s = Money.FAKE();
  Money.setUsed(s, '2024-10-25', 100);
  near(Money.compute(s).card.used, 100, 'used after correction');
  assert.strictEqual(s.card.items.at(-1).name, 'Correction');
});
