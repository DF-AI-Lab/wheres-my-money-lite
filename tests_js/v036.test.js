// v0.36 (Darren, 24 Oct, mock H2): a spend can be Upcoming (an expected date); on that date it counts as paid by itself.
// Every spend's date can be changed (⋯ → Change date); ⋯ → Paid marks an upcoming one paid today.
// Run: node --test tests_js/*.test.js   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const last = s => s.spends[s.spends.length - 1];

test('an upcoming spend keeps its expected date and a flag', () => {
  const s = M.FAKE();
  assert.strictEqual(M.addSpend(s, '2024-11-08', '54.85', 'Car MOT', '2024-11-20'), null);
  assert.strictEqual(last(s).date, '2024-11-20');
  assert.strictEqual(last(s).upcoming, true);
  assert.strictEqual(last(s).cat, 'Car');
});

test('a normal spend has no upcoming flag (blank expected date = paid today)', () => {
  const s = M.FAKE();
  assert.strictEqual(M.addSpend(s, '2024-11-08', '5', 'Greggs', ''), null);
  assert.strictEqual(last(s).date, '2024-11-08');
  assert.ok(!last(s).upcoming);
});

test('a bad expected date is an error and adds nothing', () => {
  const s = M.FAKE(), n = s.spends.length;
  assert.strictEqual(M.addSpend(s, '2024-11-08', '5', 'X', '2024-13-40'), 'spend');
  assert.strictEqual(M.addSpend(s, '2024-11-08', '5', 'X', 'soon'), 'spend');
  assert.strictEqual(s.spends.length, n);
});

test('before its date it is upcoming; from its date it is paid by itself', () => {
  const s = M.FAKE();
  M.addSpend(s, '2024-11-08', '54.85', 'Car MOT', '2024-11-20');
  const before = M.compute(s, '2024-11-19').spends.find(x => x.name === 'Car MOT');
  assert.strictEqual(before.upcoming, true);
  assert.strictEqual(before.autoPaid, false);
  const on = M.compute(s, '2024-11-20').spends.find(x => x.name === 'Car MOT');
  assert.strictEqual(on.upcoming, false);
  assert.strictEqual(on.autoPaid, true);
  const normal = M.compute(s, '2024-11-19').spends.find(x => x.name === 'Costa');
  assert.strictEqual(normal.upcoming, false);
  assert.strictEqual(normal.autoPaid, false);
});

test('an upcoming spend counts against spare like a bill not out yet (spare is the same before and after)', () => {
  const s = M.FAKE();
  const r0 = M.compute(s, '2024-11-08');
  M.addSpend(s, '2024-11-08', '54.85', 'Car MOT', '2024-11-20');
  near(M.compute(s, '2024-11-08').leftNow, r0.leftNow - 54.85, 'before the date');
  near(M.compute(s, '2024-11-21').leftNow, r0.leftNow - 54.85, 'after the date');
});

test('⋯ Paid: an upcoming spend is paid today', () => {
  const s = M.FAKE();
  M.addSpend(s, '2024-11-08', '54.85', 'Car MOT', '2024-11-20');
  const id = last(s).id;
  assert.strictEqual(M.paySpend(s, String(id), '2024-11-10'), null);
  assert.strictEqual(last(s).date, '2024-11-10');
  assert.ok(!last(s).upcoming);
  assert.strictEqual(M.paySpend(s, '999', '2024-11-10'), null);       // a gone spend: nothing happens
});

test('⋯ Change date: any spend, a real date only', () => {
  const s = M.FAKE(), id = s.spends[0].id;
  assert.strictEqual(M.setSpendDate(s, String(id), '2024-11-02'), null);
  assert.strictEqual(s.spends[0].date, '2024-11-02');
  assert.strictEqual(s.spends[0].dated, true);
  assert.strictEqual(M.setSpendDate(s, String(id), 'nope'), 'spend');
  assert.strictEqual(M.setSpendDate(s, String(id), ''), 'spend');
  assert.strictEqual(s.spends[0].date, '2024-11-02');
});

test('a new payday keeps upcoming spends dated on or after it (they belong to the new month)', () => {
  const s = M.FAKE();
  M.addSpend(s, '2024-11-08', '54.85', 'Car MOT', '2024-11-30');
  M.addSpend(s, '2024-11-08', '10', 'Gift', '2024-11-20');
  assert.strictEqual(M.newPayday(s, '2024-11-25', '2000', ''), null);
  assert.deepStrictEqual(s.spends.map(x => x.name), ['Car MOT']);
  const saved = s.history[s.history.length - 1].spends.map(x => x.name);
  assert.ok(saved.includes('Gift') && !saved.includes('Car MOT'));
});
