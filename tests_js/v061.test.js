// v0.61 🛂 Passport ID = the lock. docs/demo/wmmkey.js: WMM's backups, locked with the passport's hidden key.
// New backups (v2): data locked with a random key K; K locked with a PUBLIC key (so saving works after a fingerprint,
// with no hidden key open); the PRIVATE key is in the file too, locked by the hidden key (HKDF). Only the passcode opens it.
// Old backups (v1, lock.js): still open with the OLD passcode; and with the passport once mb (the old master key) was moved in.
// Run: node --test tests_js/   (fake data only)
const test = require('node:test');
const assert = require('node:assert');
const L = require('../docs/demo/lock.js');
const K = require('../docs/demo/wmmkey.js');

const STATE = {v: 3, pay: 2000, left: 0, bills: [], pots: [], spends: [{id: 1, date: '2024-11-01', amount: 9.99, name: 'Greggs', cat: 'Unsorted'}],
               history: [], cards: []};
const hidden = () => crypto.getRandomValues(new Uint8Array(32));     // = Passport.key(email)

test('a key record: public key in the clear, private key + mb locked, nothing plain', async () => {
  const k = hidden();
  const old = await L.create('135790', L.makeCodes());                  // the old WMM lock (mb in it)
  const rec = await K.make(k, old.mb);
  assert.strictEqual(rec.v, 2);
  assert.ok(rec.pub && rec.pub.kty === 'RSA' && !rec.pub.d);           // public only
  assert.ok(rec.priv.iv && rec.priv.ct && rec.mb.iv && rec.mb.ct);
  assert.ok(!JSON.stringify(rec).includes(old.mb));                    // mb never in the clear
  assert.strictEqual(await K.fits(rec, k), true);
  assert.strictEqual(await K.fits(rec, hidden()), false);               // another passport's key
  assert.strictEqual(await K.mbOf(rec, k), old.mb);
  assert.strictEqual(await K.mbOf(rec, hidden()), null);
  const none = await K.make(k);                                          // a new person: no old key
  assert.strictEqual(none.mb, undefined);
  assert.strictEqual(await K.mbOf(none, k), null);
});

test('seal needs NO hidden key (fingerprint unlock still saves); open needs it', async () => {
  const k = hidden();
  const rec = await K.make(k);
  const sealed = await K.seal(rec, STATE);                               // only the record: no key passed in
  assert.strictEqual(sealed.v, 2);
  assert.ok(Array.isArray(sealed.keys) && sealed.keys[0].kind === 'pp');
  assert.ok(!JSON.stringify(sealed).includes('Greggs'));
  assert.deepStrictEqual(await K.open(sealed, k), STATE);
  assert.strictEqual(await K.open(sealed, hidden()), null);              // wrong key: nothing
  assert.strictEqual(await K.open(Object.assign({}, sealed, {data: sealed.data.slice(0, -4) + 'AAAA'}), k), null);   // tampered
  const again = await K.seal(rec, STATE);
  assert.notStrictEqual(again.data, sealed.data);                        // a fresh K every time
});

test('a v2 file opens on ANOTHER device with the same passport (private key travels in the file)', async () => {
  const k = hidden();
  const phone = await K.make(k), pc = await K.make(k);                   // two devices, two key pairs, one passport
  const sealed = await K.seal(phone, STATE);
  assert.deepStrictEqual(await K.open(sealed, k), STATE);
  assert.notDeepStrictEqual(phone.pub, pc.pub);
});

test('the old mb rides along in v2 files, so a wiped device can open OLD backups without the old passcode', async () => {
  const k = hidden();
  const old = await L.create('135790', L.makeCodes());
  const oldFile = await L.seal(old, STATE);                              // a real old backup (v1)
  const rec = await K.make(k, old.mb);
  const sealed = await K.seal(rec, STATE);
  const mb = await K.mbOf(sealed, k);                                    // from the FILE, not the device
  assert.strictEqual(mb, old.mb);
  assert.deepStrictEqual(await K.openOld(oldFile, mb), STATE);
  const other = await L.create('246802', L.makeCodes());
  assert.strictEqual(await K.openOld(oldFile, other.mb), null);          // another mb: nothing
  assert.deepStrictEqual(await L.open(oldFile, '135790'), STATE);         // the old passcode still opens it
});

test('the hidden key is never stored: make/seal output has no copy of it', async () => {
  const k = hidden();
  const kb = Buffer.from(k).toString('base64');
  const rec = await K.make(k);
  const sealed = await K.seal(rec, STATE);
  assert.ok(!JSON.stringify(rec).includes(kb) && !JSON.stringify(sealed).includes(kb));
});

test('this tab\'s copy of WMM\'s key ({wk}) opens v2 files and the old mb, but is not the hidden key', async () => {
  const k = hidden();
  const old = await L.create('135790', L.makeCodes());
  const rec = await K.make(k, old.mb);
  const sealed = await K.seal(rec, STATE);
  const t = await K.tabKey(k);
  assert.strictEqual(t.length, 32);
  assert.notDeepStrictEqual(Buffer.from(t), Buffer.from(k));
  assert.deepStrictEqual(await K.open(sealed, {wk: t}), STATE);
  assert.strictEqual(await K.mbOf(rec, {wk: t}), old.mb);
  assert.strictEqual(await K.open(sealed, {wk: await K.tabKey(hidden())}), null);
});
