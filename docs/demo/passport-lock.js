/* Where's My Money? Lite - v0.61 🛂 Passport ID = the lock (one ID + one login for all DF apps, see passport/PASSPORT.md).
   Replaces lockui.js. Keeps the old names the rest of the app calls:
     Lock.seal / open / openWith / adopt   LockUI.record / adopt / demo   LiteName   (LiteRestore lives in lite.js)
   - Lock screen, passcode, backup codes, fingerprint, Sign out: Passport (passport/, never edited here)
   - Backups: wmmkey.js. Saving needs no hidden key (a fingerprint unlock still saves); opening needs the passcode
   - First passcode on a device with the OLD lock (lite_lock_v1): its master key mb moves in, wrapped by the hidden key.
     The old record goes. Old backups still open with the old passcode (their own wrapped copies) or with mb.
   - Locks again after 5 minutes without use (scroll / touch / mouse count as use)
   - Demo copy: no lock. ?lock=1 = pretend Passport (no Google, demo keys only); ?lock=google = the real Passport with
     the demo's money and demo Drive folder; ?lock=0 = no lock again. Live's keys are never touched. */
(function (root) {
  'use strict';
  const isDemo = !!(root.Lite && root.Lite.Store.demo);
  const mode = isDemo ? (() => { try { return root.sessionStorage.getItem('lite_demo_lock') || ''; } catch (e) { return ''; } })() : 'live';
  const demo = isDemo && !mode;                                 // the demo: no lock at all
  const APP = isDemo ? 'wmm-demo' : 'wmm';
  const KEY_REC = isDemo ? 'lite_demo_key_v1' : 'lite_key_v1', OLD_REC = isDemo ? 'lite_demo_lock_v1' : 'lite_lock_v1';
  const STAMP_KEY = isDemo ? 'lite_demo_unlock' : 'lite_unlock', NAME_KEY = isDemo ? 'lite_demo_name' : 'lite_name';
  const IDLE_MS = 5 * 60 * 1000, TAB_KEY = isDemo ? 'lite_demo_tab_key' : 'lite_tab_key';
  const html = document.documentElement;
  const Old = Object.assign({}, root.Lock);                     // lock.js as it was (old v1 backups)
  const $ = id => document.getElementById(id);
  const PP = () => (typeof Passport !== 'undefined' ? Passport : null);
  const UI = () => (typeof PassportUI !== 'undefined' ? PassportUI : null);
  const email = () => (PP() && PP().appAccount(APP)) || '';
  const me = () => (PP() && email() ? PP().find(email()) : null);
  const first = n => String(n || '').trim().split(' ')[0];
  const ls = {
    get: k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { if (v === null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, v); } catch (e) { /* private window */ } },
  };
  const json = k => { try { return JSON.parse(ls.get(k)); } catch (e) { return null; } };

  // ---------- your name (this phone; else the passport's first name) ----------
  function myName() { return (ls.get(NAME_KEY) || '').trim() || first(me() && me().name); }
  function setName(n) { n = String(n || '').trim().slice(0, 20); ls.set(NAME_KEY, n || null); return n; }
  root.LiteName = {get: myName, set: setName};

  // ---------- the "used at" stamp (5 minutes without use = lock) ----------
  function stamp() { try { return Number(root.sessionStorage.getItem(STAMP_KEY)) || 0; } catch (e) { return 0; } }
  function setStamp(on) { try { if (on) root.sessionStorage.setItem(STAMP_KEY, String(Date.now())); else root.sessionStorage.removeItem(STAMP_KEY); } catch (e) { /* ignore */ } }
  const stale = () => !stamp() || Date.now() - stamp() > IDLE_MS;

  // ---------- after the passcode: WMM's own key for this tab (never the hidden key); gone on lock, sign out, tab close ----------
  const b64 = u => btoa(String.fromCharCode(...u)), unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
  async function setTab(k) { try { root.sessionStorage.setItem(TAB_KEY, b64(await root.WmmKey.tabKey(k))); } catch (e) { /* ignore */ } }
  function clearTab() { try { root.sessionStorage.removeItem(TAB_KEY); } catch (e) { /* ignore */ } }
  function tab() { try { const t = root.sessionStorage.getItem(TAB_KEY); return t ? {wk: unb64(t)} : null; } catch (e) { return null; } }
  const current = () => (PP() && PP().key(email())) || tab();

  // ---------- the key record: v2 (Passport) or, before the move, the old v1 lock ----------
  function record() {
    if (demo) return null;
    const r = json(KEY_REC);
    if (r && r.v === 2) return r;
    const o = json(OLD_REC);
    return o && o.v === 1 ? o : null;
  }
  // after a passcode or a backup code (the hidden key is open): make the record once, moving the old mb in
  let making = null;
  function ensureKey() {
    const k = PP() && PP().key(email());
    if (!k || !root.WmmKey) return Promise.resolve(false);
    return (making = making || (async () => {
      const now = json(KEY_REC);
      if (now && now.v === 2 && await root.WmmKey.fits(now, k)) return true;
      const old = json(OLD_REC);
      let mb = old && old.v === 1 && old.mb ? old.mb : null;
      if (!mb && now && now.v === 2) mb = await root.WmmKey.mbOf(now, k);     // (a passport reset: mb is lost then)
      const rec = await root.WmmKey.make(k, mb);
      if (mb && await root.WmmKey.mbOf(rec, k) !== mb) return false;          // never drop the old record unchecked
      ls.set(KEY_REC, JSON.stringify(rec));
      if (json(KEY_REC) && old) ls.set(OLD_REC, null);                         // the old plain mb leaves this device
      return true;
    })().finally(() => { making = null; }));
  }

  // ---------- Lock: the same names as lock.js, for lite.js ----------
  async function hiddenFrom(secret) {                           // the passport passcode typed -> the hidden key, or null
    const p = PP(), e = email();
    if (!p || !e || !p.isPasscode(String(secret == null ? '' : secret).trim())) return null;
    const r = await p.checkPasscode(e, String(secret).trim());
    if (!r.ok) return null;
    ensureKey().catch(() => {});
    await setTab(p.key(e));
    return p.key(e);
  }
  async function openBy(sealed, k) {
    if (!k || !sealed) return null;
    if (sealed.v === 2) return root.WmmKey.open(sealed, k);
    const mb = await root.WmmKey.mbOf(json(KEY_REC), k) || await root.WmmKey.mbOf(sealed, k);
    return mb ? root.WmmKey.openOld(sealed, mb) : null;
  }
  root.Lock = Object.assign(root.Lock || {}, {
    IDLE_MS,
    seal: (rec, state) => (rec && rec.v === 2 ? root.WmmKey.seal(rec, state) : Old.seal(rec, state)),
    // a backup file: the OLD passcode / an old backup code (old files), else the passport passcode
    async open(sealed, secret) {
      if (sealed && sealed.v !== 2) { const st = await Old.open(sealed, secret); if (st) return st; }
      return openBy(sealed, await hiddenFrom(secret));
    },
    // no question asked: only while the hidden key is open (passcode typed on this page), or with the old lock's own key
    async openWith(rec, sealed) {
      if (rec && rec.v === 1 && sealed && sealed.v !== 2) return Old.openWith(rec, sealed);
      return openBy(sealed, current());
    },
    // 🔁 another device: the same passport, so the passport passcode opens its copy
    async adopt(sealed, secret) { const st = await root.Lock.open(sealed, secret); return st ? {state: st} : null; },
  });

  // ---------- showing Passport over the app ----------
  function closeMenu() { const m = $('setmenu'), b = $('setbtn'); if (m) m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); }
  function cover() { closeMenu(); html.classList.add('lockon'); const b = $('wmmlock'); if (b) b.hidden = false; }
  function idLine() { const sub = document.querySelector('#passportbtn .sub'), p = me(); if (sub && p) sub.textContent = 'Your passport: ' + p.id; }
  function enter() {
    setStamp(true); idLine();
    const b = $('wmmlock'); if (b) b.hidden = true;
    html.classList.remove('lockon');
  }
  let ready = null, starting = false;
  function passport() {                                          // the theme, then Passport's screens (once)
    if (!ready) {
      ready = root.fetch('passport/theme.json').then(r => r.json()).then(theme => {
        if (isDemo) theme.drive += ' demo';                     // the demo's Drive folder: App data - DON'T DELETE / DF… / WMM demo
        starting = true;                                         // start() shows a screen by itself: the caller picks the real one
        try { UI().start({app: APP, theme, mount: $('passport'), onUnlocked: p => { if (!starting) inApp(p); }, onSignOut}); }
        finally { starting = false; }
        return theme;
      });
    }
    return ready;
  }
  function over(fn) { cover(); return passport().then(() => fn && fn()); }
  const lite = () => root.LitePassport || null;

  async function inApp(p) {                                      // Passport says yes (passcode, code or fingerprint)
    cover();
    await ensureKey().catch(() => false);
    const k = PP().key(email());
    if (k) await setTab(k); else clearTab();                     // a fingerprint: other devices' copies ask the passcode once
    const L = lite();
    const r = L ? L.unlocked(p, PP().cloud) : {};
    if (r.restore) return restore();
    goIn();
  }
  function goIn() {                                              // signed out on this page, then in again: start clean
    const L = lite();
    if (L && L.signedOut()) { setStamp(true); root.location.reload(); return; }
    enter();
  }

  // ---------- a wiped device: the money comes back from Drive (Passport has just asked the passcode) ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function page(inner) {
    const m = $('passport');
    m.innerHTML = '<main class="ps-screen" id="wmmrestore"><header class="ps-app small"><div class="ps-tile">' +
      '<img src="lite-192.png" alt="" class="ps-logoimg"></div><h1 class="ps-name">Where\'s My Money?</h1></header>' + inner + '</main>';
    return m;
  }
  const btn = (b, t) => { b.disabled = true; b.textContent = t; };
  async function restore(msg) {
    cover();
    await passport();
    const R = root.LiteRestore;
    page(`<h2 class="ps-h">☁️ Getting your money back</h2>
      <p class="ps-sub" id="wmmrmsg">Looking in Google Drive…</p>
      ${msg ? `<p class="ps-err" role="alert">${msg}</p>` : ''}
      <div class="ps-grow"></div>
      <button class="ps-btn" id="wmmrgo" hidden>☁️ Get my money from Drive</button>
      <button class="ps-link" id="wmmrnew">Start new instead</button>`);
    $('wmmrnew').addEventListener('click', () => { R.off(); goIn(); });
    $('wmmrgo').addEventListener('click', async () => {
      btn($('wmmrgo'), 'Opening Google…');
      try { await R.connect(); restore(); } catch (e) { restore(esc(e && e.message || 'Something went wrong. Try again.')); }
    });
    if (!R.hasToken()) { $('wmmrmsg').textContent = 'Tap to look in your Google Drive.'; $('wmmrgo').hidden = false; return; }
    let f;
    try { f = await R.find(); } catch (e) { $('wmmrmsg').textContent = esc(e && e.message || 'Could not look in Drive.'); $('wmmrgo').hidden = false; $('wmmrgo').textContent = 'Try again'; return; }
    if (!f.file) { R.none(); goIn(); return; }                 // a new person: nothing to bring back
    if (f.kind === 'plain') { finish(null); return; }
    const sealed = f.obj.scrambled;
    if (sealed.v === 2) {
      const k = PP().key(email()), st = await openBy(sealed, k);
      if (st) {
        const rec = json(KEY_REC);                               // the old mb rides in the file: keep it here too
        if (sealed.mb && rec && rec.v === 2 && !rec.mb && await root.WmmKey.mbOf(sealed, k)) { rec.mb = sealed.mb; ls.set(KEY_REC, JSON.stringify(rec)); }
        finish(st); return;
      }
      return UI().needKey(() => restore(), () => restore());     // (after a fingerprint: the passcode once)
    }
    oldAsk(sealed, f.day);
  }
  function oldAsk(sealed, day, msg) {                            // an old backup (before Passport): the OLD passcode once
    page(`<h2 class="ps-h">Your old passcode</h2>
      <p class="ps-sub">Your newest copy (${esc(day)}) was saved before Passport. Type the passcode you used in Where's My Money before, or one of its old backup codes. Only this once.</p>
      <form class="ps-form" id="wmmoldform">
        <label class="ps-label" for="wmmold">Old Where's My Money passcode</label>
        <input class="ps-input" id="wmmold" type="password" autocomplete="off">
        ${msg ? `<p class="ps-err" role="alert">${msg}</p>` : ''}
        <button class="ps-btn" type="submit" id="wmmoldgo">Open my money</button>
      </form>
      <button class="ps-link" id="wmmrnew">Start new instead</button>`);
    $('wmmold').focus();
    $('wmmrnew').addEventListener('click', () => { root.LiteRestore.off(); goIn(); });
    $('wmmoldform').addEventListener('submit', async e => {
      e.preventDefault();
      btn($('wmmoldgo'), 'Checking…');
      const o = await Old.adopt(sealed, $('wmmold').value);
      if (!o) { oldAsk(sealed, day, "😕 That didn't open. Check the old passcode, or type an old backup code."); return; }
      const k = PP().key(email());                               // the old mb comes in, wrapped by the hidden key
      if (k) { const rec = await root.WmmKey.make(k, o.mb); ls.set(KEY_REC, JSON.stringify(rec)); }
      finish(o.state);
    });
  }
  function finish(st) {
    if (!root.LiteRestore.finish(st)) { restore('That copy could not be read.'); return; }
    setStamp(true);
    root.location.reload();                                      // the page draws the money that came back
  }

  // ---------- 🚪 Sign out (Passport settings): save to Drive, then clear WMM on this device ----------
  async function onSignOut() {
    const L = lite();
    if (L) await L.signOut();
    ls.set(KEY_REC, null); ls.set(OLD_REC, null); ls.set(NAME_KEY, null); setStamp(false); clearTab();
  }

  // ---------- lock now / Passport settings ----------
  function lockNow() { if (PP()) PP().setUnlocked(APP, false); setStamp(false); clearTab(); return over(() => UI().route()); }
  function settings() { return over(() => UI().settings()); }

  // ---------- start ----------
  if (!demo) html.classList.add('lockon');                       // nothing of the money shows before the check
  function check() {
    if (demo || !$('wmmlock') || !$('wmmlock').hidden) return;
    const p = PP();
    if (p && p.isUnlocked(APP) && me() && !stale() && !(lite() && lite().pending(email()))) { enter(); return; }
    if (p && p.isUnlocked(APP) && stale()) { p.setUnlocked(APP, false); clearTab(); }
    over(() => UI().route());
  }
  document.addEventListener('DOMContentLoaded', () => {
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    if (demo) {                                                  // no lock in the demo: its menu items go too
      ['passportbtn', 'locknow', 'drivelink'].forEach(id => { const el = $(id); if (el) el.hidden = true; });
      const g = $('locknow') && $('locknow').parentElement; if (g) g.hidden = true;
      return;
    }
    if (!PP() || !UI() || !root.WmmKey) {                        // Passport did not load: stay locked, never open without it
      cover();
      $('passport').innerHTML = '<main class="ps-screen"><h2 class="ps-h">Could not start the lock</h2>' +
        '<p class="ps-sub">Check your internet, then reload the app.</p></main>';
      return;
    }
    idLine();
    on('passportbtn', 'click', settings);
    on('locknow', 'click', lockNow);
    check();
    // used = the stamp moves on; a stale tab checks first, so a tap cannot skip the lock
    const shown = () => !$('wmmlock').hidden;
    const touch = () => { if (shown()) return; if (stale()) lockNow(); else setStamp(true); };
    const soft = () => { if (Date.now() - stamp() > 5000) touch(); };
    document.addEventListener('pointerdown', touch, true);
    document.addEventListener('keydown', touch, true);
    ['scroll', 'wheel', 'touchstart', 'mousemove'].forEach(ev => document.addEventListener(ev, soft, {capture: true, passive: true}));
    document.addEventListener('visibilitychange', () => {
      if (shown()) return;
      if (document.visibilityState === 'hidden') { if (!stale()) setStamp(true); } else if (stale()) lockNow();
    });
    setInterval(() => { if (!shown() && stale()) lockNow(); }, 30000);
  });

  root.LockUI = {record, demo, adopt() { /* one passport: nothing to link */ }, ensureKey, lockNow, settings,
                 passportId: () => (demo ? '' : (me() && me().id) || ''), email: () => (demo ? '' : email()),
                 cloud: () => !demo && !!(PP() && PP().cloud), driveName: () => (isDemo ? 'WMM demo' : 'WMM')};
})(window);
