// v0.70 (Darren, 11 Nov; mock https://claude.ai/artifact/9TV6jdTmuRTFTF5KinGxnT): Money in, Skip this month, Paid on card.
// Run: node --test tests_js/*.test.js   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

const TODAY = '2024-11-08';
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const bill = (s, key) => M.compute(s, TODAY).bills.find(b => b.key === key);
const card = s => M.compute(s, TODAY).cards[0];

// ---------- money in ----------
test('money in adds to spare, money for spending and the month-end spare', () => {
  const s = M.FAKE(), before = M.compute(s, TODAY), end = M.monthEndSpare(s);
  assert.strictEqual(M.addMoneyIn(s, TODAY, '40', 'Birthday money'), null);
  const r = M.compute(s, TODAY);
  near(r.inTotal, 40, 'inTotal');
  near(r.leftNow, before.leftNow + 40, 'Actual spare up by 40');
  near(r.startSpare, before.startSpare + 40, 'Starting spare up by 40');
  near(M.monthEndSpare(s), end + 40, 'month-end spare up by 40');
  assert.deepStrictEqual(r.moneyIn.map(x => [x.name, x.amount, x.date]), [['Birthday money', 40, TODAY]]);
});

test('money in: bad input is refused, remove takes it off, payday saves and clears it', () => {
  const s = M.FAKE();
  assert.strictEqual(M.addMoneyIn(s, TODAY, '', 'Mum'), 'moneyin');
  assert.strictEqual(M.addMoneyIn(s, TODAY, '20', '  '), 'moneyin');
  assert.strictEqual(M.addMoneyIn(s, TODAY, '0', 'Mum'), 'moneyin');
  M.addMoneyIn(s, TODAY, '20', 'Mum'); M.addMoneyIn(s, TODAY, '5.50', 'Refund');
  assert.deepStrictEqual(s.moneyIn.map(x => x.id), [1, 2]);
  M.removeMoneyIn(s, '1');
  assert.deepStrictEqual(s.moneyIn.map(x => x.name), ['Refund']);
  assert.strictEqual(M.newPayday(s, '2024-11-25', '1800', '0'), null);
  assert.deepStrictEqual(s.moneyIn, []);
  const m = s.history[s.history.length - 1];
  near(m.in, 5.5, 'the month keeps its money in');
});

test('Claude/Orbit job add_money_in adds a line with its job id; remove_spend takes it back', () => {
  const s = M.FAKE();
  const res = M.applyJob(s, {v: 1, id: 'c-1', kind: 'add_money_in', amount: 18.99, name: 'Amazon refund', from: 'Claude'}, TODAY);
  assert.strictEqual(res.done, true);
  assert.match(res.note, /Added by Claude: \+£18\.99 Amazon refund/);
  assert.strictEqual(s.moneyIn[0].job, 'c-1');
  const sum = M.summary(s, TODAY, 'now');
  near(sum.money_in, 18.99, 'summary money_in');
  assert.ok(sum.added.some(a => a.id === 'c-1' && a.kind === 'money_in'));
  M.applyJob(s, {v: 1, id: 'c-2', kind: 'remove_spend', target: 'c-1', from: 'Claude'}, TODAY);
  assert.deepStrictEqual(s.moneyIn, []);
});

// ---------- skip this month ----------
test('skip this month: the bill counts £0, not paid, back by itself at payday', () => {
  const s = M.FAKE(), before = M.compute(s, TODAY);
  assert.strictEqual(M.setSkip(s, 'Gym Club', true, TODAY), null);
  const b = bill(s, 'Gym Club'), r = M.compute(s, TODAY);
  assert.strictEqual(b.skip, true);
  assert.strictEqual(b.used, 0);
  near(r.billsTotal, before.billsTotal - 50, 'bills total down by 50');
  near(r.leftNow, before.leftNow + 50, 'spare up by 50');
  assert.ok(!M.summary(s, TODAY, 'now').bills.find(x => x.name === 'Gym Club').paid);
  near(M.summary(s, TODAY, 'now').to_come_out, 152.36 - 50, 'a skipped bill is not still to come out');
  M.newPayday(s, '2024-11-25', '1800', '0');
  assert.ok(!s.bills.find(x => x.key === 'Gym Club').skip, 'back next month');
  assert.strictEqual(s.history[s.history.length - 1].bills.find(x => x.key === 'Gym Club').skipped, true);
  const nb = bill(s, 'Gym Club');
  assert.strictEqual(nb.used, 50);
  assert.strictEqual(nb.changed, false, 'no "changed" flag after a skipped month');
});

