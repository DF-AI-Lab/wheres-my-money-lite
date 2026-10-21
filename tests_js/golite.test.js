// Go A (PLAN.md steps 1-4): saving + backup file, bills, payday + history, pots. The maths only (docs/money.js).
// Run: node --test tests_js/   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/money.js');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: ${a} != ${b}`);
const bill = (key, amount, due, extra) => Object.assign({key, name: key, cat: 'Household', amount, due: due || null,
                                                         paid: false, stopped: false}, extra || {});
// A small month: pay 2000, two bills, two pots, three spends. today = 8 Nov 2024, payday was 25 Oct 2024.
function small() {
  return {
    v: 2, pay: 2000, left: 100, payday: '2024-10-25',
    bills: [bill('Rent', 600, 1), bill('Gym', 30, 10), bill('Phone', null, 18)],
    pots: [{key: 'Shopping', name: 'Shopping', cat: 'Shopping', amount: 200},
           {key: 'Fuel', name: 'Fuel', cat: 'Fuel', amount: 100},
           {key: 'Going out', name: 'Going out', cat: 'Going out', amount: null}],
    spends: [{id: 1, date: '2024-10-26', amount: 50, name: 'Amazon', cat: 'Shopping'},
             {id: 2, date: '2024-10-27', amount: 130, name: 'Shell', cat: 'Fuel'},
             {id: 3, date: '2024-10-28', amount: 20, name: 'Costa', cat: 'Unsorted'},
             {id: 4, date: '2024-10-29', amount: 15, name: 'Pub', cat: 'Going out'}],
    history: [],
    card: {limit: 500, carry: 0, next: 1, items: []},
  };
}

// ---------- step 1: saving + backup file ----------

test('TEMPLATE: a new person starts with the agreed bills and pots, amounts blank, no fake numbers', () => {
  const s = M.TEMPLATE();
  assert.deepStrictEqual(s.bills.map(b => b.name), ['Rent / Mortgage', 'Council tax', 'Gas & electric', 'Water', 'Phone',
    'Broadband', 'TV licence', 'Car insurance']);
  assert.ok(s.bills.every(b => b.amount === null && b.due === null && !b.paid && !b.stopped));
  assert.deepStrictEqual(s.pots.map(p => [p.name, p.cat, p.amount]),
    [['Shopping', 'Shopping', null], ['Fuel', 'Fuel', null], ['Going out', 'Going out', null]]);
  assert.strictEqual(s.pay, 0); assert.deepStrictEqual(s.spends, []); assert.deepStrictEqual(s.history, []);
  assert.strictEqual(s.v, 3);                                       // v3 since step 5 (several cards)
  const r = M.compute(s, '2024-11-08');
  near(r.billsTotal, 0, 'blank bills count 0'); near(r.spare, 0, 'spare');
});

test('backup file: export wraps the state, import gives it back; junk is refused', () => {
  const s = small();
  const file = M.exportBackup(s, '2024-11-08');
  assert.strictEqual(file.app, 'wheres-my-money-lite');
  assert.strictEqual(file.saved, '2024-11-08');
  assert.ok(typeof file.version === 'string' && file.version.length > 0);
  const back = M.importBackup(JSON.parse(JSON.stringify(file)));
  assert.deepStrictEqual(back, M.migrate(JSON.parse(JSON.stringify(s))));   // v2 comes back as v3 (step 5)
  assert.notStrictEqual(back, s);                                   // a copy, not the same object
  assert.strictEqual(M.importBackup({app: 'something else', state: s}), null);
  assert.strictEqual(M.importBackup({app: 'wheres-my-money-lite'}), null);
  assert.strictEqual(M.importBackup(null), null);
  assert.strictEqual(M.importBackup('not json'), null);
  assert.strictEqual(M.backupName('2024-11-08'), 'wheres-my-money-backup-2024-11-08.json');
});

