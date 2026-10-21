// Go B step 5 (PLAN.md): several credit cards + the Zopa question. The maths only (docs/money.js).
// Run: node --test tests_js/   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/money.js');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: ${a} != ${b}`);
const bill = (key, amount, due, extra) => Object.assign({key, name: key, cat: 'Household', amount, due: due || null,
                                                         paid: false, stopped: false}, extra || {});
const card = (key, limit, items) => ({key, name: key, limit, carry: 0, next: (items || []).length + 1, items: items || []});
// pay 2000, payday 25 Oct 2024, today 8 Nov 2024. Two credit cards; the Zopa bill (due 5th) pays the Zopa card.
function two() {
  return {
    v: 3, pay: 2000, left: 0, payday: '2024-10-25',
    bills: [bill('Rent', 600, 1), bill('Zopa', 100, 5), bill('Barclaycard', 50, 20)],
    pots: [], spends: [], history: [],
    cards: [card('Zopa', 500, [{id: 1, date: '2024-10-26', amount: 200, name: 'Amazon', kind: 'spend'}]),
            card('Barclaycard', 1200)],
  };
}
const TODAY = '2024-11-08';

test('TEMPLATE: one example credit card to start (state v3, no old "card")', () => {
  const s = M.TEMPLATE();
  assert.strictEqual(s.v, 3);
  assert.strictEqual(s.card, undefined);
  assert.strictEqual(s.cards.length, 1);
  assert.deepStrictEqual([s.cards[0].name, s.cards[0].limit, s.cards[0].items], ['Credit card', 500, []]);
  const r = M.compute(s, TODAY);
  assert.strictEqual(r.cards.length, 1);
  assert.strictEqual(r.cards[0].label, 'Credit card');          // a name with "card" in it is shown as it is
  assert.strictEqual(r.card, r.cards[0]);                        // r.card = the first card (kept for old callers)
});

test('migrate: a v2 state with one "card" becomes v3 with cards = [Zopa], numbers kept; v3 is left alone', () => {
  const v2 = {v: 2, pay: 2500, left: 0, bills: [bill('Rent', 550, 1)], pots: [], spends: [], history: [],
              card: {limit: 750, carry: 10, next: 3, items: [{id: 1, date: '2024-10-25', amount: 45, name: 'Amazon', kind: 'spend'},
                                                             {id: 2, date: '2024-10-26', amount: -20, name: 'Paid off', kind: 'paid'}]}};
  const s = M.migrate(JSON.parse(JSON.stringify(v2)));
  assert.strictEqual(s.v, 3);
  assert.strictEqual(s.card, undefined);
  assert.strictEqual(s.cards.length, 1);
  const c = s.cards[0];
  assert.deepStrictEqual([c.key, c.name, c.limit, c.carry, c.next], ['Zopa', 'Zopa', 750, 10, 3]);
  assert.deepStrictEqual(c.items, v2.card.items);
  assert.deepStrictEqual(s.bills, v2.bills);
  assert.strictEqual(M.migrate(s), s);
  const r = M.compute(s, TODAY);
  assert.strictEqual(r.cards[0].label, 'Zopa credit card');      // like live's top tile
  near(r.cards[0].used, 35, 'used = carry + items');
  // a v1 state (no v) still works too
  const v1 = M.migrate({pay: 1, bills: [], spends: [], card: {limit: 500, items: []}});
  assert.strictEqual(v1.v, 3); assert.strictEqual(v1.cards.length, 1);
});

