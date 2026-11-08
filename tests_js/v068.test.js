// v0.68 (Darren, 8 Nov): the MCP for Claude (worker/). The summary now lists what Claude/Orbit added (lines with a job id),
// so Claude can take back its own things by id. Darren's own lines never show there.
// Run: node --test tests_js/*.test.js   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../docs/demo/money.js');

const TODAY = '2024-11-08';
const job = (kind, id, more) => Object.assign({v: 1, id, kind, from: 'Claude'}, more);

test('summary.added = only lines a job made, with their ids', () => {
  const s = M.FAKE();
  M.addSpend(s, TODAY, '7.00', 'Mine', '', false);                     // Darren's own: not listed
  assert.strictEqual(M.applyJob(s, job('add_spend', 'c-1', {amount: '12.50', name: 'Tesco'}), TODAY).done, true);
  assert.strictEqual(M.applyJob(s, job('add_bill', 'c-2', {amount: '9.99', name: 'Netflix', day: '15'}), TODAY).done, true);
  assert.strictEqual(M.applyJob(s, job('card_spend', 'c-3', {amount: '30', name: 'Amazon'}), TODAY).done, true);
  assert.strictEqual(M.applyJob(s, job('card_paid_off', 'c-4', {amount: '50', name: ''}), TODAY).done, true);
  const a = M.summary(s, TODAY, '2024-11-08T10:00:00Z').added;
  assert.deepStrictEqual(a.map(x => [x.id, x.kind, x.amount]), [['c-1', 'spend', 12.5], ['c-2', 'bill', 9.99], ['c-3', 'card', 30], ['c-4', 'card', 50]]);
  assert.ok(!a.some(x => x.name === 'Mine'));
});

test('a removed line leaves summary.added', () => {
  const s = M.FAKE();
  M.applyJob(s, job('add_spend', 'c-1', {amount: '5', name: 'Greggs'}), TODAY);
  M.applyJob(s, job('remove_spend', 'c-9', {target: 'c-1'}), TODAY);
  assert.deepStrictEqual(M.summary(s, TODAY, 'x').added, []);
});
