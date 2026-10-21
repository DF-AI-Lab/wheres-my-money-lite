// Go B step 7 (PLAN.md): Move & rename (the saved order), Ideas & feedback notes. The maths only (docs/money.js).
// Run: node --test tests_js/   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/money.js');

test('layout: the saved order of a box (cards, bills, ...) is kept; junk is ignored; reset puts it back', () => {
  const s = M.FAKE();
  assert.strictEqual(M.setLayout(s, 'cards', ['pots', 'spend', 'card:Zopa']), null);
  assert.deepStrictEqual(s.layout, {cards: ['pots', 'spend', 'card:Zopa']});
  assert.strictEqual(M.setLayout(s, 'bills', ['bill:Gym Club', 'bill:Rent']), null);
  assert.deepStrictEqual(s.layout.bills, ['bill:Gym Club', 'bill:Rent']);
  assert.strictEqual(M.setLayout(s, 'nope', ['x']), null);                   // only the known boxes
  assert.strictEqual(s.layout.nope, undefined);
  assert.strictEqual(M.setLayout(s, 'cards', 'not a list'), null);
  assert.deepStrictEqual(s.layout.cards, ['pots', 'spend', 'card:Zopa']);
  M.setLayout(s, 'cats', Array.from({length: 500}, (_, i) => 'x' + i));
  assert.ok(s.layout.cats.length <= 200, 'a sane limit');
  assert.strictEqual(M.resetLayout(s), null);
  assert.strictEqual(s.layout, undefined);
});

test('layout: order() sorts by the saved ids; ids not saved keep their own order after the saved ones', () => {
  const items = ['a', 'b', 'c', 'd'];
  assert.deepStrictEqual(M.order(items, ['c', 'a'], x => x), ['c', 'a', 'b', 'd']);
  assert.deepStrictEqual(M.order(items, undefined, x => x), items);
  assert.deepStrictEqual(M.order(items, ['zz', 'd'], x => x), ['d', 'a', 'b', 'c']);
});

test('rename by Move & rename: a bill row (id "bill:KEY"); empty = no change; anything else is ignored', () => {
  const s = M.FAKE();
  assert.strictEqual(M.renameRow(s, 'bill:Rent', 'Rent (flat)'), null);
  assert.strictEqual(s.bills.find(b => b.key === 'Rent').name, 'Rent (flat)');
  assert.strictEqual(M.renameRow(s, 'bill:Rent', ''), null);
  assert.strictEqual(s.bills.find(b => b.key === 'Rent').name, 'Rent (flat)');
  assert.strictEqual(M.renameRow(s, 'bill:Nope', 'X'), null);
  assert.strictEqual(M.renameRow(s, 'cards', 'X'), null);
});

test('ideas: add (tag idea | odd | love, else idea), done switches, remove; text tidied, max 1000', () => {
  const s = M.TEMPLATE();
  assert.deepStrictEqual(s.ideas, []);
  assert.strictEqual(M.addIdea(s, '  Show   the  pots  first ', 'love', '2024-11-08T09:30'), null);
  assert.strictEqual(M.addIdea(s, 'Odd sum', 'odd', '2024-11-08T10:00'), null);
  assert.strictEqual(M.addIdea(s, 'x'.repeat(1200), 'what', '2024-11-09T10:00'), null);
  assert.strictEqual(M.addIdea(s, '   ', 'idea', '2024-11-09T10:00'), 'idea');
  assert.deepStrictEqual(s.ideas.map(n => [n.id, n.text.length, n.tag, n.done]),
    [[1, 19, 'love', false], [2, 7, 'odd', false], [3, 1000, 'idea', false]]);
  assert.strictEqual(s.ideas[0].text, 'Show the pots first');
  assert.strictEqual(s.ideas[0].at, '2024-11-08T09:30');
  assert.strictEqual(M.toggleIdea(s, '2'), null); assert.strictEqual(s.ideas[1].done, true);
  assert.strictEqual(M.toggleIdea(s, '2'), null); assert.strictEqual(s.ideas[1].done, false);
  assert.strictEqual(M.removeIdea(s, '3'), null);
  assert.deepStrictEqual(s.ideas.map(n => n.id), [1, 2]);
  assert.strictEqual(M.removeIdea(s, 'x'), null);
});

test('ideas: Copy all for Claude = the open notes as text, oldest first (same words as live)', () => {
  const s = M.TEMPLATE();
  M.addIdea(s, 'Show the pots first', 'love', '2024-11-08T09:30');
  M.addIdea(s, 'Odd sum', 'odd', '2024-11-08T10:00');
  M.addIdea(s, 'Built already', 'idea', '2024-11-09T10:00');
  M.toggleIdea(s, '3');
  assert.strictEqual(M.ideasCopy(s, '0.12', '2024-11-10'),
    "Where's My Money? Lite ideas & feedback (v0.12, copied 10 Nov 2024)\n\n" +
    '- ❤️ Love this (8 Nov 2024): Show the pots first\n' +
    '- 🐞 Something odd (8 Nov 2024): Odd sum');
  assert.deepStrictEqual(M.IDEA_TAGS, {idea: '💡 Idea', odd: '🐞 Something odd', love: '❤️ Love this'});
});

test('ideas travel in the backup file; migrate gives old states an empty list', () => {
  const s = M.FAKE();
  M.addIdea(s, 'Keep me', 'idea', '2024-11-08T09:30');
  assert.deepStrictEqual(M.importBackup(JSON.parse(JSON.stringify(M.exportBackup(s, '2024-11-08')))).ideas, s.ideas);
  const old = M.FAKE(); delete old.ideas;
  assert.deepStrictEqual(M.compute(old, '2024-11-08') && M.migrate(old).ideas, []);
});