test('credit cards: add (name + limit), rename, delete; keys unique; bad input = "newcard"', () => {
  const s = two();
  assert.strictEqual(M.addCreditCard(s, 'Amex', '2000'), null);
  assert.deepStrictEqual(s.cards.at(-1), {key: 'Amex', name: 'Amex', limit: 2000, carry: 0, next: 1, items: []});
  assert.strictEqual(M.addCreditCard(s, 'Amex', '300'), null);
  assert.strictEqual(s.cards.at(-1).key, 'Amex 2');
  assert.strictEqual(M.addCreditCard(s, '  ', '300'), 'newcard');
  assert.strictEqual(M.addCreditCard(s, 'Capital One', ''), 'newcard');
  assert.strictEqual(M.addCreditCard(s, 'Capital One', 'lots'), 'newcard');
  assert.strictEqual(M.renameCreditCard(s, 'Amex 2', 'Amex Gold'), null);
  assert.strictEqual(s.cards.find(c => c.key === 'Amex 2').name, 'Amex Gold');
  assert.strictEqual(M.renameCreditCard(s, 'Amex 2', ''), 'newcard');
  assert.strictEqual(M.renameCreditCard(s, 'Nope', 'X'), 'unknown');
  assert.strictEqual(M.deleteCreditCard(s, 'Amex 2'), null);
  assert.ok(!s.cards.some(c => c.key === 'Amex 2'));
  assert.strictEqual(M.deleteCreditCard(s, 'Nope'), 'unknown');
  // every card can go: then there are none (the page shows an Add a credit card box)
  ['Zopa', 'Barclaycard', 'Amex'].forEach(k => assert.strictEqual(M.deleteCreditCard(s, k), null));
  assert.deepStrictEqual(s.cards, []);
  const r = M.compute(s, TODAY);
  assert.deepStrictEqual(r.cards, []); assert.strictEqual(r.card, null);
});

test('credit cards: add / remove / limit / balance go to the card named by key; no key = the first card', () => {
  const s = two();
  assert.strictEqual(M.cardAdd(s, TODAY, '40', 'Shell', false, 'Barclaycard'), null);
  assert.strictEqual(M.cardAdd(s, TODAY, '25', '', true, 'Barclaycard'), null);        // Paid off, name can be empty
  assert.strictEqual(M.cardAdd(s, TODAY, '10', 'Costa', false), null);                  // no key: first card (Zopa)
  assert.strictEqual(M.cardAdd(s, TODAY, '10', 'Costa', false, 'Nope'), 'unknown');
  let r = M.compute(s, TODAY);
  const z = r.cards.find(c => c.key === 'Zopa'), b = r.cards.find(c => c.key === 'Barclaycard');
  near(z.used, 210, 'Zopa used'); near(b.used, 15, 'Barclaycard used 40 - 25'); near(b.free, 1185, 'Barclaycard free');
  assert.strictEqual(b.pctUsed, 1);
  assert.strictEqual(M.cardLimit(s, '1500', 'Barclaycard'), null);
  assert.strictEqual(s.cards[1].limit, 1500); assert.strictEqual(s.cards[0].limit, 500);
  assert.strictEqual(M.cardBalance(s, TODAY, '100', 'Barclaycard'), null);              // Correction line on that card
  near(M.compute(s, TODAY).cards[1].used, 100, 'Barclaycard after correction');
  assert.strictEqual(s.cards[1].items.at(-1).name, 'Correction');
  const id = s.cards[1].items[0].id;
  assert.strictEqual(M.cardRemove(s, String(id), 'Barclaycard'), null);
  assert.ok(!s.cards[1].items.some(i => i.id === id));
  near(M.compute(s, TODAY).cards[0].used, 210, 'Zopa untouched');
  // spare cash never counts the credit cards
  near(M.compute(s, TODAY).spare, 2000 - 750, 'spare = pay - bills');
});

test('bills pay a credit card: linked by name by itself, or chosen by hand (empty = none)', () => {
  const s = two();
  let r = M.compute(s, TODAY);
  assert.strictEqual(r.bills.find(b => b.key === 'Zopa').card, 'Zopa');
  assert.strictEqual(r.bills.find(b => b.key === 'Rent').card, null);
  s.bills.push(bill('Zopa Credit Cards DD', 30, 2));                                     // whole word "Zopa" in the name
  s.bills.push(bill('Zopacabana', 30, 2));                                               // not a whole word: no
  r = M.compute(s, TODAY);
  assert.strictEqual(r.bills.find(b => b.key === 'Zopa Credit Cards DD').card, 'Zopa');
  assert.strictEqual(r.bills.find(b => b.key === 'Zopacabana').card, null);
  assert.strictEqual(M.setBillCard(s, 'Rent', 'barclaycard'), null);                     // by name, any case
  assert.strictEqual(s.bills[0].card, 'Barclaycard');
  assert.strictEqual(M.setBillCard(s, 'Zopa', ''), null);                                // empty = this bill pays no card
  assert.strictEqual(M.compute(s, TODAY).bills.find(b => b.key === 'Zopa').card, null);
  assert.strictEqual(M.setBillCard(s, 'Rent', 'Visa'), 'bill');
  assert.strictEqual(M.setBillCard(s, 'Nope', 'Zopa'), 'unknown');
});