test('skip is undone by Count it, by Mark paid, and a past due day does not show it paid or in the bell', () => {
  const s = M.FAKE();
  M.setSkip(s, 'Rent', true, TODAY);                            // Rent due the 1st: gone
  assert.ok(!M.reminders(s, TODAY).some(x => x.key === 'Rent'));
  M.setSkip(s, 'Rent', false, TODAY);
  assert.ok(!bill(s, 'Rent').skip);
  M.setSkip(s, 'Rent', true, TODAY);
  M.setPaid(s, 'Rent', true, TODAY);
  assert.ok(!bill(s, 'Rent').skip, 'marking it paid counts it again');
});

// ---------- paid on card ----------
test('paid on card: not from the bank, a line on the card, the bill shows paid', () => {
  const s = M.FAKE(), before = M.compute(s, TODAY), used = card(s).used;
  assert.strictEqual(M.payOnCard(s, 'Gym Club', 'Zopa', TODAY), null);
  const b = bill(s, 'Gym Club'), r = M.compute(s, TODAY);
  assert.strictEqual(b.oncard, 'Zopa');
  assert.strictEqual(b.paid, true);
  assert.strictEqual(b.used, 0);
  near(r.leftNow, before.leftNow + 50, 'spare does not drop for it');
  near(card(s).used, used + 50, 'the card goes up by 50');
  near(M.monthEndSpare(s), M.monthEndSpare(M.FAKE()) + 50, 'month-end spare too');
  assert.strictEqual(M.summary(s, TODAY, 'now').bills.find(x => x.name === 'Gym Club').on_card, true);
});

test('paid on card: undo takes the card line off; a new amount moves the card line; payday resets the bill but keeps the card line', () => {
  const s = M.FAKE(), used = card(s).used;
  M.payOnCard(s, 'Gym Club', 'Zopa', TODAY);
  M.setPaid(s, 'Gym Club', false, TODAY);
  near(card(s).used, used, 'Not paid yet = card back as it was');
  assert.ok(!bill(s, 'Gym Club').oncard);
  M.payOnCard(s, 'Gym Club', 'Zopa', TODAY);
  M.setPaid(s, 'Gym Club', true, TODAY);
  near(card(s).used, used, 'Paid (from the bank) = card back as it was');
  assert.strictEqual(bill(s, 'Gym Club').used, 50);
  M.payOnCard(s, 'Gym Club', 'Zopa', TODAY);
  M.setBill(s, 'Gym Club', '55');
  near(card(s).used, used + 55, 'card line follows the new amount');
  M.setSkip(s, 'Gym Club', true, TODAY);
  near(card(s).used, used, 'skip takes it off the card');
  M.payOnCard(s, 'Gym Club', 'Zopa', TODAY);
  M.newPayday(s, '2024-11-25', '1800', '0');
  assert.ok(!bill(s, 'Gym Club').oncard, 'next month it is a normal bill again');
  near(card(s).used, used + 55, 'the card still owes it');
});

test('paid on card picks the card by key; a bad card or no amount changes nothing', () => {
  const s = M.FAKE();
  M.addCreditCard(s, 'Amex', '1000');
  const keys = M.compute(s, TODAY).cards.map(c => c.key);
  assert.strictEqual(M.payOnCard(s, 'Phone Co', keys[1], TODAY), null);
  assert.strictEqual(M.compute(s, TODAY).cards[1].used, 40.11);
  assert.strictEqual(M.payOnCard(s, 'Rent', 'Nope', TODAY), 'unknown');
  s.bills.find(b => b.key === 'Rent').amount = null;
  assert.strictEqual(M.payOnCard(s, 'Rent', keys[0], TODAY), 'bill');
});
