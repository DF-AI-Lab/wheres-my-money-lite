// Go B step 6 (PLAN.md): passcode + 10 backup codes + the scrambled backup file. docs/lock.js (WebCrypto, node + browser).
// Run: node --test tests_js/   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const L = require('../docs/lock.js');

const PIN = '135790';
const STATE = {v: 3, pay: 2000, left: 0, bills: [], pots: [], spends: [{id: 1, date: '2024-11-01', amount: 9.99, name: 'Greggs', cat: 'Unsorted'}],
               history: [], cards: []};
const b64len = s => Buffer.from(s, 'base64').length;

test('backup codes: 10, like live (abcd-2345: no 0/o/1/l/i look-alikes), all different', () => {
  const codes = L.makeCodes();
  assert.strictEqual(codes.length, 10);
  assert.strictEqual(new Set(codes).size, 10);
  codes.forEach(c => assert.match(c, /^[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}$/));
  assert.strictEqual(L.secretOf(' ABCD 2345 '), 'abcd2345');
  assert.strictEqual(L.secretOf('abcd-2345'), 'abcd2345');
});

test('passcode rules (same words as live)', () => {
  assert.strictEqual(L.pinProblem('135790', '135790'), '');
  assert.strictEqual(L.pinProblem('12345', '12345'), 'The passcode must be 6 numbers.');
  assert.strictEqual(L.pinProblem('12a456', '12a456'), 'The passcode must be 6 numbers.');
  assert.strictEqual(L.pinProblem('135790', '135791'), 'The two passcodes are not the same. Try again.');
  assert.strictEqual(L.pinProblem('111111', '111111'), 'That passcode is too easy to guess. Pick another.');
  assert.strictEqual(L.pinProblem('234567', '234567'), 'That passcode is too easy to guess. Pick another.');
  assert.strictEqual(L.pinProblem('987654', '987654'), 'That passcode is too easy to guess. Pick another.');
});

test('create: the record holds no passcode and no codes, only wrapped copies of one random key', async () => {
  const codes = L.makeCodes();
  const rec = await L.create(PIN, codes);
  assert.strictEqual(rec.v, 1); assert.strictEqual(rec.iter, 100000);
  assert.strictEqual(b64len(rec.mb), 32);
  assert.deepStrictEqual(Object.keys(rec.pin).sort(), ['ct', 'iv', 'salt']);
  assert.strictEqual(b64len(rec.pin.salt), 16); assert.strictEqual(b64len(rec.pin.iv), 12); assert.strictEqual(b64len(rec.pin.ct), 48);
  assert.strictEqual(rec.codes.length, 10);
  assert.ok(rec.codes.every(c => c.used === false && b64len(c.ct) === 48));
  assert.deepStrictEqual(rec.passkeys, []); assert.deepStrictEqual(rec.fails, {count: 0, until: 0});
  const text = JSON.stringify(rec);
  assert.ok(!text.includes(PIN), 'no passcode inside');
  codes.forEach(c => assert.ok(!text.includes(c) && !text.includes(L.secretOf(c)), 'no code inside'));
});

test('checkPin: right = true, wrong = false', async () => {
  const rec = await L.create(PIN, L.makeCodes());
  assert.strictEqual(await L.checkPin(rec, PIN), true);
  assert.strictEqual(await L.checkPin(rec, '135791'), false);
  assert.strictEqual(await L.checkPin(rec, ''), false);
});

test('useCode: each backup code works once (any case, spaces ok); a wrong one = -1', async () => {
  const codes = L.makeCodes();
  const rec = await L.create(PIN, codes);
  assert.strictEqual(await L.useCode(rec, codes[3].toUpperCase().replace('-', ' ')), 3);
  assert.strictEqual(rec.codes[3].used, true);
  assert.strictEqual(await L.useCode(rec, codes[3]), -1);                 // used up
  assert.strictEqual(await L.useCode(rec, 'zzzz-zzzz'), -1);
  assert.strictEqual(L.codesLeft(rec), 9);
});

test('setPin and newCodes: the old ones stop working, the key (mb) stays the same', async () => {
  const codes = L.makeCodes();
  const rec = await L.create(PIN, codes), mb = rec.mb;
  await L.setPin(rec, '246813');
  assert.strictEqual(await L.checkPin(rec, PIN), false);
  assert.strictEqual(await L.checkPin(rec, '246813'), true);
  const fresh = L.makeCodes();
  await L.newCodes(rec, fresh);
  assert.strictEqual(await L.useCode(rec, codes[0]), -1);
  assert.strictEqual(await L.useCode(rec, fresh[0]), 0);
  assert.strictEqual(rec.mb, mb);
  assert.strictEqual(L.codesLeft(rec), 9);
});

test('seal / open: the backup file opens with the passcode or any unused code, nothing else', async () => {
  const codes = L.makeCodes();
  const rec = await L.create(PIN, codes);
  await L.useCode(rec, codes[9]);
  const sc = await L.seal(rec, STATE);
  assert.strictEqual(sc.v, 1); assert.strictEqual(sc.iter, 100000); assert.strictEqual(b64len(sc.iv), 12);
  assert.ok(!JSON.stringify(sc).includes('Greggs'), 'scrambled: no plain data');
  assert.deepStrictEqual(sc.keys.map(k => k.kind), ['pin', ...Array(9).fill('code')]);   // used codes are left out
  assert.deepStrictEqual(await L.open(sc, PIN), STATE);
  assert.deepStrictEqual(await L.open(sc, codes[4].toUpperCase()), STATE);
  assert.strictEqual(await L.open(sc, codes[9]), null);
  assert.strictEqual(await L.open(sc, '000000'), null);
  const bad = JSON.parse(JSON.stringify(sc));
  bad.data = Buffer.from(Buffer.from(bad.data, 'base64').map((x, i) => i === 3 ? x ^ 1 : x)).toString('base64');
  assert.strictEqual(await L.open(bad, PIN), null);                       // changed file = refused
  assert.strictEqual(await L.open(null, PIN), null);
});

test('wrong tries: 5 = locked for 15 minutes; then counting starts again', () => {
  const rec = {fails: {count: 0, until: 0}};
  const t0 = Date.UTC(2024, 10, 8, 12, 0, 0);
  for (let i = 0; i < 4; i++) L.fail(rec, t0);
  assert.strictEqual(L.lockedUntil(rec, t0), 0);
  L.fail(rec, t0);
  assert.strictEqual(L.lockedUntil(rec, t0), t0 + 15 * 60 * 1000);
  assert.strictEqual(L.lockedUntil(rec, t0 + 14 * 60 * 1000), t0 + 15 * 60 * 1000);
  assert.strictEqual(L.lockedUntil(rec, t0 + 15 * 60 * 1000), 0);
  L.fail(rec, t0 + 16 * 60 * 1000);
  assert.strictEqual(rec.fails.count, 1);
  L.ok(rec);
  assert.deepStrictEqual(rec.fails, {count: 0, until: 0});
});

test('needs: setup for a new person, unlock on open or after 5 minutes without use, else nothing', () => {
  const now = Date.UTC(2024, 10, 8, 12, 0, 0);
  assert.strictEqual(L.needs(null, null, now), 'setup');
  assert.strictEqual(L.needs({v: 1}, null, now), 'unlock');
  assert.strictEqual(L.needs({v: 1}, now - 4 * 60 * 1000, now), null);
  assert.strictEqual(L.needs({v: 1}, now - 5 * 60 * 1000 - 1, now), 'unlock');
  assert.strictEqual(L.IDLE_MS, 5 * 60 * 1000);
});