test('migrate: an old step-2 state (avg/last/change) becomes the new shape and keeps its numbers', () => {
  const old = {pay: 2500, left: 0, cycles: 2,
    bills: [{key: 'Rent', name: 'Rent', cat: 'Household', type: 'SO', avg: 550, last: 550, stopped: false},
            {key: 'Sky', name: 'Sky', cat: 'Household', type: 'DD', avg: 46.5, last: 46.5, change: 50}],
    spends: [{id: 1, date: '2024-10-25', amount: 12.5, name: 'Costa', cat: 'Unsorted'}],
    card: {limit: 500, carry: 0, next: 1, items: []}};
  const s = M.migrate(old);
  assert.strictEqual(s.v, 3);                                       // v3 since step 5 (several cards)
  assert.deepStrictEqual(s.bills.map(b => [b.key, b.amount]), [['Rent', 550], ['Sky', 50]]);
  assert.ok(Array.isArray(s.pots) && Array.isArray(s.history));
  assert.strictEqual(M.migrate(s), s);                              // already new: left alone
});

// ---------- step 2: bills ----------

test('bills: add, rename, due day, delete (keys stay unique, errors = "bill")', () => {
  const s = small();
  assert.strictEqual(M.addBill(s, '12.99', 'Netflix'), null);
  assert.deepStrictEqual(s.bills.at(-1), {key: 'Netflix', name: 'Netflix', cat: 'Subscriptions', amount: 12.99, due: null,
                                          paid: false, stopped: false});
  assert.strictEqual(M.addBill(s, '', 'Netflix'), null);            // same name again: blank amount is fine, key made unique
  assert.strictEqual(s.bills.at(-1).key, 'Netflix 2');
  assert.strictEqual(s.bills.at(-1).amount, null);
  assert.strictEqual(M.addBill(s, '10', '  '), 'bill');             // no name
  assert.strictEqual(M.addBill(s, 'abc', 'Water'), 'bill');         // amount typed but not money

  assert.strictEqual(M.renameBill(s, 'Gym', 'Gym (PureGym)'), null);
  assert.strictEqual(s.bills.find(b => b.key === 'Gym').name, 'Gym (PureGym)');
  assert.strictEqual(M.renameBill(s, 'Gym', ''), 'bill');

  assert.strictEqual(M.setDue(s, 'Gym', '31'), null); assert.strictEqual(s.bills.find(b => b.key === 'Gym').due, 31);
  assert.strictEqual(M.setDue(s, 'Gym', ''), null); assert.strictEqual(s.bills.find(b => b.key === 'Gym').due, null);
  assert.strictEqual(M.setDue(s, 'Gym', '0'), 'bill');
  assert.strictEqual(M.setDue(s, 'Gym', '32'), 'bill');
  assert.strictEqual(M.setDue(s, 'Gym', '1.5'), 'bill');

  assert.strictEqual(M.deleteBill(s, 'Netflix 2'), null);
  assert.ok(!s.bills.some(b => b.key === 'Netflix 2'));
  assert.strictEqual(M.deleteBill(s, 'Nope'), 'unknown');
});

test('bills: the amount carries over; tap-change sets it; blank puts back last saved month (or nothing)', () => {
  const s = small();
  assert.strictEqual(M.setBill(s, 'Rent', '650'), null);
  assert.strictEqual(s.bills[0].amount, 650);
  assert.strictEqual(M.setBill(s, 'Rent', '0'), null);              // 0 = not paying it this month
  assert.strictEqual(s.bills[0].amount, 0);
  assert.strictEqual(M.setBill(s, 'Rent', 'xx'), 'pay');
  s.history.push({start: '2024-09-25', end: '2024-10-24', pay: 2000, left: 0, spare: 0,
                  bills: [{key: 'Rent', name: 'Rent', cat: 'Household', amount: 590, stopped: false}], spends: [], pots: []});
  assert.strictEqual(M.setBill(s, 'Rent', ''), null);
  assert.strictEqual(s.bills[0].amount, 590);                       // back to last saved month
  assert.strictEqual(M.setBill(s, 'Gym', ''), null);
  assert.strictEqual(s.bills[1].amount, 30);                        // never saved: stays as it was
});

