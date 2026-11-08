// v0.37 (Darren, 24 Oct): spends get a category like bills; the bell groups bills by day; ⏸ Pause folds bills away;
// Google Drive keeps one file per pay month (the last 3).
// Run: node --test tests_js/*.test.js   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const pot = (r, name) => r.pots.find(p => p.name === name);

// ---------- 1. a spend's category ----------
test('set a spend category: a known name keeps its spelling, a new one joins the list', () => {
  const s = M.FAKE(), costa = s.spends.find(x => x.name === 'Costa');
  assert.strictEqual(costa.cat, 'Unsorted');
  assert.strictEqual(M.setSpendCat(s, String(costa.id), 'food shopping'), null);
  assert.strictEqual(costa.cat, 'Food shopping');
  assert.strictEqual(M.setSpendCat(s, String(costa.id), 'Coffee'), null);
  assert.strictEqual(costa.cat, 'Coffee');
  assert.ok(M.categories(s).includes('Coffee'));
});

test('a spend category: empty is an error, a gone spend is ignored', () => {
  const s = M.FAKE(), costa = s.spends.find(x => x.name === 'Costa');
  assert.strictEqual(M.setSpendCat(s, String(costa.id), '  '), 'spend');
  assert.strictEqual(costa.cat, 'Unsorted');
  assert.strictEqual(M.setSpendCat(s, '999', 'Food shopping'), null);
});

test('a spend moved into a pot category fills that pot', () => {
  const s = M.FAKE(), costa = s.spends.find(x => x.name === 'Costa');
  const before = pot(M.compute(s, '2024-11-08'), 'Shopping').spent;
  M.setSpendCat(s, String(costa.id), 'Shopping');
  near(pot(M.compute(s, '2024-11-08'), 'Shopping').spent, before + 12.5, 'Costa now in the Shopping pot');
});

// ---------- 2. the bell: one line per day ----------
test('bell lines: bills due the same day are one line, a lone bill keeps its own line', () => {
  const lines = M.remindLines(M.FAKE(), '2024-11-08');
  const bills = lines.filter(x => x.kind === 'bill' || x.kind === 'bills');
  assert.strictEqual(bills.length, 4, 'Tv Licence 28th, the 1st (2), Bills 3rd, Energy Co 5th');
  const first = bills.find(x => x.kind === 'bills');
  assert.deepStrictEqual(first.keys, ['Rent', 'Council Tax']);
  assert.match(first.text, /1st/); assert.match(first.text, /2 bills/); assert.match(first.text, /£711\.00/);
  assert.deepStrictEqual(first.items.map(i => [i.key, i.amount]), [['Rent', 550], ['Council Tax', 161]]);
  assert.strictEqual(first.items[0].go, 'tr.bill[data-key="Rent"]');
  const energy = bills.find(x => x.key === 'Energy Co');
  assert.strictEqual(energy.kind, 'bill');
  assert.match(energy.text, /Energy Co/); assert.match(energy.text, /5th/);
  assert.strictEqual(energy.go, 'tr.bill[data-key="Energy Co"]');
});

test('bell lines: in date order, other reminders after the bills', () => {
  const lines = M.remindLines(M.FAKE(), '2024-11-25');
  const kinds = lines.map(x => x.kind);
  assert.ok(kinds.indexOf('payday') > kinds.lastIndexOf('bill'));
  const days = lines.filter(x => x.kind === 'bill' || x.kind === 'bills').map(x => x.dueAt);
  assert.deepStrictEqual(days, days.slice().sort());
});

test('tick a whole day: every bill in it is paid', () => {
  const s = M.FAKE();
  assert.strictEqual(M.setBillsPaid(s, ['Rent', 'Council Tax', 'Gone']), null);
  assert.ok(s.bills.find(b => b.key === 'Rent').paid && s.bills.find(b => b.key === 'Council Tax').paid);
  assert.ok(!M.remindLines(s, '2024-11-08').some(x => x.kind === 'bills'));
});

// ---------- 3. Google Drive: one file per pay month, keep the last 3 ----------
test('drive file name = the pay month (demo has its own name)', () => {
  const s = M.FAKE();
  s.payday = '2024-10-25';
  assert.strictEqual(M.driveName(s, '2024-11-08', false), 'wheres-my-money-backup Oct 2024.json');
  assert.strictEqual(M.driveName(s, '2024-11-08', true), 'wheres-my-money-demo-backup Oct 2024.json');
  s.payday = null;
  assert.strictEqual(M.driveName(s, '2024-11-08', false), 'wheres-my-money-backup Nov 2024.json');
});

test('drive prune: keep the newest 3, delete the rest', () => {
  const f = (id, t) => ({id, name: id, modifiedTime: t});         // v0.38: same names = duplicates, so each its own name
  const files = [f('a', '2024-07-01T00:00:00Z'), f('b', '2024-10-01T00:00:00Z'), f('c', '2024-08-01T00:00:00Z'),
                 f('d', '2024-11-01T00:00:00Z'), f('e', '2024-09-01T00:00:00Z')];
  assert.deepStrictEqual(M.drivePrune(files, 3).sort(), ['a', 'c']);
  assert.deepStrictEqual(M.drivePrune(files.slice(0, 3), 3), []);
});
