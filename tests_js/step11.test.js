// Darren's 21 Oct evening feedback (v0.16): a bill in a pot's category comes out of that pot; Clear all reminders.
// Run: node --test tests_js/*.test.js   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/money.js');

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const pot = (r, key) => r.pots.find(p => p.key === key);

test('version 0.16', () => {
  assert.strictEqual(M.VERSION, '0.16');
});

test('a bill in a pot\'s category is paid out of that pot, not counted again as a bill', () => {
  const s = M.FAKE();
  assert.strictEqual(M.addBill(s, '50', 'Fuel card'), null);
  assert.strictEqual(s.bills.find(b => b.key === 'Fuel card').cat, 'Fuel');
  const r = M.compute(s, '2024-11-08');
  near(r.billsTotal, 1183.73, 'bills total (the fuel bill is pot money)');
  near(pot(r, 'Fuel').spent, 60 + 50, 'Fuel pot spent = Shell 60 + the bill 50');
  near(pot(r, 'Fuel').left, 40, 'Fuel pot left');
  near(r.startSpare, 766.27, 'starting spare unchanged');
  near(r.leftNow, 719.57, 'actual spare unchanged (still inside the pot)');
  const b = r.bills.find(x => x.key === 'Fuel card');
  assert.strictEqual(b.pot, 'Fuel', 'the bill knows its pot');
});

test('a pot bill that takes the pot over comes off spare like any over', () => {
  const s = M.FAKE();
  M.addBill(s, '100', 'Fuel card');                                    // 60 + 100 = 160 of 150
  const r = M.compute(s, '2024-11-08');
  near(pot(r, 'Fuel').over, 10, 'over');
  near(r.potsOver, 10, 'pots over');
  near(r.leftNow, 709.57, 'actual spare');
});

test('no pot for the category (or a blank pot, or a stopped bill): a normal bill', () => {
  const s = M.FAKE();
  M.addBill(s, '30', 'Going out club');                                // Going out pot has no amount
  const r = M.compute(s, '2024-11-08');
  near(r.billsTotal, 1183.73 + 30, 'blank pot: counted as a bill');
  assert.strictEqual(r.bills.find(x => x.key === 'Going out club').pot, null);
  const t = M.FAKE();
  M.addBill(t, '50', 'Fuel card'); M.setStopped(t, 'Fuel card', true);
  near(pot(M.compute(t, '2024-11-08'), 'Fuel').spent, 60, 'stopped: not in the pot');
});

test('payday: the month saved keeps the pot bill in the pot and in the month\'s spare', () => {
  const s = M.FAKE();
  M.addBill(s, '50', 'Fuel card');
  near(M.monthEndSpare(s), 2500 - 1183.73 - 50 - (12.5 + 34.2 + 60), 'month end spare');
  M.newPayday(s, '2024-11-25', '2500', '');
  const m = s.history[s.history.length - 1];
  near(m.pots.find(p => p.key === 'Fuel').spent, 110, 'saved Fuel pot spent');
});

test('clear all reminders: bills ticked as checked; payday, card and backup quiet for today', () => {
  const s = M.FAKE();
  assert.ok(M.reminders(s, '2024-12-03').some(x => x.kind === 'payday'));
  assert.ok(M.reminders(s, '2024-12-03').some(x => x.kind === 'backup'));
  assert.strictEqual(M.clearReminders(s, '2024-12-03'), null);
  assert.deepStrictEqual(M.reminders(s, '2024-12-03'), []);
  assert.ok(s.bills.find(b => b.key === 'Rent').paid, 'Rent ticked as checked');
  const next = M.reminders(s, '2024-12-04').map(x => x.kind);
  assert.ok(next.includes('payday') && next.includes('backup'), 'they come back the next day');
  assert.ok(!next.includes('bill'), 'the checked bills stay checked');
});