test('bills: avg and diff come from saved months; no saved months = avg is the amount', () => {
  const s = small();
  const h = (start, end, rent, gym) => ({start, end, pay: 2000, left: 0, spare: 0, spends: [], pots: [],
    bills: [{key: 'Rent', name: 'Rent', cat: 'Household', amount: rent, stopped: false},
            {key: 'Gym', name: 'Gym', cat: 'Household', amount: gym, stopped: gym === 0}]});
  let r = M.compute(s, '2024-11-08');
  const rent0 = r.bills.find(b => b.key === 'Rent');
  near(rent0.avg, 600, 'avg = amount'); near(rent0.diff, 0, 'diff');
  s.history.push(h('2024-08-25', '2024-09-24', 580, 0), h('2024-09-25', '2024-10-24', 590, 30));
  r = M.compute(s, '2024-11-08');
  const rent = r.bills.find(b => b.key === 'Rent'), gym = r.bills.find(b => b.key === 'Gym');
  near(rent.avg, 585, 'rent avg of 580 + 590'); near(rent.diff, 15, 'rent diff 600 - 585');
  near(gym.avg, 30, 'stopped months are left out of the avg');
  near(r.billsTotal, 630, 'blank Phone counts 0');
  assert.strictEqual(r.bills.find(b => b.key === 'Phone').blank, true);
  assert.strictEqual(r.cycles, 2);                                  // the 'N-mth avg' heading = saved months (min 1)
});

test('bills: due day text and Paid ⓘ only after the due date in this pay month; ticking survives, never by itself', () => {
  const s = small();
  s.bills.push(bill('Water', 20, 28), bill('Tv', 13.25, 31));
  let r = M.compute(s, '2024-11-08');
  const get = k => r.bills.find(b => b.key === k);
  assert.strictEqual(get('Rent').dueText, '1st');
  assert.strictEqual(get('Gym').dueText, '10th');
  assert.strictEqual(get('Phone').dueText, '18th');
  assert.strictEqual(M.ordinal(2), '2nd'); assert.strictEqual(M.ordinal(3), '3rd'); assert.strictEqual(M.ordinal(11), '11th');
  assert.strictEqual(M.ordinal(12), '12th'); assert.strictEqual(M.ordinal(13), '13th'); assert.strictEqual(M.ordinal(21), '21st');
  assert.strictEqual(M.ordinal(22), '22nd'); assert.strictEqual(M.ordinal(23), '23rd');
  // payday 25 Oct: Rent due 1 Nov (passed), Gym 10 Nov (not yet), Water 28 Oct (passed), Tv 31 Oct (passed)
  assert.deepStrictEqual(['Rent', 'Gym', 'Water', 'Tv'].map(k => get(k).duePassed), [true, false, true, true]);
  assert.strictEqual(get('Rent').paid, false);                      // never ticked by itself
  assert.strictEqual(M.setPaid(s, 'Rent', true), null);
  r = M.compute(s, '2024-11-08');
  assert.strictEqual(get('Rent').paid, true);
  // day 31 in a 30-day month: due on the last day (payday 1 Nov -> 30 Nov)
  s.payday = '2024-11-01';
  assert.strictEqual(M.compute(s, '2024-11-29').bills.find(b => b.key === 'Tv').duePassed, false);
  assert.strictEqual(M.compute(s, '2024-11-30').bills.find(b => b.key === 'Tv').duePassed, true);
  // no payday yet: the calendar month
  delete s.payday;
  assert.strictEqual(M.compute(s, '2024-11-09').bills.find(b => b.key === 'Gym').duePassed, false);
  assert.strictEqual(M.compute(s, '2024-11-10').bills.find(b => b.key === 'Gym').duePassed, true);
});

test('bills: stopped = not counted, kept in the list, Count it again brings it back', () => {
  const s = small();
  assert.strictEqual(M.setStopped(s, 'Rent', true), null);
  let r = M.compute(s, '2024-11-08');
  near(r.billsTotal, 30, 'only Gym'); assert.strictEqual(r.bills.find(b => b.key === 'Rent').stopped, true);
  assert.strictEqual(r.bills.at(-1).key, 'Rent');                    // stopped ones go to the bottom
  M.setStopped(s, 'Rent', false);
  near(M.compute(s, '2024-11-08').billsTotal, 630, 'counted again');
});

