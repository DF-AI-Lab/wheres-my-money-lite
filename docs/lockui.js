/* Where's My Money? Lite - the lock screen (Go B step 6), the part that talks to the page.
   Like live v3.62's sign-in: a 6-number passcode, a fingerprint (passkey) instead of typing it, 10 backup codes.
   NOTE: this is a screen lock. The data itself sits in localStorage, so the lock keeps out a person holding the phone,
   not someone with developer tools. (The backup FILE is really scrambled; see lock.js.)
   The demo (?demo=1) never has a lock. */
(function (root) {
  'use strict';
  const L = root.Lock, REC_KEY = 'lite_lock_v1', STAMP_KEY = 'lite_unlock';
  const demo = !!(root.Lite && root.Lite.Store.demo);
  const html = document.documentElement;
  let rec = null, from = '', busy = false;

  // ---------- the record and the "unlocked at" stamp ----------
  function load() {
    try { const t = root.localStorage.getItem(REC_KEY); const r = t && JSON.parse(t); return r && r.v === 1 ? r : null; } catch (e) { return null; }
  }
  function save() { ahead = {}; try { root.localStorage.setItem(REC_KEY, JSON.stringify(rec)); } catch (e) { /* private window */ } }
  function stamp() { try { return Number(root.sessionStorage.getItem(STAMP_KEY)) || 0; } catch (e) { return 0; } }
  function setStamp(on) {
    try { if (on) root.sessionStorage.setItem(STAMP_KEY, String(Date.now())); else root.sessionStorage.removeItem(STAMP_KEY); } catch (e) { /* ignore */ }
  }

  // the app stays hidden from the very first script until the check says it is fine (no flash of the money)
  if (!demo) html.classList.add('lockon');

  const $ = id => document.getElementById(id);
  const box = () => $('lock');
  const shown = () => { const b = box(); return !!b && !b.hidden; };
  const say = t => { const e = $('lockerr'); if (e) { e.textContent = t || ''; e.hidden = !t; } };
  const hhmm = ms => { const d = new Date(ms), z = n => String(n).padStart(2, '0'); return z(d.getHours()) + ':' + z(d.getMinutes()); };
  const tooMany = () => 'Too many tries. Try again at ' + hhmm(L.lockedUntil(rec, Date.now())) + '.';
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const canFinger = () => !!(root.PublicKeyCredential && root.navigator.credentials);

  function closeMenu() {
    const m = $('setmenu'), b = $('setbtn');
    if (m) m.hidden = true;
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  // ---------- showing a step / going into the app ----------
  function step(name) {
    const b = box();
    if (!b) return;
    closeMenu();
    html.classList.add('lockon');
    b.hidden = false;
    b.dataset.step = name;
    b.querySelectorAll('[data-for]').forEach(p => { p.hidden = p.dataset.for !== name; });
    say('');
    ['pin', 'again', 'bcode'].forEach(id => b.querySelectorAll('#' + id).forEach(i => { i.value = ''; }));
    if (name === 'unlock') {
      const fp = $('fp'), withFinger = !!(rec && rec.passkeys && rec.passkeys.length && canFinger());
      if (fp) fp.hidden = !withFinger;
      if (L.lockedUntil(rec, Date.now())) say(tooMany());
      if (withFinger) askFinger(); else focus('unlockform');
    } else if (name === 'newpin') focus('pinform');
    else if (name === 'forgot') focus('codeform');
    else if (name === 'passkey') fingerPage();
  }
  function focus(formId) { const i = document.querySelector('#' + formId + ' input'); if (i) i.focus(); }
  function enter() {                                         // into the app
    setStamp(true);
    const b = box();
    if (b) b.hidden = true;
    html.classList.remove('lockon');
    from = '';
  }
  function check() {
    if (demo) return;
    rec = load();
    if (shown()) return;
    const n = L.needs(rec, stamp(), Date.now());
    if (n === 'setup') step('newpin'); else if (n === 'unlock') step('unlock');
    else html.classList.remove('lockon');
  }

  // ---------- the forms ----------
  // The check takes a moment (100,000 rounds), so it starts as soon as the last character is typed.
  let ahead = {};
  function warm(kind, value, fn) {
    const key = kind + '|' + value;
    if (!ahead[key]) { ahead = {}; ahead[key] = fn(); }
    return ahead[key];
  }
  const pinCheck = pin => warm('pin', pin, () => L.checkPin(rec, pin));
  const codeCheck = text => warm('code', text, () => L.findCode(rec, text));
  async function onNewPin(e) {
    e.preventDefault();
    if (busy) return;
    const f = e.target, pin = f.querySelector('#pin').value, again = f.querySelector('#again').value;
    const bad = L.pinProblem(pin, again);
    if (bad) { say(bad); return; }
    busy = true;
    try {
      if (from === 'forgot') {
        await L.setPin(rec, pin); L.ok(rec); save(); enter();
      } else {
        const codes = L.makeCodes();
        rec = await L.create(pin, codes); save();
        showCodes(codes);
      }
    } finally { busy = false; }
  }
  function showCodes(codes) {
    const ul = document.querySelector('#lock ul.codes');
    ul.innerHTML = '';
    codes.forEach(c => { const li = document.createElement('li'); li.textContent = c; ul.appendChild(li); });
    step('codes');
  }
  async function onUnlock(e) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      rec = load() || rec;
      const pin = e.target.querySelector('#pin').value;
      if (L.lockedUntil(rec, Date.now())) { say(tooMany()); return; }
      if (await pinCheck(pin)) { L.ok(rec); save(); enter(); return; }
      L.fail(rec, Date.now()); save();
      e.target.querySelector('#pin').value = '';
      if (L.lockedUntil(rec, Date.now())) say(tooMany());
      else say('Wrong passcode. ' + (L.MAX_TRIES - rec.fails.count) + ' tries left.');
    } finally { busy = false; }
  }
  async function onCode(e) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      rec = load() || rec;
      if (L.lockedUntil(rec, Date.now())) { say(tooMany()); return; }
      const i = await codeCheck(e.target.querySelector('#bcode').value);
      if (i < 0) {
        L.fail(rec, Date.now()); save();
        say(L.lockedUntil(rec, Date.now()) ? tooMany() : 'That code is not right, or it was used already.');
        return;
      }
      rec.codes[i].used = true; save();                      // that code is used up now
      step('newpin');
      from = 'forgot';
    } finally { busy = false; }
  }

  // ---------- fingerprint: a passkey on this phone (no server, so nothing is checked by one) ----------
  async function askFinger() {
    try {
      const challenge = root.crypto.getRandomValues(new Uint8Array(32));
      const cred = await root.navigator.credentials.get({publicKey: {challenge, userVerification: 'required', timeout: 60000,
        allowCredentials: rec.passkeys.map(p => ({type: 'public-key', id: unb64url(p.id)}))}});
      const info = JSON.parse(new TextDecoder().decode(cred.response.clientDataJSON));
      const flags = new Uint8Array(cred.response.authenticatorData)[32];
      if (info.type === 'webauthn.get' && info.challenge === b64url(challenge) && (flags & 0x04)) { L.ok(rec); save(); enter(); }
    } catch (e) { /* cancelled: just use the passcode */ }
  }
  function fingerPage() {
    const none = !canFinger();
    $('fpnone').hidden = !none;
    $('fpadd').hidden = none;
    const has = !!(rec.passkeys && rec.passkeys.length);
    $('fpok').hidden = !has;
    $('fpoff').hidden = !has;
  }
  async function addFinger() {
    say('');
    try {
      const cred = await root.navigator.credentials.create({publicKey: {
        challenge: root.crypto.getRandomValues(new Uint8Array(32)),
        rp: {name: "Where's My Money? Lite"},
        user: {id: root.crypto.getRandomValues(new Uint8Array(16)), name: 'me', displayName: 'Me'},
        pubKeyCredParams: [{type: 'public-key', alg: -7}, {type: 'public-key', alg: -257}],
        excludeCredentials: (rec.passkeys || []).map(p => ({type: 'public-key', id: unb64url(p.id)})),
        authenticatorSelection: {authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred'},
        timeout: 60000}});
      rec.passkeys = (rec.passkeys || []).concat([{id: b64url(cred.rawId), at: new Date().toISOString()}]);
      save();
      fingerPage();
    } catch (e) {
      say(e && e.name === 'InvalidStateError' ? 'Fingerprint is already on for this phone.' : 'Cancelled. Nothing changed.');
    }
  }
  function offFinger() {
    if (!confirm('Turn off fingerprint on this phone? You will use your passcode.')) return;
    rec.passkeys = []; save(); fingerPage();
  }

  // ---------- start ----------
  document.addEventListener('DOMContentLoaded', () => {
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    if (demo) {                                              // no lock in the demo: its menu items go too
      ['newcodes', 'fingerprint', 'locknow'].forEach(id => { const el = $(id); if (el) el.hidden = true; });
      const g = $('locknow') && $('locknow').parentElement; if (g) g.hidden = true;
      return;
    }
    on('pinform', 'submit', onNewPin);
    on('unlockform', 'submit', onUnlock);
    on('codeform', 'submit', onCode);
    on('codesdone', 'click', enter);
    // start the check while typing; the button waits (greyed) until it is done, so a tap never races it
    const early = (input, long, run) => {
      if (!input) return;
      const btn = input.form.querySelector('button[type=submit]');
      let n = 0;
      input.addEventListener('input', () => {
        rec = load() || rec;
        const mine = ++n;
        btn.disabled = false;
        if (!rec || !long(input.value)) return;
        btn.disabled = true;
        run(input.value).catch(() => {}).then(() => { if (mine === n) btn.disabled = false; });
      });
    };
    early(document.querySelector('#unlockform #pin'), v => v.length === 6, pinCheck);
    early($('bcode'), v => L.secretOf(v).length === 8, codeCheck);
    on('fpbtn', 'click', askFinger);
    on('forgot', 'click', () => step('forgot'));
    on('backtopin', 'click', () => step('unlock'));
    on('fpadd', 'click', addFinger);
    on('fpoff', 'click', offFinger);
    on('lockback', 'click', enter);
    on('newcodes', 'click', async () => {
      if (!confirm('Make 10 new backup codes? The old ones stop working.')) return;
      rec = load();
      if (!rec) return;
      const codes = L.makeCodes();
      await L.newCodes(rec, codes); save();
      showCodes(codes);
    });
    on('fingerprint', 'click', () => { rec = load(); if (rec) step('passkey'); });
    on('locknow', 'click', () => { setStamp(false); rec = load(); step('unlock'); });
    check();
    // used = the stamp moves on; a stale tab checks first, so a tap cannot skip the lock
    const touch = () => { if (shown()) return; if (L.needs(load(), stamp(), Date.now())) check(); else setStamp(true); };
    document.addEventListener('pointerdown', touch, true);
    document.addEventListener('keydown', touch, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { if (!shown() && !L.needs(load(), stamp(), Date.now())) setStamp(true); } else check();
    });
    setInterval(check, 30000);
  });

  root.LockUI = {record: () => (demo ? null : load()), demo};
})(window);