test('the Zopa question: asked in that card once the due day has gone, until answered this month', () => {
  const s = two();
  let r = M.compute(s, '2024-11-04');                                                   // Zopa due 5 Nov: not yet
  assert.deepStrictEqual(r.cards[0].asks, []);
  r = M.compute(s, TODAY);
  assert.deepStrictEqual(r.cards[0].asks.map(a => [a.key, a.name, a.amount, a.dueText]), [['Zopa', 'Zopa', 100, '5th']]);
  assert.deepStrictEqual(r.cards[1].asks, []);                                          // Barclaycard due 20th: not yet
  // a stopped or blank bill is never asked; a bill with no due day is asked straight away
  s.bills[1].stopped = true;
  assert.deepStrictEqual(M.compute(s, TODAY).cards[0].asks, []);
  s.bills[1].stopped = false; s.bills[1].amount = null;
  assert.deepStrictEqual(M.compute(s, TODAY).cards[0].asks, []);
  s.bills[1].amount = 100; s.bills[1].due = null;
  assert.strictEqual(M.compute(s, '2024-10-26').cards[0].asks.length, 1);
});

test('the Zopa question: Yes = a Paid off line for the bill amount; Other = typed amount; No = nothing', () => {
  let s = two();
  assert.strictEqual(M.cardAsk(s, TODAY, 'Zopa', 'yes', ''), null);
  const line = s.cards[0].items.at(-1);
  assert.deepStrictEqual([line.amount, line.name, line.kind, line.date], [-100, 'Paid off', 'paid', TODAY]);
  let r = M.compute(s, TODAY);
  near(r.cards[0].used, 100, 'used 200 - 100');
  assert.deepStrictEqual(r.cards[0].asks, []);                                          // answered: gone for this month

  s = two();
  assert.strictEqual(M.cardAsk(s, TODAY, 'Zopa', 'other', 'abc'), 'card');              // bad amount: still asked
  assert.strictEqual(M.compute(s, TODAY).cards[0].asks.length, 1);
  assert.strictEqual(M.cardAsk(s, TODAY, 'Zopa', 'other', '£60'), null);
  near(M.compute(s, TODAY).cards[0].used, 140, 'used 200 - 60');

  s = two();
  assert.strictEqual(M.cardAsk(s, TODAY, 'Zopa', 'no', ''), null);
  r = M.compute(s, TODAY);
  near(r.cards[0].used, 200, 'No changes nothing'); assert.deepStrictEqual(r.cards[0].asks, []);
  assert.strictEqual(M.cardAsk(s, TODAY, 'Nope', 'yes', ''), 'unknown');
  assert.strictEqual(M.cardAsk(s, TODAY, 'Rent', 'yes', ''), 'unknown');                // Rent pays no card

  // the next payday asks again once the new due day has gone
  assert.strictEqual(M.newPayday(s, '2024-11-25', '2000', ''), null);
  assert.deepStrictEqual(M.compute(s, '2024-12-01').cards[0].asks, []);
  assert.strictEqual(M.compute(s, '2024-12-05').cards[0].asks.length, 1);
});

test('backup + FAKE: cards travel in the backup file; the demo has the Zopa card', () => {
  const s = two();
  assert.deepStrictEqual(M.importBackup(JSON.parse(JSON.stringify(M.exportBackup(s, TODAY)))), M.migrate(s));   // + ideas: [] (step 7)
  const f = M.FAKE();
  assert.strictEqual(f.v, 3);
  assert.deepStrictEqual(f.cards.map(c => [c.name, c.limit]), [['Zopa', 500]]);
  const r = M.compute(f, TODAY);
  near(r.cards[0].used, 45, 'demo card used'); assert.strictEqual(r.cards[0].label, 'Zopa credit card');
});