// ---------- step 4: pots ----------

test('pots: a set pot comes off spare like a bill; over comes off too; spends in a pot are not "Spends"', () => {
  const r = M.compute(small(), '2024-11-08');
  const shop = r.pots.find(p => p.key === 'Shopping'), fuel = r.pots.find(p => p.key === 'Fuel');
  near(shop.spent, 50, 'shopping spent'); near(shop.left, 150, 'shopping left'); near(shop.over, 0, 'shopping over');
  near(fuel.spent, 130, 'fuel spent'); near(fuel.left, 0, 'fuel left'); near(fuel.over, 30, 'fuel over');
  assert.strictEqual(shop.pct, 25); assert.strictEqual(fuel.pct, 100);   // bar width, capped at 100
  near(r.potsSet, 300, 'set'); near(r.potsOver, 30, 'over'); near(r.potsTotal, 330, '− Pots line = set + over');
  // Going out has no amount: not a pot yet, so the Pub spend is an ordinary spend
  assert.strictEqual(r.pots.find(p => p.key === 'Going out').blank, true);
  near(r.spendsTotal, 35, '− Spends = not in a pot (Costa + Pub)');
  near(r.billsTotal, 630, 'bills');
  near(r.spare, 2000 + 100 - 630 - (50 + 130) - 35, 'spare = real money left: pay + left - bills - every spend (21 Oct evening)');
  near(r.potsSpent, 180, 'spent from pots'); near(r.potsLeft, 150, 'pot money not spent yet');
  near(r.moneyForSpending, 2100 - 630 - 300, 'money for spending = after bills and pots set aside');
  near(r.leftNow, r.spare, 'left now = spare');
  assert.deepStrictEqual(r.pct, {bills: 30, pots: 9, spends: 2, spare: 60});   // pots slice = spent from pots
});

test('pots: add, change amount, rename, delete; a spend goes in by its category', () => {
  const s = small();
  assert.strictEqual(M.addPot(s, '80', 'Going out'), 'pot');        // name already a pot
  assert.strictEqual(M.addPot(s, '60', 'Takeaways'), null);
  assert.deepStrictEqual(s.pots.at(-1), {key: 'Takeaways', name: 'Takeaways', cat: 'Takeaways', amount: 60});
  assert.strictEqual(M.addPot(s, '', ''), 'pot');
  assert.strictEqual(M.setPotAmount(s, 'Going out', '80'), null);
  assert.strictEqual(s.pots.find(p => p.key === 'Going out').amount, 80);
  assert.strictEqual(M.setPotAmount(s, 'Going out', ''), null);      // blank = no amount (not a pot for now)
  assert.strictEqual(s.pots.find(p => p.key === 'Going out').amount, null);
  assert.strictEqual(M.setPotAmount(s, 'Going out', 'x'), 'pot');
  assert.strictEqual(M.renamePot(s, 'Fuel', 'Car fuel'), null);
  assert.strictEqual(s.pots.find(p => p.key === 'Fuel').name, 'Car fuel');
  assert.strictEqual(s.pots.find(p => p.key === 'Fuel').cat, 'Fuel');  // the category it collects stays
  assert.strictEqual(M.deletePot(s, 'Takeaways'), null);
  assert.ok(!s.pots.some(p => p.key === 'Takeaways'));
  // new categories so the template pots fill by themselves
  assert.strictEqual(M.guessCategory('Shell'), 'Fuel');
  assert.strictEqual(M.guessCategory('ESSO PETROL'), 'Fuel');
  assert.strictEqual(M.guessCategory('The Red Lion pub'), 'Going out');
  assert.strictEqual(M.guessCategory('Odeon cinema'), 'Going out');
  assert.strictEqual(M.guessCategory('Amazon'), 'Shopping');
  assert.strictEqual(M.guessCategory('DVLA'), 'Car');
  M.addSpend(s, '2024-11-08', '25', 'Esso');
  near(M.compute(s, '2024-11-08').pots.find(p => p.key === 'Fuel').spent, 155, 'Esso went into Fuel');
});

// ---------- step 3: payday + history ----------

