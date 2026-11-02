/* Where's My Money? Lite - v0.61 backups locked with the 🛂 Passport's hidden key (Passport.key(email), 32 bytes).
   WebCrypto only (browser + node 22). The hidden key is never stored: it makes WMM's own AES key (HKDF 'wmm-lite').
   The record on this device ('lite_key_v1', made once after a passcode):
     pub  = a public key (RSA-OAEP) in the clear: it can LOCK a backup, never open one
     priv = its private key, locked by the hidden key        mb = the OLD lock's master key (lock.js), locked the same way
   A v2 backup: the money locked with a fresh random key K; K locked with pub; priv + mb ride along (still locked).
   So saving needs no hidden key (a fingerprint unlock still saves to Drive); opening needs the passcode, on any device
   with the same passport. Old v1 backups open with the old passcode (lock.js), or with mb once it is here. */
(function (root) {
  'use strict';
  const subtle = () => globalThis.crypto.subtle;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const RSA = {name: 'RSA-OAEP', hash: 'SHA-256'};
  const b64 = bytes => { let s = ''; bytes = new Uint8Array(bytes); for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
  const unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
  const random = n => globalThis.crypto.getRandomValues(new Uint8Array(n));

  // WMM's AES key from the passport's hidden key. k = the hidden key (Uint8Array), or {wk} = this tab's copy of WMM's key
  const HKDF = {name: 'HKDF', hash: 'SHA-256', salt: enc.encode('wmm-lite'), info: enc.encode('backups')};
  async function wk(k) {
    if (k && k.wk) return subtle().importKey('raw', k.wk, 'AES-GCM', false, ['encrypt', 'decrypt']);
    const base = await subtle().importKey('raw', k, 'HKDF', false, ['deriveKey']);
    return subtle().deriveKey(HKDF, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
  }
  // after the passcode: WMM's own key (not the hidden key) for this tab only, so 🔁 other devices' copies open without asking
  async function tabKey(hidden) {
    const base = await subtle().importKey('raw', hidden, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle().deriveBits(HKDF, base, 256));
  }
  async function box(key, bytes) {
    const iv = random(12);
    return {iv: b64(iv), ct: b64(await subtle().encrypt({name: 'AES-GCM', iv}, key, bytes))};
  }
  async function unbox(key, b) {                                 // bytes, or null
    try { return new Uint8Array(await subtle().decrypt({name: 'AES-GCM', iv: unb64(b.iv)}, key, unb64(b.ct))); } catch (e) { return null; }
  }

  // a new record for this device. mbB64 = the old lock's master key (moved in once), or nothing for a new person
  async function make(hidden, mbB64) {
    const pair = await subtle().generateKey(Object.assign({modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1])}, RSA), true, ['encrypt', 'decrypt']);
    const pub = await subtle().exportKey('jwk', pair.publicKey);
    const key = await wk(hidden);
    const rec = {v: 2, pub: {kty: pub.kty, n: pub.n, e: pub.e, alg: pub.alg, ext: true},
                 priv: await box(key, await subtle().exportKey('pkcs8', pair.privateKey)), made: new Date().toISOString()};
    if (mbB64) rec.mb = await box(key, unb64(mbB64));
    return rec;
  }
  async function fits(rec, hidden) {                             // this passport's key opens this record?
    return !!(rec && rec.priv && await unbox(await wk(hidden), rec.priv));
  }
  async function mbOf(recOrSealed, hidden) {                     // the old master key (base64), or null
    if (!recOrSealed || !recOrSealed.mb) return null;
    const mb = await unbox(await wk(hidden), recOrSealed.mb);
    return mb ? b64(mb) : null;
  }

  async function seal(rec, state) {                              // needs only the record (no hidden key)
    const pub = await subtle().importKey('jwk', rec.pub, RSA, false, ['encrypt']);
    const k = random(32), iv = random(12);
    const aes = await subtle().importKey('raw', k, 'AES-GCM', false, ['encrypt']);
    const data = await subtle().encrypt({name: 'AES-GCM', iv}, aes, enc.encode(JSON.stringify(state)));
    const out = {v: 2, iv: b64(iv), data: b64(data), keys: [{kind: 'pp', ct: b64(await subtle().encrypt(RSA, pub, k))}],
                 pub: rec.pub, priv: rec.priv};
    if (rec.mb) out.mb = rec.mb;
    return out;
  }
  async function open(sealed, hidden) {                          // the state, or null for anything wrong
    try {
      if (!sealed || sealed.v !== 2 || !sealed.priv) return null;
      const der = await unbox(await wk(hidden), sealed.priv);
      if (!der) return null;
      const priv = await subtle().importKey('pkcs8', der, RSA, false, ['decrypt']);
      const k = new Uint8Array(await subtle().decrypt(RSA, priv, unb64(sealed.keys[0].ct)));
      const aes = await subtle().importKey('raw', k, 'AES-GCM', false, ['decrypt']);
      return JSON.parse(dec.decode(await subtle().decrypt({name: 'AES-GCM', iv: unb64(sealed.iv)}, aes, unb64(sealed.data))));
    } catch (e) { return null; }
  }
  async function openOld(sealed, mbB64) {                        // an old v1 backup with its master key
    try {
      const aes = await subtle().importKey('raw', unb64(mbB64), 'AES-GCM', false, ['decrypt']);
      return JSON.parse(dec.decode(await subtle().decrypt({name: 'AES-GCM', iv: unb64(sealed.iv)}, aes, unb64(sealed.data))));
    } catch (e) { return null; }
  }

  const WmmKey = {make, fits, mbOf, seal, open, openOld, tabKey};
  if (typeof module !== 'undefined' && module.exports) module.exports = WmmKey;
  else root.WmmKey = WmmKey;
})(typeof window !== 'undefined' ? window : globalThis);
