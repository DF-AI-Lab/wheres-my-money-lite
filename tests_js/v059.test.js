// v0.59 (Darren, 28 Oct, mock https://claude.ai/artifact/XbW57xUDPGfMqHwbKiLnSa): an Upcoming spend can have NO DATE YET
// (stays still to come until Paid), and a bill's due day can be 'varies' (no set date).
// Run: node --test tests_js/*.test.js   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const last = s => s.spends[s.spends.length - 1];

test('an upcoming spend with no date yet stays still to come, whatever the day', () => {
  const s = M.FAKE();
  assert.strictEqual(M.addSpend(s, '2024-11-08', '500', 'KT Xmas', '', true), null);
  assert.strictEqual(last(s).upcoming, true);
  assert.strictEqual(last(s).nodate, true);
  assert.strictEqual(last(s).date, '2024-11-08');
  for (const day of ['2024-11-08', '2024-11-30', '2025-01-01']) {
    const x = M.compute(s, day).spends.find(y => y.name === 'KT Xmas');
    assert.strictEqual(x.upcoming, true, day);
    assert.strictEqual(x.autoPaid, false, day);
  }
});

test('no date yet counts against spare now', () => {
  const s = M.FAKE(), r0 = M.compute(s, '2024-11-08');
  M.addSpend(s, '2024-11-08', '500', 'KT Xmas', '', true);
  near(M.compute(s, '2024-11-08').leftNow, r0.leftNow - 500, 'left now');
});

test('Paid on a no-date spend: paid today, no longer upcoming', () => {
  const s = M.FAKE();
  M.addSpend(s, '2024-11-08', '500', 'KT Xmas', '', true);
  M.paySpend(s, String(last(s).id), '2024-11-12');
  assert.ok(!last(s).upcoming && !last(s).nodate);
  assert.strictEqual(last(s).date, '2024-11-12');
});

test('giving a no-date spend a date makes it a normal upcoming spend', () => {
  const s = M.FAKE();
  M.addSpend(s, '2024-11-08', '120', 'KT Hair', '', true);
  M.setSpendDate(s, String(last(s).id), '2024-11-20');
  assert.ok(!last(s).nodate);
  assert.strictEqual(M.compute(s, '2024-11-21').spends.find(y => y.name === 'KT Hair').autoPaid, true);
});

test('a no-date spend moves on to the next month at payday', () => {
  const s = M.FAKE();
  M.addSpend(s, '2024-11-08', '500', 'KT Xmas', '', true);
  assert.strictEqual(M.newPayday(s, '2024-11-29', '2000', '0'), null);
  assert.ok(s.spends.some(x => x.name === 'KT Xmas' && x.nodate));
});

test('bill due day: varies is kept, shown as "varies", never past due', () => {
  const s = M.FAKE(), key = s.bills[0].key;
  assert.strictEqual(M.setDue(s, key, 'Varies'), null);
  assert.strictEqual(s.bills[0].due, 'varies');
  const b = M.compute(s, '2024-11-28').bills.find(x => x.key === key);
  assert.strictEqual(b.varies, true);
  assert.strictEqual(b.dueText, 'varies');
  assert.strictEqual(b.duePassed, false);
  assert.strictEqual(M.setDue(s, key, '20'), null);
  assert.strictEqual(s.bills[0].due, 20);
});