test('newPayday: saves the month, starts a new one, bills carry over, paid resets, spends clear', () => {
  const s = small();
  M.setPaid(s, 'Rent', true);
  const before = M.compute(s, '2024-11-24');
  const realSpare = 2100 - 630 - 215;                               // pots give back what was not spent
  near(M.monthEndSpare(s), realSpare, 'what is really left at payday');
  assert.strictEqual(M.newPayday(s, '2024-11-25', '2100', String(realSpare)), null);
  assert.strictEqual(s.history.length, 1);
  const m = s.history[0];
  assert.strictEqual(m.start, '2024-10-25'); assert.strictEqual(m.end, '2024-11-24');
  near(m.pay, 2000, 'saved pay'); near(m.left, 100, 'saved left'); near(m.spare, realSpare, 'saved spare');
  assert.deepStrictEqual(m.bills.map(b => [b.key, b.amount]), [['Rent', 600], ['Gym', 30], ['Phone', null]]);
  assert.strictEqual(m.spends.length, 4);
  assert.deepStrictEqual(m.pots.map(p => [p.key, p.amount, p.spent]), [['Shopping', 200, 50], ['Fuel', 100, 130], ['Going out', null, 15]]);
  // the new month
  assert.strictEqual(s.payday, '2024-11-25'); near(s.pay, 2100, 'new pay'); near(s.left, realSpare, 'left');
  assert.deepStrictEqual(s.spends, []);
  assert.ok(s.bills.every(b => b.paid === false));
  assert.deepStrictEqual(s.bills.map(b => b.amount), [600, 30, null]);
  assert.deepStrictEqual(s.pots.map(p => p.amount), [200, 100, null]);
  assert.ok(before.spare < realSpare);
  // errors: a bad pay = 'pay'; a bad left = 'pay'; blank left = 0
  assert.strictEqual(M.newPayday(s, '2024-12-25', 'abc', ''), 'pay');
  assert.strictEqual(s.history.length, 1);
  assert.strictEqual(M.newPayday(s, '2024-12-25', '2100', ''), null);
  near(s.left, 0, 'blank left');
});

// three saved months for the history cards (start dates 25 Jul, 25 Aug, 25 Sep 2024)
function withHistory() {
  const s = small();
  const month = (start, end, pay, rent, spends) => ({start, end, pay, left: 0, spare: 0,
    bills: [{key: 'Rent', name: 'Rent', cat: 'Household', amount: rent, stopped: false},
            {key: 'Gym', name: 'Gym', cat: 'Household', amount: 30, stopped: false}],
    spends: spends.map(([amount, name, cat], i) => ({id: i + 1, date: start, amount, name, cat})),
    pots: [{key: 'Shopping', name: 'Shopping', cat: 'Shopping', amount: 200, spent: 0}]});
  s.history = [
    month('2023-12-25', '2024-01-24', 1900, 580, [[100, 'Tesco', 'Food shopping']]),
    month('2024-07-25', '2024-08-24', 2000, 580, [[200, 'Tesco', 'Food shopping'], [60, 'Shell', 'Fuel']]),
    month('2024-08-25', '2024-09-24', 2000, 590, [[220, 'Tesco', 'Food shopping'], [40, 'Amazon', 'Shopping']]),
    month('2024-09-25', '2024-10-24', 2000, 600, [[240, 'Tesco', 'Food shopping'], [5.5, 'Costa', 'Unsorted'],
                                                 [2.5, 'Costa', 'Unsorted'], [80, 'Shell', 'Fuel']]),
  ];
  return s;
}

test('Last month\'s spending: the newest saved month, bills then categories (biggest first) with their shops', () => {
  const r = M.compute(withHistory(), '2024-11-08');
  const lm = r.lastMonth;
  assert.strictEqual(lm.start, '2024-09-25'); assert.strictEqual(lm.end, '2024-10-24');
  near(lm.bills, 630, 'bills row');
  assert.deepStrictEqual(lm.cats.map(c => c.cat), ['Food shopping', 'Fuel', 'Unsorted']);
  near(lm.cats[2].total, 8, 'Unsorted total');
  assert.deepStrictEqual(lm.cats[2].items.map(i => [i.name, i.total]), [['Costa', 8]]);   // same name = one line
  near(lm.total, 630 + 240 + 80 + 8, 'total');
  assert.strictEqual(M.compute(small(), '2024-11-08').lastMonth, null);  // nothing saved yet
});

