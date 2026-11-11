// v0.60 (Darren, 1 Nov): the Orbit INBOX. Orbit Agent (another app) drops one job file per change into the app's
// Google Drive folder: wmm-job-YYYYMMDD-HHMMSS-xxxx.json. Lite applies them oldest first (sort by name), skips a job id it
// has done already, and remembers which spend/bill/card line a job made (its `job` field) so remove_spend can undo it.
// Lite also writes wmm-summary.json (NOT scrambled, totals only) so Claude can answer questions.
// Run: node --test tests_js/*.test.js   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

const TODAY = '2024-11-08';
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const last = list => list[list.length - 1];
const job = (kind, more) => Object.assign({v: 1, id: 'j-' + kind + '-' + Math.random().toString(36).slice(2, 7), kind,
                                          made: '2024-11-08T09:00:00Z', from: 'Orbit'}, more);

// ---------- which files are jobs, and in what order ----------

test('jobOrder keeps only wmm-job files and sorts them by name (oldest first)', () => {
  const files = [
    {id: 'c', name: 'wmm-job-20241108-101500-zz99.json'},
    {id: 'x', name: 'wheres-my-money-backup Oct 2024.json'},
    {id: 'a', name: 'wmm-job-20241107-235959-ab12.json'},
    {id: 's', name: 'wmm-summary.json'},
    {id: 'b', name: 'wmm-job-20241108-090000-0001.json'},
    {id: 'y', name: 'my wmm-job-20241108-090000-0001.json'},
    {id: 'z', name: 'wmm-job-notadate.json'},
  ];
  assert.deepStrictEqual(M.jobOrder(files).map(f => f.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(M.jobOrder([]), []);
  assert.deepStrictEqual(M.jobOrder(null), []);
});

test('the demo has its own job files (never the real ones)', () => {
  const files = [{id: 'r', name: 'wmm-job-20241108-090000-0001.json'}, {id: 'd', name: 'wmm-demo-job-20241108-090000-0002.json'}];
  assert.deepStrictEqual(M.jobOrder(files, true).map(f => f.id), ['d']);
  assert.deepStrictEqual(M.jobOrder(files, false).map(f => f.id), ['r']);
});

// ---------- add_spend ----------

test('add_spend paid now: a spend dated today, its job id kept, a short note back', () => {
  const s = M.FAKE(), j = job('add_spend', {amount: 5.1, name: 'Tesco'});
  const r = M.applyJob(s, j, TODAY);
  assert.strictEqual(r.done, true);
  assert.strictEqual(r.note, 'Added by Orbit: £5.10 Tesco');
  const x = last(s.spends);
  assert.strictEqual(x.amount, 5.1);
  assert.strictEqual(x.name, 'Tesco');
  assert.strictEqual(x.date, TODAY);
  assert.strictEqual(x.job, j.id);
  assert.ok(!x.upcoming);
  assert.ok(Number.isInteger(x.id));                                 // the app's own number id stays (rows, ⋯, Remove)
  assert.ok(s.jobsDone.includes(j.id));
});

test('add_spend with a past date = paid on that day', () => {
  const s = M.FAKE();
  M.applyJob(s, job('add_spend', {amount: '10.35', name: 'Tesco', date: '2024-11-02'}), TODAY);
  const x = last(s.spends);
  assert.strictEqual(x.date, '2024-11-02');
  assert.ok(!x.upcoming);
});

test('add_spend upcoming with a date = a bill to come on that day', () => {
  const s = M.FAKE();
  const r = M.applyJob(s, job('add_spend', {amount: 150, name: 'Hairdressers', date: '2024-11-25', upcoming: true}), TODAY);
  const x = last(s.spends);
  assert.strictEqual(x.upcoming, true);
  assert.ok(!x.nodate);
  assert.strictEqual(x.date, '2024-11-25');
  assert.strictEqual(M.compute(s, TODAY).spends.find(y => y.name === 'Hairdressers').upcoming, true);
  assert.strictEqual(r.note, 'Added by Orbit: £150.00 Hairdressers');
});

test('add_spend upcoming with no date = a maybe bill (no date yet)', () => {
  const s = M.FAKE();
  M.applyJob(s, job('add_spend', {amount: 350, name: 'Xmas present', upcoming: true}), TODAY);
  const x = last(s.spends);
  assert.strictEqual(x.upcoming, true);
  assert.strictEqual(x.nodate, true);
});

test('the note uses who sent it (from), Orbit when missing', () => {
  const s = M.FAKE();
  assert.strictEqual(M.applyJob(s, job('add_spend', {amount: 2, name: 'Costa', from: 'Claude'}), TODAY).note, 'Added by Claude: £2.00 Costa');
  const j = job('add_spend', {amount: 3, name: 'Greggs'}); delete j.from;
  assert.strictEqual(M.applyJob(s, j, TODAY).note, 'Added by Orbit: £3.00 Greggs');
});

// ---------- add_bill ----------

test('add_bill = a monthly bill with its due day, job id kept', () => {
  const s = M.FAKE(), j = job('add_bill', {amount: 9.95, name: 'Apple TV', day: 10});
  const r = M.applyJob(s, j, TODAY);
  const b = last(s.bills);
  assert.strictEqual(b.name, 'Apple TV');
  assert.strictEqual(b.amount, 9.95);
  assert.strictEqual(b.due, 10);
  assert.strictEqual(b.job, j.id);
  assert.strictEqual(r.note, 'Added by Orbit: £9.95 Apple TV (monthly)');
});

test('add_bill with no day (or a bad day) has no due day', () => {
  const s = M.FAKE();
  M.applyJob(s, job('add_bill', {amount: 5, name: 'Spotify'}), TODAY);
  assert.strictEqual(last(s.bills).due, null);
  M.applyJob(s, job('add_bill', {amount: 6, name: 'Netflix', day: 40}), TODAY);
  assert.strictEqual(last(s.bills).name, 'Netflix');
  assert.strictEqual(last(s.bills).due, null);
});

// ---------- the credit card ----------

test('card_spend adds to the first credit card', () => {
  const s = M.FAKE(), j = job('card_spend', {amount: 50, name: 'Fuel'});
  const r = M.applyJob(s, j, TODAY);
  const i = last(s.cards[0].items);
  assert.strictEqual(i.amount, 50);
  assert.strictEqual(i.name, 'Fuel');
  assert.strictEqual(i.date, TODAY);
  assert.strictEqual(i.job, j.id);
  assert.strictEqual(M.compute(s, TODAY).cards[0].used, 95);
  assert.strictEqual(r.note, 'Added by Orbit: £50.00 Fuel on Zopa');
});

test('card_paid_off takes money off the card', () => {
  const s = M.FAKE(), j = job('card_paid_off', {amount: 20, date: '2024-11-07'});
  const r = M.applyJob(s, j, TODAY);
  const i = last(s.cards[0].items);
  assert.strictEqual(i.amount, -20);
  assert.strictEqual(i.date, '2024-11-07');
  assert.strictEqual(i.job, j.id);
  assert.strictEqual(M.compute(s, TODAY).cards[0].used, 25);
  assert.strictEqual(r.note, 'Added by Orbit: £20.00 paid off Zopa');
});

test('no credit card = the card job is not done (a note says why)', () => {
  const s = M.FAKE(); s.cards = [];
  const r = M.applyJob(s, job('card_spend', {amount: 5, name: 'Fuel'}), TODAY);
  assert.strictEqual(r.done, false);
  assert.match(r.note, /no credit card/i);
});

// ---------- remove_spend (undo) ----------

test('remove_spend undoes a spend by its job id', () => {
  const s = M.FAKE(), add = job('add_spend', {amount: 5.1, name: 'Tesco'});
  M.applyJob(s, add, TODAY);
  const n = s.spends.length;
  const r = M.applyJob(s, job('remove_spend', {target: add.id}), TODAY);
  assert.strictEqual(s.spends.length, n - 1);
  assert.ok(!s.spends.some(x => x.job === add.id));
  assert.strictEqual(r.note, 'Removed by Orbit: £5.10 Tesco');
});

test('remove_spend also undoes a bill or a card line', () => {
  const s = M.FAKE();
  const bill = job('add_bill', {amount: 9.95, name: 'Apple TV', day: 10});
  const card = job('card_spend', {amount: 50, name: 'Fuel'});
  const paid = job('card_paid_off', {amount: 20});
  [bill, card, paid].forEach(j => M.applyJob(s, j, TODAY));
  M.applyJob(s, job('remove_spend', {target: bill.id}), TODAY);
  M.applyJob(s, job('remove_spend', {target: card.id}), TODAY);
  M.applyJob(s, job('remove_spend', {target: paid.id}), TODAY);
  assert.ok(!s.bills.some(b => b.name === 'Apple TV'));
  assert.strictEqual(M.compute(s, TODAY).cards[0].used, 45);
});

test('remove_spend never touches spends the person typed (no job id)', () => {
  const s = M.FAKE(), n = s.spends.length;
  const r = M.applyJob(s, job('remove_spend', {target: '1'}), TODAY);   // '1' = a typed spend's own number id
  assert.strictEqual(s.spends.length, n);
  assert.strictEqual(r.done, true);
  assert.match(r.note, /nothing to remove/i);
});

test('remove_spend before its add (or for a job never seen) also stops that job ever being added', () => {
  const s = M.FAKE(), n = s.spends.length;
  M.applyJob(s, job('remove_spend', {target: 'late-1'}), TODAY);
  const r = M.applyJob(s, {v: 1, id: 'late-1', kind: 'add_spend', made: 'x', from: 'Orbit', amount: 4, name: 'Late'}, TODAY);
  assert.strictEqual(r.skip, 'done');
  assert.strictEqual(s.spends.length, n);
});

// ---------- no doubles, bad jobs ----------

test('the same job id twice = done once (no doubles)', () => {
  const s = M.FAKE(), j = job('add_spend', {amount: 5.1, name: 'Tesco'}), n = s.spends.length;
  M.applyJob(s, j, TODAY);
  const again = M.applyJob(s, Object.assign({}, j), TODAY);
  assert.strictEqual(again.skip, 'done');
  assert.strictEqual(again.done, false);
  assert.strictEqual(s.spends.length, n + 1);
});

test('jobsDone keeps the newest 300 ids only', () => {
  const s = M.FAKE();
  for (let i = 0; i < 305; i++) M.applyJob(s, {v: 1, id: 'k' + i, kind: 'remove_spend', target: 'none' + i}, TODAY);
  assert.ok(s.jobsDone.length <= 300);
  assert.ok(s.jobsDone.includes('k304'));
  assert.ok(!s.jobsDone.includes('k0'));
});

test('a bad amount or a missing name is not added, but counts as done (the file can go)', () => {
  const s = M.FAKE(), n = s.spends.length;
  for (const bad of [{amount: 'abc', name: 'Tesco'}, {amount: -5, name: 'Tesco'}, {amount: 5, name: ''}, {amount: 5}]) {
    const r = M.applyJob(s, job('add_spend', bad), TODAY);
    assert.strictEqual(r.done, false);
    assert.strictEqual(r.skip, 'bad');
    assert.match(r.note, /could not add/i);
  }
  assert.strictEqual(s.spends.length, n);
});

test('an unknown kind, another version or no id = left alone (a newer app may know it)', () => {
  const s = M.FAKE(), before = JSON.stringify(s);
  assert.strictEqual(M.applyJob(s, {v: 1, id: 'a1', kind: 'add_pot', amount: 5}, TODAY).skip, 'unknown');
  assert.strictEqual(M.applyJob(s, {v: 2, id: 'a2', kind: 'add_spend', amount: 5, name: 'X'}, TODAY).skip, 'unknown');
  assert.strictEqual(M.applyJob(s, {v: 1, kind: 'add_spend', amount: 5, name: 'X'}, TODAY).skip, 'unknown');
  assert.strictEqual(M.applyJob(s, null, TODAY).skip, 'unknown');
  assert.strictEqual(JSON.stringify(s), before);
});

test('a job survives a backup and a new month (jobsDone + job ids are kept)', () => {
  const s = M.FAKE(), j = job('add_spend', {amount: 5, name: 'Tesco'});
  M.applyJob(s, j, TODAY);
  const back = M.importBackup(M.exportBackup(s, TODAY));
  assert.ok(back.jobsDone.includes(j.id));
  assert.strictEqual(last(back.spends).job, j.id);
});

// ---------- the summary file (for Claude) ----------

test('summary = totals only: spare, spent, to come out, pots, card', () => {
  const s = M.FAKE(), r = M.compute(s, TODAY);
  const sum = M.summary(s, TODAY, '2024-11-08T10:00:00.000Z');
  assert.deepStrictEqual(Object.keys(sum).sort(), ['added', 'bills', 'card', 'money_in', 'pots', 'spare', 'spent', 'to_come_out', 'updated']);   // v0.70: + money_in
  assert.strictEqual(sum.updated, '2024-11-08T10:00:00.000Z');
  near(sum.spare, r.leftNow, 'spare = Actual spare');
  near(sum.spent, 106.7, 'spent = spends paid so far');
  near(sum.to_come_out, 152.36, 'bills not due yet (Gym 50 + Sky 46.50 + Phone 40.11 + Water 15.75)');
  assert.deepStrictEqual(sum.pots, [{name: 'Shopping', budget: 400, used: 0}, {name: 'Fuel', budget: 150, used: 60},
                                    {name: 'Going out', budget: null, used: 0}]);
  assert.deepStrictEqual(sum.card, {used: 45, free: 455});
  assert.ok(!('spends' in sum));
  assert.ok(!JSON.stringify(sum).includes('Tesco'));                 // no spend names in it
});

test('summary: upcoming spends count in to come out, not in spent; paid bills leave to come out', () => {
  const s = M.FAKE();
  M.applyJob(s, job('add_spend', {amount: 150, name: 'Hairdressers', date: '2024-11-25', upcoming: true}), TODAY);
  M.applyJob(s, job('add_spend', {amount: 350, name: 'Xmas present', upcoming: true}), TODAY);
  M.setPaid(s, 'Gym Club', true);
  const sum = M.summary(s, TODAY, 'now');
  near(sum.spent, 106.7, 'spent');
  near(sum.to_come_out, 152.36 - 50 + 150 + 350, 'to come out');
  near(sum.spare, M.compute(s, TODAY).leftNow, 'spare');
});

test('summary: a stopped (paused) bill is not still to come; card totals add up every card', () => {
  const s = M.FAKE();
  M.setStopped(s, 'Sky Digital', true);
  M.addCreditCard(s, 'Barclaycard', '1000');
  M.cardAdd(s, TODAY, '100', 'Argos', false, 'Barclaycard');
  const sum = M.summary(s, TODAY, 'now');
  near(sum.to_come_out, 152.36 - 46.5, 'to come out');
  assert.deepStrictEqual(sum.card, {used: 145, free: 1355});
});

// v0.60b (Darren, 1 Nov): bills in the summary too, so Claude can answer 'has my phone been paid?'
test('summary bills: name, amount, day, paid (paid = ticked or the due day has gone); paused bills left out', () => {
  const s = M.FAKE();
  M.setPaid(s, 'Gym Club', true);
  M.setStopped(s, 'Sky Digital', true);
  M.addBill(s, '', 'Netflix');
  M.setDue(s, 'Water Board', 'varies');
  const b = M.summary(s, TODAY, 'now').bills;
  const by = n => b.find(x => x.name === n);
  assert.deepStrictEqual(Object.keys(by('Rent')).sort(), ['amount', 'day', 'name', 'paid']);
  assert.deepStrictEqual(by('Rent'), {name: 'Rent', amount: 550, day: 1, paid: true});          // due 1 Nov: gone
  assert.deepStrictEqual(by('Phone Co'), {name: 'Phone Co', amount: 40.11, day: 18, paid: false});
  assert.deepStrictEqual(by('Gym Club'), {name: 'Gym Club', amount: 50, day: 10, paid: true});   // ticked by hand
  assert.deepStrictEqual(by('Netflix'), {name: 'Netflix', amount: null, day: null, paid: false});
  assert.deepStrictEqual(by('Water Board'), {name: 'Water Board', amount: 15.75, day: 'varies', paid: false});
  assert.strictEqual(by('Sky Digital'), undefined);
});
