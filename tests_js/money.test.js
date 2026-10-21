// Step 2 maths: docs/money.js must give the same numbers as live v3.62 (Python) for the same data.
// Run: node --test tests_js/   (fake data only; the expected numbers come from the live page on the fake statements)
const test = require('node:test');
const assert = require('node:assert');
const Money = require('../docs/money.js');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: ${a} != ${b}`);

test('fake data starts like the live page (pay 2500, Costa + Tesco, Amazon on the card)', () => {
  const s = Money.FAKE();                     // docs/money.js: the fake starting state, a fresh copy each call
  const r = Money.compute(s);
  near(r.billsTotal, 1183.73, 'bills');
  near(r.spendsTotal, 46.70, 'spends');
  near(r.moneyForSpending, 1316.27, 'money for spending');
  near(r.spare, 1269.57, 'spare');
  assert.deepStrictEqual([r.pct.bills, r.pct.spends, r.pct.spare], [47, 2, 51]);
  near(r.card.used, 45, 'card used'); near(r.card.free, 455, 'card free'); assert.strictEqual(r.card.pctUsed, 9);
});

test('spare = pay + left - bills - spends; stopped bills count 0; a this-month change wins', () => {
  const s = {pay: 1000, left: 100, bills: [
      {key: 'Rent', name: 'Rent', avg: 500, last: 500},
      {key: 'Gym', name: 'Gym', avg: 30, last: 30, stopped: true},
      {key: 'Phone', name: 'Phone', avg: 20, last: 25, change: 40}],
    spends: [{id: 1, date: '2026-10-03', amount: 12.5, name: 'Costa'}], card: {limit: 500, items: []}};
  const r = Money.compute(s);
  near(r.billsTotal, 540, 'bills'); near(r.billsAvg, 520, 'bills avg (stopped left out)');
  near(r.moneyForSpending, 560, 'money for spending'); near(r.spare, 547.5, 'spare');
  const phone = r.bills.find(b => b.key === 'Phone');
  near(phone.used, 40, 'changed amount'); near(phone.diff, 20, 'diff = used - avg');
  assert.strictEqual(r.bills.find(b => b.key === 'Gym').used, 0);
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