test('Last month\'s spending: each row has the average of the saved months and a diff', () => {
  const lm = M.compute(withHistory(), '2024-11-08').lastMonth;
  near(lm.billsAvg, (610 + 610 + 620 + 630) / 4, 'bills avg (4 saved months)');
  near(lm.billsDiff, 630 - lm.billsAvg, 'bills diff');
  const food = lm.cats.find(c => c.cat === 'Food shopping');
  near(food.avg, (100 + 200 + 220 + 240) / 4, 'food avg'); near(food.diff, 50, 'food diff 240 - 190');
  near(lm.cats.find(c => c.cat === 'Fuel').avg, (60 + 80) / 4, 'a month with none counts as 0');
});

test('bills: a category each, changed by hand', () => {
  const s = small();
  assert.ok(M.CATEGORIES.includes('Household') && M.CATEGORIES.includes('Car') && M.CATEGORIES.includes('Subscriptions'));
  assert.strictEqual(M.setBillCat(s, 'Gym', ' Subscriptions '), null);
  assert.strictEqual(s.bills.find(b => b.key === 'Gym').cat, 'Subscriptions');
  assert.strictEqual(M.compute(s, '2024-11-08').bills.find(b => b.key === 'Gym').cat, 'Subscriptions');
  assert.strictEqual(M.setBillCat(s, 'Gym', '  '), 'bill');          // empty = refused
  assert.strictEqual(M.setBillCat(s, 'Nope', 'Car'), 'unknown');
  assert.ok(M.FAKE().bills.every(b => b.cat !== 'Unsorted'));       // the demo shows a category on every bill
});

test('Spending by category: this month vs the average of saved months', () => {
  const r = M.compute(withHistory(), '2024-11-08');
  const food = r.cats.find(c => c.cat === 'Food shopping'), shop = r.cats.find(c => c.cat === 'Shopping');
  near(food.now, 0, 'no Tesco this month'); near(food.avg, (100 + 200 + 220 + 240) / 4, 'food avg');
  near(shop.now, 50, 'Amazon this month'); near(shop.avg, 10, 'shopping avg 40 / 4');
  near(shop.diff, 40, 'diff = now - avg');
});

test('6 months, 12 months, year so far: sums of saved months (pay, bills, spending, left over)', () => {
  const r = M.compute(withHistory(), '2024-11-08');
  // last 6 saved months = all 4 here; 12 = all 4; year so far = the 3 that start in 2024
  near(r.periods.six.months, 4, 'six count'); near(r.periods.twelve.months, 4, 'twelve count');
  near(r.periods.ytd.months, 3, 'ytd count');
  near(r.periods.ytd.wage, 6000, 'ytd wage'); near(r.periods.ytd.bills, 580 + 590 + 600 + 90, 'ytd bills');
  near(r.periods.ytd.spending, 260 + 260 + 328, 'ytd spending');
  near(r.periods.ytd.left, 6000 - 1860 - 848, 'ytd left over = wage - bills - spending');
  near(r.periods.six.wage, 7900, 'six wage');
});

test('FAKE (the ?demo=1 page): new shape, a saved month, pots set, numbers that add up', () => {
  const s = M.FAKE();
  assert.strictEqual(s.v, 3);                                       // v3 since step 5 (several cards)
  assert.ok(s.history.length >= 2, 'at least two saved months');
  assert.ok(s.pots.some(p => p.amount > 0), 'a pot with an amount');
  assert.ok(s.bills.every(b => b.due >= 1 && b.due <= 31), 'every fake bill has a due day');
  const r = M.compute(s, '2024-11-08');
  near(r.spare, r.pay + r.left - r.billsTotal - r.potsSpent - r.spendsTotal, 'adds up');
  assert.ok(r.lastMonth && r.lastMonth.cats.length > 0);
  assert.notStrictEqual(M.FAKE(), M.FAKE());
});
