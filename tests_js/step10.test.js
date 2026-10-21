// PLAN.md step 10 (Darren's 21 Oct feedback): the maths only (docs/money.js). Fake data only.
// Run: node --test tests_js/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/money.js');

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);

test('version 0.15', () => {
  assert.strictEqual(M.VERSION, '0.15');
});

// ---------- 3. top card: Starting spare and Actual spare ----------

test('starting spare = pay + left - bills - pots (set amounts); actual spare = what is left now', () => {
  const r = M.compute(M.FAKE(), '2024-11-08');
  near(r.billsTotal, 1183.73, 'bills');
  near(r.potsSet, 550, 'pots');
  near(r.startSpare, 2500 - 1183.73 - 550, 'starting spare');          // 766.27
  near(r.leftNow, 766.27 - 12.5 - 34.2, 'actual spare');               // 719.57 (Shell is in the Fuel pot)
  near(r.spare, r.leftNow, 'spare = actual spare');
});

test('starting spare does not move when a pot goes over; actual spare does', () => {
  const s = M.FAKE();
  M.addSpend(s, '2024-11-08', '100', 'Shell');                          // Fuel pot: 160 of 150
  const r = M.compute(s, '2024-11-08');
  near(r.startSpare, 766.27, 'starting spare');
  near(r.potsOver, 10, 'over');
  near(r.leftNow, 766.27 - 46.7 - 10, 'actual spare');
});

// ---------- 4. payday date: the same day each month, a weekend moves it to the Friday before ----------

test('nextPayday: this month if not gone yet, else next month; weekends go to the Friday before', () => {
  assert.strictEqual(M.nextPayday(25, '2024-11-08'), '2024-11-25');   // Monday
  assert.strictEqual(M.nextPayday(23, '2024-11-08'), '2024-11-22');   // Sat 23 Nov -> Fri 22
  assert.strictEqual(M.nextPayday(24, '2024-11-08'), '2024-11-22');   // Sun 24 Nov -> Fri 22
  assert.strictEqual(M.nextPayday(8, '2024-11-08'), '2024-11-08');    // today counts
  assert.strictEqual(M.nextPayday(25, '2024-11-26'), '2024-12-25');   // gone: next month
  assert.strictEqual(M.nextPayday(31, '2025-02-03'), '2025-02-28');   // short month: the last day (a Friday)
  assert.strictEqual(M.nextPayday(31, '2024-11-08'), '2024-11-29');   // 30 Nov 2024 is a Saturday -> Fri 29
  assert.strictEqual(M.nextPayday(null, '2024-11-08'), null);
});

test('paydayText: "25 Nov · in 17 days", tomorrow, today', () => {
  assert.strictEqual(M.paydayText('2024-11-25', '2024-11-08'), '25 Nov · in 17 days');
  assert.strictEqual(M.paydayText('2024-11-09', '2024-11-08'), '9 Nov · tomorrow');
  assert.strictEqual(M.paydayText('2024-11-08', '2024-11-08'), '8 Nov · today');
});

test('setPayDay: "25", "25th", " 1st " are fine; empty = none; anything else is an error and nothing changes', () => {
  const s = M.FAKE();
  assert.strictEqual(s.payDay, 25, 'the fake person is paid on the 25th');
  assert.strictEqual(M.setPayDay(s, '28'), null); assert.strictEqual(s.payDay, 28);
  assert.strictEqual(M.setPayDay(s, '23rd'), null); assert.strictEqual(s.payDay, 23);
  assert.strictEqual(M.setPayDay(s, ' 1st '), null); assert.strictEqual(s.payDay, 1);
  for (const bad of ['0', '32', 'abc', '2.5', '-3']) {
    assert.strictEqual(M.setPayDay(s, bad), 'pay', bad);
    assert.strictEqual(s.payDay, 1, bad);
  }
  assert.strictEqual(M.setPayDay(s, ''), null); assert.strictEqual(s.payDay, null);
  assert.strictEqual(M.TEMPLATE().payDay, null, 'a new person has no payday yet');
});

test('paydayDue: the payday has come and no new pay was typed since', () => {
  const s = M.FAKE();                                                  // this month started 25 Oct (a Friday)
  assert.strictEqual(M.paydayDue(s, '2024-11-08'), false);
  assert.strictEqual(M.paydayDue(s, '2024-11-24'), false);
  assert.strictEqual(M.paydayDue(s, '2024-11-25'), true);
  M.newPayday(s, '2024-11-25', '2500', '');
  assert.strictEqual(M.paydayDue(s, '2024-11-25'), false, 'typed: no longer due');
  const t = M.FAKE(); t.payDay = 23;                                   // Sat 23 Nov -> paid Fri 22
  assert.strictEqual(M.paydayDue(t, '2024-11-21'), false);
  assert.strictEqual(M.paydayDue(t, '2024-11-22'), true);
  const early = M.FAKE(); M.newPayday(early, '2024-11-24', '2500', '');   // typed a day early: still counts
  assert.strictEqual(M.paydayDue(early, '2024-11-25'), false);
  const none = M.FAKE(); none.payDay = null;
  assert.strictEqual(M.paydayDue(none, '2024-11-25'), false, 'no payday set: never due');
});

// ---------- 7. categories: a fixed list, + New category joins it for good ----------

test('categories(s) = the fixed list, then the person\'s own new ones', () => {
  const s = M.FAKE();
  assert.deepStrictEqual(M.categories(s), M.CATEGORIES);
  assert.strictEqual(M.setBillCat(s, 'Gym Club', 'Pets'), null);
  assert.strictEqual(s.bills.find(b => b.key === 'Gym Club').cat, 'Pets');
  assert.deepStrictEqual(s.cats, ['Pets']);
  assert.deepStrictEqual(M.categories(s), [...M.CATEGORIES, 'Pets']);
  assert.strictEqual(M.setBillCat(s, 'Rent', 'pets'), null);           // same name, other case: the one already there
  assert.strictEqual(s.bills.find(b => b.key === 'Rent').cat, 'Pets');
  assert.strictEqual(M.setBillCat(s, 'Rent', 'car'), null);
  assert.strictEqual(s.bills.find(b => b.key === 'Rent').cat, 'Car');
  assert.deepStrictEqual(s.cats, ['Pets'], 'no doubles, fixed ones are not added');
  assert.deepStrictEqual(M.TEMPLATE().cats, []);
});

// ---------- 8. the last backup ----------

test('setBackupDay remembers the day; backupText says how long ago', () => {
  const s = M.TEMPLATE();
  assert.strictEqual(M.backupText(s.lastBackup, '2024-11-08'), 'Not saved yet');
  assert.strictEqual(M.setBackupDay(s, '2024-11-08'), null);
  assert.strictEqual(s.lastBackup, '2024-11-08');
  assert.strictEqual(M.backupText('2024-11-03', '2024-11-08'), 'Last saved 3 Nov · 5 days ago');
  assert.strictEqual(M.backupText('2024-11-07', '2024-11-08'), 'Last saved 7 Nov · yesterday');
  assert.strictEqual(M.backupText('2024-11-08', '2024-11-08'), 'Last saved 8 Nov · today');
  assert.strictEqual(M.FAKE().lastBackup, '2024-11-03');
});

// ---------- 5. reminders ----------

const kinds = list => list.map(x => x.kind);

test('reminders: each bill whose due day has gone (not checked yet), with where to jump', () => {
  const s = M.FAKE(), list = M.reminders(s, '2024-11-08');
  const bills = list.filter(x => x.kind === 'bill');
  assert.deepStrictEqual(bills.map(x => x.key).sort(), ['Bills', 'Council Tax', 'Energy Co', 'Rent', 'Tv Licence']);
  const rent = bills.find(x => x.key === 'Rent');
  assert.match(rent.text, /Rent/);
  assert.strictEqual(rent.go, 'tr.bill[data-key="Rent"]');
  assert.deepStrictEqual(kinds(list), ['bill', 'bill', 'bill', 'bill', 'bill'], 'nothing else is waiting on 8 Nov');
  M.setPaid(s, 'Rent', true);                                          // ✓ checked in the bank app
  M.setStopped(s, 'Bills', true);                                      // stopped bills never remind
  assert.deepStrictEqual(M.reminders(s, '2024-11-08').map(x => x.key).sort(), ['Council Tax', 'Energy Co', 'Tv Licence']);
});

test('reminders: payday is here', () => {
  const list = M.reminders(M.FAKE(), '2024-11-25');
  const p = list.find(x => x.kind === 'payday');
  assert.ok(p, 'payday reminder');
  assert.match(p.text, /pay/i);
  assert.strictEqual(p.go, '#quicktab');
});

test('reminders: a card question waiting', () => {
  const s = M.FAKE();
  s.bills.push({key: 'Zopa Credit Cards', name: 'Zopa Credit Cards', cat: 'Savings/Transfers', amount: 100, due: 2, paid: false, stopped: false});
  const c = M.reminders(s, '2024-11-08').find(x => x.kind === 'card');
  assert.ok(c, 'card reminder');
  assert.match(c.text, /£100\.00/);
  assert.strictEqual(c.go, '.cardask[data-bill="Zopa Credit Cards"]');
  assert.strictEqual(M.cardAsk(s, '2024-11-08', 'Zopa Credit Cards', 'no'), null);
  assert.ok(!M.reminders(s, '2024-11-08').some(x => x.kind === 'card'), 'answered: gone');
});

test('reminders: no backup for 30 days (or never, once there is money in)', () => {
  assert.ok(!M.reminders(M.FAKE(), '2024-12-02').some(x => x.kind === 'backup'), '29 days: fine');
  const b = M.reminders(M.FAKE(), '2024-12-03').find(x => x.kind === 'backup');
  assert.ok(b, '30 days: remind');
  assert.strictEqual(b.go, '#qsave');
  const s = M.TEMPLATE();
  assert.deepStrictEqual(M.reminders(s, '2024-11-08'), [], 'a brand new person: nothing yet');
  M.setPay(s, '2000');
  assert.ok(M.reminders(s, '2024-11-08').some(x => x.kind === 'backup'), 'money in, never saved');
});

test('old saved states without the new fields still work', () => {
  const s = M.FAKE();
  delete s.payDay; delete s.cats; delete s.lastBackup;
  const r = M.compute(s, '2024-11-08');
  near(r.startSpare, 766.27, 'starting spare');
  assert.deepStrictEqual(M.categories(s), M.CATEGORIES);
  assert.ok(Array.isArray(M.reminders(s, '2024-11-08')));
});
