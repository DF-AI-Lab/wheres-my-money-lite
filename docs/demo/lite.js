/* Where's My Money? Lite - the in-browser "server".
   Live's Flask routes (/add /remove /pay /left /bill /stopped /card/... and Go A's /bill/... /pot/... /payday) become
   functions on a state object that is kept in the browser. A form post or the page script's fetch() to one of those
   routes changes the state, saves it, and (for a form) reloads the page, exactly like live's redirect after a POST.
   Every other server path still does nothing (the step 1 shim in index.html answers /stamp and swallows the rest).
   Saving: a person's own data lives in localStorage ('lite_state_v1'); ?demo=1 uses the fake data in this tab's
   sessionStorage only and never touches localStorage. Settings has Save backup / Load backup (a JSON file).
   Bump docs/sw.js VERSION with every app version (the tests check that the cache name = the page version).
   Backup file: with the lock (lock.js) it is scrambled ({scrambled: ...}, opened with the passcode or a backup code);
   the demo has no lock, so its file is the plain one. A plain old file still loads. */
(function (root) {
  'use strict';
  const M = root.Money;

  // ---------- where the state lives (one place) ----------
  const KEY = 'lite_state_v1', DEMO_KEY = 'lite_demo_v1', DEMO_FLAG = 'lite_demo_on', TODAY_KEY = 'lite_today';
  // ?demo=1 = demo for this tab. The tab remembers it for a reload (the address can lose its ?demo=1 after an error),
  // but opening the page again without ?demo=1 is the person's own data.
  // The demo copy (…/demo/, Darren 22 Oct) is ALWAYS the fake data: new work lands there before live, so it must never
  // read or write the real data that live keeps in this same website's localStorage.
  const demoCopy = /\/demo\//.test(root.location.pathname);
  function isDemo() {
    if (demoCopy) return true;
    try {
      if (new URLSearchParams(location.search).get('demo') === '1') { root.sessionStorage.setItem(DEMO_FLAG, '1'); return true; }
      const nav = (root.performance.getEntriesByType('navigation')[0] || {}).type;
      if (root.sessionStorage.getItem(DEMO_FLAG) === '1' && (nav === 'reload' || nav === 'back_forward')) return true;
      root.sessionStorage.removeItem(DEMO_FLAG);
    } catch (e) { /* no storage */ }
    return false;
  }
  const demo = isDemo();
  const Store = {
    demo,
    key: demo ? DEMO_KEY : KEY,
    area() { return demo ? root.sessionStorage : root.localStorage; },
    load() {
      try {
        const raw = Store.area().getItem(Store.key);
        if (raw) { const s = JSON.parse(raw); if (s && typeof s === 'object' && Array.isArray(s.bills)) return M.migrate(s); }
      } catch (e) { /* no storage: start from the template / fake data */ }
      return null;
    },
    save(s) {
      if (signedOut) return;
      if (s !== firstState) blankSet(false);                      // loaded or brought back = real money
      try { Store.area().setItem(Store.key, JSON.stringify(s)); } catch (e) { /* private window: not saved */ }
    },
  };
  let signedOut = false;                                          // v0.61: 🚪 signed out of Passport: nothing more is saved
  // v0.57 the demo copy can try the lock as a WIPED device: ?lock=1 clears the demo's own lock, name, money and Drive
  // keys and turns its lock on for this tab; ?lock=0 = no lock again. Live's keys are never touched.
  if (demoCopy) {
    try {
      const u = new URL(location.href), q = u.searchParams.get('lock');
      if (q === '1' || q === 'google') {                         // v0.61: 1 = pretend Passport (no Google), google = the real one
        ['lite_demo_lock_v1', 'lite_demo_key_v1', 'lite_demo_name'].concat(Object.keys(root.localStorage).filter(k => k.indexOf('lite_demo_drive_') === 0))
          .forEach(k => root.localStorage.removeItem(k));
        [DEMO_KEY, 'lite_demo_unlock', 'lite_demo_drive_token', 'passport-unlocked-wmm-demo'].forEach(k => root.sessionStorage.removeItem(k));
        ['passport-demo-v2', 'passport-v2'].forEach(k => {      // the demo app forgets its Google account (passports stay)
          const db = JSON.parse(root.localStorage.getItem(k) || 'null');
          if (db && db.apps && db.apps['wmm-demo']) { delete db.apps['wmm-demo']; root.localStorage.setItem(k, JSON.stringify(db)); }
        });
        root.sessionStorage.setItem('lite_demo_lock', q);
      } else if (q === '0') root.sessionStorage.removeItem('lite_demo_lock');
      if (q !== null) { u.searchParams.delete('lock'); history.replaceState(null, '', u.pathname + u.search + u.hash); }   // a reload must not wipe again
    } catch (e) { /* no storage */ }
  }
  // v0.61: no money here yet = a wiped device may get it back. The starter money saved on the first open is not money:
  // 'blank' stays until something is typed or loaded, so it can never go over a Drive copy.
  const BLANK = demo ? 'lite_demo_drive_blank' : 'lite_drive_blank';
  const blankGet = () => { try { return root.localStorage.getItem(BLANK); } catch (e) { return null; } };
  const blankSet = on => { try { if (on) root.localStorage.setItem(BLANK, '1'); else root.localStorage.removeItem(BLANK); } catch (e) { /* ignore */ } };
  if (!Store.load()) blankSet(true);
  let hadState = !!Store.load() && !blankGet();
  let state = Store.load() || (demo ? M.FAKE() : M.TEMPLATE());
  const firstState = state;
  // ask the browser not to clear the saved data (it may say no; that is fine)
  if (!demo) { try { const p = root.navigator.storage && root.navigator.storage.persist && root.navigator.storage.persist(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }

  // today: ?today=YYYY-MM-DD (kept for the tab), else the computer's date
  function today() {
    try {
      const p = new URLSearchParams(location.search).get('today');
      if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) { root.sessionStorage.setItem(TODAY_KEY, p); return p; }
      const t = root.sessionStorage.getItem(TODAY_KEY);
      if (t) return t;
    } catch (e) { /* ignore */ }
    const d = new Date(), z = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }

  // ---------- the routes ----------
  // Each takes (state, get) where get(name) reads a posted field; returns null (worked) or an error code.
  const quiet = r => r === 'unknown' ? null : r;                 // a bill or pot that is gone: nothing happens
  const ROUTES = {
    '/add': (s, get) => {                                        // v0.59: Upcoming = No date yet, or a picked date
      const up = get('upcoming') === '1', nodate = up && !get('date').trim() && get('nodate') === '1';
      if (up && !nodate && !get('date').trim()) return 'spend';
      return M.addSpend(s, today(), get('amount'), get('name'), up && !nodate ? get('date') : '', nodate);
    },
    '/spend/paid': (s, get) => M.paySpend(s, get('id'), today()),
    '/spend/date': (s, get) => M.setSpendDate(s, get('id'), get('date')),
    '/spend/cat': (s, get) => M.setSpendCat(s, get('id'), get('cat')),
    '/spend/amount': (s, get) => M.setSpendAmount(s, get('id'), get('amount')),
    '/spend/name': (s, get) => M.renameSpend(s, get('id'), get('name')),
    '/bills/paid': (s, get) => { let k = []; try { k = JSON.parse(get('keys') || '[]'); } catch (e) { /* none */ } return M.setBillsPaid(s, k); },
    '/remove': (s, get) => M.removeSpend(s, get('id')),
    '/pay': (s, get) => M.setPay(s, get('pay'), get('clear') === '1'),
    '/left': (s, get) => M.setLeft(s, get('amount')),
    '/bill': (s, get) => quiet(M.setBill(s, get('key'), get('amount'))),
    '/stopped': (s, get) => quiet(M.setStopped(s, get('key'), get('stopped') === '1')),
    '/bill/add': (s, get) => M.addBill(s, get('amount'), get('name')),
    '/bill/name': (s, get) => quiet(M.renameBill(s, get('key'), get('name'))),
    '/bill/due': (s, get) => quiet(M.setDue(s, get('key'), get('day'))),
    '/reminders/clear': s => quiet(M.clearReminders(s, today())),
    '/bill/paid': (s, get) => quiet(M.setPaid(s, get('key'), get('paid') === '1')),
    '/bill/cat': (s, get) => quiet(M.setBillCat(s, get('key'), get('cat'))),
    '/bill/delete': (s, get) => quiet(M.deleteBill(s, get('key'))),
    '/pot/add': (s, get) => M.addPot(s, get('amount'), get('name')),
    '/pot/amount': (s, get) => quiet(M.setPotAmount(s, get('key'), get('amount'))),
    '/pot/name': (s, get) => quiet(M.renamePot(s, get('key'), get('name'))),
    '/pot/cat': (s, get) => quiet(M.setPotCat(s, get('key'), get('cat'))),
    '/pot/delete': (s, get) => quiet(M.deletePot(s, get('key'))),
    '/payday/day': (s, get) => M.setPayDay(s, get('day')),
    '/backup/saved': (s, get) => M.setBackupDay(s, today()),
    '/payday': (s, get) => M.newPayday(s, today(), get('pay'), get('left')),
    '/card/add': (s, get) => quiet(M.cardAdd(s, today(), get('amount'), get('name'), get('paid') === '1', get('card'))),
    '/card/remove': (s, get) => quiet(M.cardRemove(s, get('id'), get('card'))),
    '/card/limit': (s, get) => quiet(M.cardLimit(s, get('amount'), get('card'))),
    '/card/balance': (s, get) => quiet(M.cardBalance(s, today(), get('amount'), get('card'))),
    '/card/new': (s, get) => M.addCreditCard(s, get('name'), get('limit')),
    '/card/name': (s, get) => quiet(M.renameCreditCard(s, get('card'), get('name'))),
    '/card/delete': (s, get) => quiet(M.deleteCreditCard(s, get('card'))),
    '/bill/card': (s, get) => quiet(M.setBillCard(s, get('key'), get('card'))),
    '/card/ask': (s, get) => quiet(M.cardAsk(s, today(), get('bill'), get('answer'), get('amount'))),
    '/layout': (s, get) => M.setLayout(s, get('sort'), get('ids')),
    '/name': (s, get) => M.renameRow(s, get('id'), get('name')),
    '/layout/reset': (s) => M.resetLayout(s),
    '/ideas/add': (s, get) => M.addIdea(s, get('text'), get('tag'), nowLocal()),
    '/ideas/done': (s, get) => M.toggleIdea(s, get('id')),
    '/ideas/remove': (s, get) => M.removeIdea(s, get('id')),
  };
  const QUIET_204 = ['/layout', '/name'];                         // live answers these fetch calls with 204 (no reload)
  function nowLocal() {                                           // 'YYYY-MM-DDTHH:MM' on this phone's clock
    const d = new Date(), z = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
  }
  const pathOf = url => { try { return new URL(url, location.href).pathname; } catch (e) { return ''; } };
  // a field of a form or JSON body; a list (the saved order's ids) comes back as it is
  const getter = data => name => { const v = data.get(name); return v === null || v === undefined ? '' : (Array.isArray(v) ? v : String(v)); };

  // Run a route on the state and save it. Returns {error, unknownBill}.
  function run(path, data) {
    const fn = ROUTES[path];
    if (!fn) return null;
    let unknown = false;
    if (path === '/bill' || path === '/stopped') {
      unknown = !state.bills.some(b => b.key === getter(data)('key'));
    }
    const before = path === '/bill/add' ? state.bills.length : 0;
    const linked = devRole() === 'linked' && path !== '/backup/saved';   // v0.64: a linked device asks its Main
    const label = linked ? changeLabel(path, getter(data), state) : '';
    const error = fn(state, getter(data));
    if (!error && linked) { blankSet(false); hadState = true; Store.save(state); outAdd(path, data, label); outSoon(); }
    else if (!error) { blankSet(false); hadState = true; Store.save(state); lsSet(DRIVE_DIRTY, String(Date.now())); driveSign(); driveSoon(); }   // Drive: 1 minute on, or when hidden
    // a new bill glows once on the next page (v0.36, mock D)
    if (path === '/bill/add' && !error && state.bills.length > before) {
      try { root.sessionStorage.setItem('lite_glow', state.bills[state.bills.length - 1].key); } catch (e) { /* ignore */ }
    }
    return {error, unknown};
  }

  // ---------- stay put: after a save the page comes back where you were (Darren, 22 Oct) ----------
  // The place = what you tapped (its form, else its row or card) and how far down the screen it sat.
  let lastTap = null, lastForm = null;
  document.addEventListener('pointerdown', e => {
    const t = e.target;
    if (t && t.closest && !t.closest('.sheetback, .bmenu, [role=menu]')) lastTap = t;   // a sheet or menu = the thing that opened it
  }, true);
  const shown = el => el && el.isConnected && el.getBoundingClientRect().height > 0;
  function placesOf(el) {                                         // [{sel, i, top}], the closest first
    const out = [], add = (node, sel) => {
      if (!shown(node)) return;
      const i = Array.prototype.indexOf.call(document.querySelectorAll(sel), node);
      if (i >= 0) out.push({sel, i, top: node.getBoundingClientRect().top});
    };
    const f = el && el.closest && el.closest('form[action]');
    if (f) add(f, `form[action="${f.getAttribute('action')}"]`);
    for (let n = el; n && n.closest; n = n.parentElement && n.parentElement.closest('[data-id]')) {
      n = n.closest('[data-id]');
      if (!n) break;
      add(n, `[data-id="${CSS.escape(n.dataset.id)}"]`);
    }
    return out;
  }
  function keepPlace() {
    let places = placesOf(lastTap);
    if (!places.length) places = placesOf(lastForm);
    try { sessionStorage.setItem('lite_place', JSON.stringify({places, y: scrollY})); } catch (e) { /* no storage: top */ }
  }
  // v0.41: back to the place as soon as the cards are drawn (start()), not after 'load': that waits for the Google
  // fonts and the Google sign-in script, so on a phone the page sat at the top for half a second (Darren: 'flickers')
  let placeNow = () => {};
  function backToPlace() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('lite_place')); sessionStorage.removeItem('lite_place'); } catch (e) { /* none */ }
    if (!saved) return;
    let moved = false;                                             // the person scrolled since: leave it where they put it
    ['wheel', 'touchstart', 'keydown'].forEach(t => addEventListener(t, () => { moved = true; }, {once: true, passive: true}));
    const go = () => {                                             // true = the thing was found and put back
      if (moved) return true;
      let top = saved.y || 0, found = false;
      for (const p of saved.places || []) {
        const node = document.querySelectorAll(p.sel)[p.i];
        if (shown(node)) { top = scrollY + node.getBoundingClientRect().top - p.top; found = true; break; }
      }
      scrollTo({top, behavior: 'instant'});
      return found;
    };
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    // until it is placed, the page shows only its background: no glimpse of the top (1.5 s at most)
    const hide = document.createElement('style');
    hide.textContent = 'body > * { visibility: hidden !important; }';
    document.head.appendChild(hide);
    const show = () => hide.remove();
    setTimeout(show, 1500);
    placeNow = () => { if (go()) show(); };                        // the lock can still hide the cards here
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => { go(); show(); }));   // after the lock opens
    if (document.readyState === 'complete') go(); else addEventListener('load', () => { go(); requestAnimationFrame(go); });   // fonts can move it
  }
  backToPlace();

  // ---------- forms: apply, then go where live's redirect goes ----------
  function leave(error) {
    keepPlace();
    leaving = true;
    if (error) {
      const u = new URL(location.href);
      u.searchParams.set('error', error);
      location.assign(u.toString());
    } else {
      const u = new URL(location.href);               // a fresh load at the top, like live's redirect after a POST (?view= stays)
      if (u.hash) { u.hash = ''; history.replaceState(null, '', u.toString()); location.reload(); }   // a #hash alone would not reload
      else location.replace(u.toString());
    }
  }

  // ---------- the backup file (Settings, and the New payday panel) ----------
  // the backup file object (scrambled when there is a lock): Save backup and the Google Drive copy both use it
  async function backupFile() {
    const plain = M.exportBackup(state, today()), rec = root.LockUI && root.LockUI.record();
    return rec ? {app: plain.app, version: plain.version, saved: plain.saved, scrambled: await root.Lock.seal(rec, plain.state)} : plain;
  }
  async function saveBackup() {
    const day = today();
    M.setBackupDay(state, day); Store.save(state);                 // remember the day (it is in the file too)
    const file = await backupFile();
    const blob = new Blob([JSON.stringify(file, null, 1)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = M.backupName(day);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    const saved = document.getElementById('lastsaved');
    if (saved) saved.textContent = M.backupText(day, day);
    if (root.refreshBell) root.refreshBell();
  }
  async function loadBackup(text, stamp) {                         // stamp: the Drive copy it came from (v0.64)                                // the text of a backup file (from a file or from Drive)
    let obj = null;
    try { obj = JSON.parse(text); } catch (e) { /* not JSON */ }
    if (obj && typeof obj === 'object' && obj.app === 'wheres-my-money-lite' && obj.scrambled) {   // scrambled: ask for the key
      const secret = await root.Sheet.ask('🔑 Open this backup', 'Your passcode (or a backup code)', '');
      if (secret === null) return;
      const st = await root.Lock.open(obj.scrambled, secret);
      if (!st) { await root.Sheet.tell("😕 That didn't open", 'Check the passcode or backup code and try again.'); return; }
      obj = {app: obj.app, saved: obj.saved, state: st};
    }
    const s = M.importBackup(obj);
    if (!s) { await root.Sheet.tell('😕 Not a backup', "That is not a Where's My Money backup file."); return; }
    if (!await root.Sheet.confirm('📂 Load this backup?', 'Everything on this phone is replaced with the backup from ' + M.fmt.day(obj.saved) + '.', 'Replace', true)) return;
    lsSet(DRIVE_UNDO, JSON.stringify(state));                      // v0.56: ↩️ Undo after the reload
    try { root.sessionStorage.setItem('lite_synced', 'load'); } catch (e) { /* ignore */ }
    if (stamp) lsSet(DRIVE_SYNCED, stamp);
    Store.save(s);
    location.reload();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const ver = document.querySelector('.demohead .appver');               // "demo.v0.28", like v3's test copy
    if (demoCopy && ver) ver.textContent = 'demo.' + ver.textContent.trim();
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
    on('savebackup', 'click', saveBackup);
    on('qsave', 'click', saveBackup);
    on('loadbackup', 'click', () => document.getElementById('loadfile').click());
    on('loadfile', 'change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) f.text().then(loadBackup); });
  });

  // ---------- ☁️ a copy of the scrambled backup in the person's own Google Drive (?view=drive) ----------
  // The scope drive.file means the app only ever sees the files it made.
  // the demo (fake data) keeps its own Drive files + keys, so a live Load can never pick up the demo's copy
  // v0.37 (Darren, 24 Oct, no server): once connected, the first tap of each visit (the unlock tap) quietly gets a new
  // Google token (no account picker); when the app is hidden and something changed, one save goes to Drive.
  // One file per pay month ('wheres-my-money-backup Oct 2026.json'), saved over all month; the last 3 are kept.
  const DRIVE_BASE = demo ? 'wheres-my-money-demo-backup' : 'wheres-my-money-backup';
  const DRIVE_FOLDER = demo ? "Where's My Money Lite (demo)" : "Where's My Money Lite";   // v0.38: every backup in one folder
  const DK = n => (demo ? 'lite_demo_drive_' : 'lite_drive_') + n;           // localStorage keys: file, folder, on, dirty, last
  const DRIVE_ID = DK('file'), DRIVE_DIR = DK('folder'), DRIVE_ON = DK('on'), DRIVE_DIRTY = DK('dirty'), DRIVE_LAST = DK('last');
  const DRIVE_EMAIL = DK('email');                                           // v0.40: the Gmail, so Google skips 'which account?'
  const RESTORE = DK('restore'), PPSEEN = DK('ppseen');                      // v0.61: 'need' = get the money back first; the passport seen
  const SUMMARY_NAME = demo ? 'wmm-demo-summary.json' : 'wmm-summary.json', PAIR_FILE = demo ? 'wmm-lite-demo-pair.json' : 'wmm-lite-pair.json';
  const JOB_PREFIX = demo ? 'wmm-demo-job-' : 'wmm-job-';
  const TOKEN_KEY = demo ? 'lite_demo_drive_token' : 'lite_drive_token';     // sessionStorage: survives the reload after a save
  const GSI = 'https://accounts.google.com/gsi/client';
  const FOLDER_TYPE = 'application/vnd.google-apps.folder';
  const DRIVE_API = 'https://www.googleapis.com/drive/v3/files', DRIVE_UP = 'https://www.googleapis.com/upload/drive/v3/files';
  const lsGet = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v === null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const PP_TOKEN = 'passport-google-token';                       // v0.61 🛂 Passport's Google sign-in (same Google key)
  function getToken() {
    try { const t = JSON.parse(root.sessionStorage.getItem(TOKEN_KEY)); if (t && t.t && t.exp > Date.now() + 60000) return t.t; } catch (e) { /* none */ }
    try {
      const p = JSON.parse(root.sessionStorage.getItem(PP_TOKEN)), mail = lsGet(DRIVE_EMAIL);
      if (p && p.token && p.exp > Date.now() + 60000 && (!mail || !p.email || p.email.toLowerCase() === mail.toLowerCase())) return p.token;
    } catch (e) { /* none */ }
    return '';
  }
  function setToken(t, secs) {
    try { if (t) root.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({t, exp: Date.now() + (secs || 3600) * 1000}));
          else root.sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }
  const clientId = () => (root.LITE_CONFIG || {}).googleClientId;
  function loadGsi() {
    return new Promise((resolve, reject) => {
      if (root.google && root.google.accounts && root.google.accounts.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = GSI; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not reach Google. Check your internet and try again.'));
      document.head.appendChild(s);
    });
  }
  // quiet = no account picker (the person said yes before); the first time is the full Google sign-in
  function driveConnect(quiet, pick) {                         // pick = 'which Google account?' (v0.43 Account page)
    const hint = quiet ? lsGet(DRIVE_EMAIL) : '';
    return new Promise((resolve, reject) => {
      const client = root.google.accounts.oauth2.initTokenClient(Object.assign({
        client_id: clientId(), scope: 'https://www.googleapis.com/auth/drive.file',
        callback: t => { if (quiet && !lsGet(DRIVE_ON)) return reject(new Error('Turned off'));   // v0.47: Turn off tapped meanwhile
                         if (t && t.access_token) { setToken(t.access_token, Number(t.expires_in) || 3600); lsSet(DRIVE_ON, '1'); resolve(); }
                         else reject(new Error('Google did not let you in. Try again.')); },
        error_callback: () => reject(new Error('Google sign-in was closed or blocked. Try again.')),
      }, hint ? {login_hint: hint} : {}));
      if (quiet) client.requestAccessToken(Object.assign({prompt: ''}, hint ? {login_hint: hint} : {}));
      else if (pick) client.requestAccessToken({prompt: 'select_account'}); else client.requestAccessToken();
    }).then(driveEmail);
  }
  async function driveEmail() {                                    // which Google account: asked once, kept
    if (lsGet(DRIVE_EMAIL)) return;
    try {
      const r = await driveFetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
      const e = r.ok && ((await r.json()).user || {}).emailAddress;
      if (e) { lsSet(DRIVE_EMAIL, e); driveMenu(); accMenu(); }
    } catch (e) { /* ask next time */ }
  }
  async function driveFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({Authorization: 'Bearer ' + getToken()}, opts.headers || {});
    let r;
    try { r = await root.fetch(url, opts); } catch (e) { throw new Error('Could not reach Google Drive. Check your internet and try again.'); }
    if (r.status === 401) { setToken(''); try { root.sessionStorage.removeItem(PP_TOKEN); } catch (e) { /* ignore */ } driveShow(false); throw new Error('Google Drive signed you out. Tap Connect Google Drive again.'); }
    return r;
  }
  async function driveList() {                                     // this app's backup files, the newest first
    const q = encodeURIComponent(`name contains '${DRIVE_BASE}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)`);
    if (!r.ok) throw new Error('Could not look in your Google Drive (error ' + r.status + ').');
    return ((await r.json()).files || []).filter(f => f.name && f.name.indexOf(DRIVE_BASE) === 0);
  }
  // v0.61 🛂 with a passport every file lives in App data - DON'T DELETE / DF123456 / WMM (Passport's own folders)
  const PP_ROOT = "App data - DON'T DELETE";
  const ppId = () => (root.LockUI && root.LockUI.passportId && root.LockUI.passportId()) || '';
  const dirKey = () => (ppId() ? DK('ppdir') : DRIVE_DIR);            // (the old folder's id is never used for the new one)
  const qEsc = t => String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  async function folderIn(name, parent) {                          // a folder's id inside parent (found or made); null = binned
    const q = encodeURIComponent(`name='${qEsc(name)}' and mimeType='${FOLDER_TYPE}' and trashed=false` + (parent ? ` and '${parent}' in parents` : ''));
    const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name,mimeType,parents)`);
    let f = r.ok ? ((await r.json()).files || []).find(x => x.name === name && x.mimeType === FOLDER_TYPE &&
                                                            (!parent || !x.parents || x.parents.indexOf(parent) >= 0)) : null;
    if (!f) {
      const m = await driveFetch(`${DRIVE_API}?fields=id,trashed`, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.assign({name, mimeType: FOLDER_TYPE}, parent ? {parents: [parent]} : {}))});
      f = m.ok ? await m.json() : null;
    }
    return f && f.id && !f.trashed ? f.id : null;
  }
  async function driveFolder() {                                   // the folder's id (found or made once); null = save loose
    if (lsGet(dirKey())) return lsGet(dirKey());
    try {
      let id = null;
      if (ppId()) {
        const top = await folderIn(PP_ROOT, null), df = top && await folderIn(ppId(), top);
        id = df && await folderIn(root.LockUI.driveName(), df);
      } else id = await folderIn(DRIVE_FOLDER, null);
      if (id) { lsSet(dirKey(), id); return id; }
    } catch (e) { /* no folder this time */ }
    return null;
  }
  // v0.61 move the files from before Passport into the WMM folder ONCE (backups, safety copies, summary, pair note, Orbit jobs).
  // Every lookup is by name, never by folder, so Load, Orbit's jobs and the summary are found wherever they are.
  async function moveIn() {
    const pid = ppId();
    if (!pid || lsGet(DK('moved')) === pid) return;
    try {
      const top = await driveFolder(), safe = top && await safeFolder();
      if (!top) return;
      let all = true;
      for (const [base, to] of [[DRIVE_BASE, top], [SAFE_BASE + ' ', safe], [SUMMARY_NAME, top], [PAIR_FILE, top], [JOB_PREFIX, top]]) {
        if (!to) { all = false; continue; }
        const q = encodeURIComponent(`name contains '${qEsc(base.trim())}' and trashed=false`);
        const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name,mimeType,parents)`);
        if (!r.ok) { all = false; continue; }
        for (const f of (await r.json()).files || []) {
          if (!f.name || f.name.indexOf(base) !== 0 || f.mimeType === FOLDER_TYPE || !Array.isArray(f.parents) || f.parents.indexOf(to) >= 0) continue;
          const out = f.parents.length ? '&removeParents=' + encodeURIComponent(f.parents.join(',')) : '';
          const m = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?addParents=${encodeURIComponent(to)}${out}&fields=id,parents`,
            {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: '{}'});
          if (!m.ok) all = false;
        }
      }
      if (all) lsSet(DK('moved'), pid);
    } catch (e) { /* next time */ }
  }
  // one save at a time: Save tapped and the app hidden straight after = one file, not two (v0.38)
  let driveBusy = null;
  function driveSave(hidden) {
    if (!driveBusy) {
      driveSign('saving');
      driveBusy = driveSaveNow(hidden).then(() => driveSign('saved pop'), e => { driveSign(); throw e; })
                                      .finally(() => { driveBusy = null; });
    }
    return driveBusy;
  }
  async function driveSaveNow(hidden) {
    if (lsGet(RESTORE) === 'need') throw new Error('Getting your money back from Google Drive first.');   // v0.61: never over the copy
    await moveIn();                                                // v0.61: once, into the passport's WMM folder
    if (devRole() === 'linked') throw new Error('This device is linked: its changes go to your Main to say yes.');   // v0.64
    const was = lsGet(DRIVE_DIRTY);                                // a change made while this one is going stays to send
    if (syncOn()) {                                                // v0.45: never write over a newer copy from the other device
      const f = (await driveList())[0];
      if (f && stampOf(f) !== lsGet(DRIVE_SYNCED)) {
        setTimeout(() => syncCheck(), 0);
        throw new Error('Your other device saved a newer copy first. Nothing was written over it.');
      }
    } else await guardNewer(hidden);                               // v0.64: the same check for everyone (Darren, 4 Nov)
    const text = JSON.stringify(await backupFile()), name = M.driveName(state, today(), demo);
    let saved = null;
    try { saved = JSON.parse(lsGet(DRIVE_ID)); } catch (e) { /* an old plain id: a new month file */ }
    if (!saved || saved.name !== name) {                           // no id for this month here: is the file in Drive already?
      try { const f = (await driveList()).find(x => x.name === name); if (f) saved = {name, id: f.id}; } catch (e) { /* make one */ }
    }
    let folder = null;
    const send = async id => {
      const meta = id ? {name} : Object.assign({name, mimeType: 'application/json'}, folder ? {parents: [folder]} : {});
      const b = 'wmm' + Date.now();
      const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
                   `--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
      const r = await driveFetch(`${DRIVE_UP}${id ? '/' + encodeURIComponent(id) : ''}?uploadType=multipart&fields=id,trashed,modifiedTime`,
        {method: id ? 'PATCH' : 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b}, body,
         keepalive: !!hidden && body.length < 60000});              // the app is closing: let the save finish
      if (!r.ok) return {status: r.status};
      const j = await r.json().catch(() => ({}));
      return {status: r.status, ok: true, id: j.id || id, trashed: !!j.trashed, mt: j.modifiedTime || ''};
    };
    const fresh = async () => { folder = await driveFolder(); return send(null); };
    let id = saved && saved.name === name ? saved.id : null;
    if (id) await safeDaily(id);                                   // v0.56: the day's first save keeps the old copy first
    let r = id ? await send(id) : await fresh();
    // v0.39: Drive lets you save into a binned file (or a binned folder): that counts as gone too
    if (id && (r.status === 404 || r.trashed)) { id = null; r = await fresh(); }   // deleted in Drive: make a new one
    if (!id && (r.status === 404 || r.trashed) && folder) { lsSet(dirKey(), null); r = await fresh(); }   // folder gone: a new one
    if (!r.ok) throw new Error('Google Drive would not take the copy (error ' + r.status + ').');
    if (r.id) lsSet(DRIVE_ID, JSON.stringify({name, id: r.id}));
    lsSet(DRIVE_SYNCED, r.id && r.mt ? r.id + '@' + r.mt : null);    // v0.45: the copy in Drive is this device's now
    if (!id) {                                                     // a new pay month: a new file, then keep the last 3
      try { for (const old of M.drivePrune(await driveList(), 3)) await driveFetch(`${DRIVE_API}/${encodeURIComponent(old)}`, {method: 'DELETE'}); }
      catch (e) { /* tidy next time */ }
    }
    if (lsGet(DRIVE_DIRTY) === was) lsSet(DRIVE_DIRTY, null);
    lsSet(DRIVE_LAST, new Date().toISOString());
    M.setBackupDay(state, today()); Store.save(state);             // counts as a backup (no bell reminder)
    try { await summaryWrite(hidden, folder); } catch (e) { /* the summary never fails the save */ }
  }
  // v0.60 Orbit inbox: wmm-summary.json = totals only, NOT scrambled, next to the backups (for Claude to read)
  async function summaryWrite(hidden, folder) {
    const name = SUMMARY_NAME, key = DK('summary');
    folder = folder || await driveFolder();
    const text = JSON.stringify(M.summary(state, today(), new Date().toISOString()));
    const send = async id => {
      const meta = id ? {name} : Object.assign({name, mimeType: 'application/json'}, folder ? {parents: [folder]} : {});
      const b = 'wmm' + Date.now();
      const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
                   `--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
      const r = await driveFetch(`${DRIVE_UP}${id ? '/' + encodeURIComponent(id) : ''}?uploadType=multipart&fields=id,trashed`,
        {method: id ? 'PATCH' : 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b}, body,
         keepalive: !!hidden && body.length < 60000});
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      return {ok: r.ok, status: r.status, id: j.id || id, trashed: !!j.trashed};
    };
    let id = lsGet(key), r = id ? await send(id) : null;
    if (!r || r.status === 404 || r.trashed) {                     // gone: look for it by name, else make it
      const q = encodeURIComponent(`name='${name}' and trashed=false`);
      const l = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`);
      const f = l.ok ? ((await l.json()).files || []).find(x => x.name === name) : null;
      r = f ? await send(f.id) : null;
      if (!r || !r.ok || r.trashed) r = await send(null);
    }
    if (r.ok && r.id) lsSet(key, r.id);
  }
  async function driveLoad() {
    const list = await driveList();
    if (!list.length) throw new Error('There is no copy in your Google Drive yet. Save one first.');
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(list[0].id)}?alt=media`);
    if (!r.ok) throw new Error('Could not read the copy from Google Drive (error ' + r.status + ').');
    await loadBackup(await r.text(), stampOf(list[0]));
  }
  async function driveDownload() {                                 // v0.55: the newest Drive copy as a file here
    const list = await driveList();
    if (!list.length) throw new Error('There is no copy in your Google Drive yet. Save one first.');
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(list[0].id)}?alt=media`);
    if (!r.ok) throw new Error('Could not read the copy from Google Drive (error ' + r.status + ').');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([await r.text()], {type: 'application/json'})); a.download = list[0].name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return list[0].name;
  }
  // ---------- v0.56 daily safety copies: Drive is the only copy, so a save may never lose an older day ----------
  // Before the first save of a day writes over the Drive copy, that copy is copied into 'Safety copies' as the day's file.
  // A day's file is made once and never written again; the newest 30 days are kept.
  const SAFE_BASE = demo ? 'wmm-lite-demo-safety' : 'wmm-lite-safety', SAFE_DAY = DK('safeday');
  const safeKey = () => (ppId() ? DK('ppsafe') : DK('safedir'));
  const SAFE_KEEP = 30;
  async function safeList() {                                      // the safety copies, the newest day first
    const q = encodeURIComponent(`name contains '${SAFE_BASE}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`);
    if (!r.ok) throw new Error('Could not look in your Google Drive (error ' + r.status + ').');
    return ((await r.json()).files || []).map(f => Object.assign(f, {day: (/(\d{4}-\d{2}-\d{2})\.json$/.exec(f.name || '') || [])[1]}))
      .filter(f => f.name.indexOf(SAFE_BASE + ' ') === 0 && f.day).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }
  async function safeFolder() {                                    // 'Safety copies' inside the app's folder (found or made once)
    if (lsGet(safeKey())) return lsGet(safeKey());
    if (ppId()) {                                                  // v0.61: inside App data - DON'T DELETE / DF… / WMM
      let id = null;
      for (let n = 0; !id && n < 2; n++) { const top = await driveFolder(); id = top && await folderIn('Safety copies', top); if (!id) lsSet(dirKey(), null); }
      if (id) lsSet(safeKey(), id);
      return id;
    }
    const q = encodeURIComponent(`name='Safety copies' and mimeType='${FOLDER_TYPE}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name,mimeType)`);
    let f = r.ok ? ((await r.json()).files || []).find(x => x.name === 'Safety copies' && x.mimeType === FOLDER_TYPE) : null;
    for (let n = 0; !f && n < 2; n++) {                            // made inside a binned folder = binned: the folder again
      const top = await driveFolder();
      const m = await driveFetch(`${DRIVE_API}?fields=id,trashed`, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.assign({name: 'Safety copies', mimeType: FOLDER_TYPE}, top ? {parents: [top]} : {}))});
      f = m.ok ? await m.json() : null;
      if (f && f.trashed) { f = null; lsSet(dirKey(), null); }
    }
    if (f && f.id) lsSet(safeKey(), f.id);
    return f && f.id;
  }
  async function safeDaily(mainId) {                               // never stops the save itself
    const day = today();
    if (lsGet(SAFE_DAY) === day) return;
    try {
      let list = await safeList();
      if (!list.some(f => f.day === day)) {
        const copy = async () => {
          const dir = await safeFolder().catch(() => null);
          const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(mainId)}/copy?fields=id,trashed`, {method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(Object.assign({name: `${SAFE_BASE} ${day}.json`}, dir ? {parents: [dir]} : {}))});
          return r.ok && !(await r.json().catch(() => ({}))).trashed;
        };
        // a binned folder (v0.39) = the copy lands in the bin: find or make the folders again
        if (!await copy()) { lsSet(safeKey(), null); lsSet(dirKey(), null); if (!await copy()) return; }
        list = await safeList();
      }
      for (const old of list.slice(SAFE_KEEP)) await driveFetch(`${DRIVE_API}/${encodeURIComponent(old.id)}`, {method: 'DELETE'});
      lsSet(SAFE_DAY, day);
    } catch (e) { /* try again on the next save */ }
  }
  async function safeText(f) {
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
    if (!r.ok) throw new Error('Could not read that copy from Google Drive (error ' + r.status + ').');
    return r.text();
  }
  function fileOut(name, text) {                                   // a file to keep on this device
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'})); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  let safeFiles = [];
  async function safeShow() {                                      // the list in ?view=drive
    const list = document.getElementById('safelist'), all = document.getElementById('safeall');
    if (!list || !getToken()) return;
    try { safeFiles = await safeList(); } catch (e) { list.innerHTML = '<p class="hint">Could not look in your Drive just now.</p>'; return; }
    list.textContent = '';
    all.hidden = !safeFiles.length;
    if (!safeFiles.length) { list.innerHTML = '<p class="hint">The first one is made the next time the app saves.</p>'; return; }
    safeFiles.forEach(f => {
      const row = document.createElement('div');
      row.className = 'saferow';
      row.innerHTML = '<span><b></b><span class="sub">' + (/ other device /.test(f.name) ? "Another device's copy" : 'Start of the day') + '</span></span>' +
        '<button type="button" class="small safeload">Load</button><button type="button" class="small safedl" aria-label="Download">⬇️</button>';
      row.querySelector('b').textContent = M.fmt.day(f.day);
      row.querySelector('.safeload').dataset.id = f.id;
      row.querySelector('.safedl').dataset.id = f.id;
      list.append(row);
    });
  }
  function safeStart(run) {
    const list = document.getElementById('safelist');
    const pick = id => safeFiles.find(f => f.id === id);
    list.addEventListener('click', e => {
      const b = e.target.closest('button'), f = b && pick(b.dataset.id);
      if (!f) return;
      if (b.classList.contains('safeload')) run(async () => loadBackup(await safeText(f)))();
      else run(async () => fileOut(f.name, await safeText(f)))();
    });
    document.getElementById('safeall').addEventListener('click', run(async () => {
      const copies = [];
      for (const f of safeFiles) { let file = null; try { file = JSON.parse(await safeText(f)); } catch (e) { /* skip */ } copies.push({day: f.day, file}); }
      fileOut(`${SAFE_BASE} all ${today()}.json`, JSON.stringify({app: 'wheres-my-money-lite', kind: 'safety copies', copies}));
    }));
  }
  function driveShow(connected) {
    const set = (id, hide) => { const el = document.getElementById(id); if (el) el.hidden = hide; };
    set('driveconnect', connected); set('drivesave', !connected); set('driveload', !connected);
    set('driveauto', !connected); set('driveoff', !connected); set('drivedl', !connected);
    set('drivemore', !connected); set('safebox', !connected);
    if (connected) safeShow();
    const last = document.getElementById('drivelast'), at = lsGet(DRIVE_LAST);
    if (last) last.textContent = at ? 'last saved ' + localTime(at) : 'saves a minute after a change';
    driveSign();
    pairBox();
  }
  function localTime(iso) {                                       // v0.40: UK time (BST or GMT), not the UTC in the string
    const d = new Date(iso), z = n => String(n).padStart(2, '0');
    if (isNaN(d)) return '';
    return M.fmt.day(`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  // v0.40 the save sign after 'Lite' (mock A), only when Drive is on: saved = tick, saving = arrow up, wait = amber dot
  const SIGN = {saved: 'Saved to Google Drive · tap to save now', saving: 'Saving to Google Drive',
                wait: 'A change not sent to Google Drive yet · tap to save now'};
  function driveSign(st) {
    const el = document.querySelector('.savesign');
    if (!el) return;
    if (!lsGet(DRIVE_ON)) { el.hidden = true; return; }
    if (driveBusy && !st) st = 'saving';
    st = st || (lsGet(DRIVE_DIRTY) ? 'wait' : 'saved');
    if (st === 'saved' && el.classList.contains('saved') && !el.hidden) return;   // let a pop finish
    el.className = 'savesign ' + st;                               // 'saved pop' = the tick draws in with a tiny pop
    el.setAttribute('aria-label', SIGN[st.split(' ')[0]]);
    el.title = SIGN[st.split(' ')[0]];
    el.hidden = false;
  }
  // v0.48 tap the cloud = save to Drive now (no token = the quiet reconnect first; the tap lets Google open)
  function driveTap(e) {
    e.preventDefault(); e.stopPropagation();                       // not the 'back to the top' link around it
    if (!lsGet(DRIVE_ON) || driveBusy) return;
    driveSign('saving');
    (getToken() ? Promise.resolve() : loadGsi().then(() => getToken() || driveConnect(true)))
      .then(() => driveSave(false)).then(() => driveShow(!!getToken()))
      .catch(err => { driveSign(); root.Sheet.tell('😕 Not saved', (err && err.message) || 'Something went wrong. Try again.'); });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.querySelector('.savesign');
    if (!el) return;
    el.addEventListener('click', driveTap);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') driveTap(e); });
  });
  // v0.43 👤 Account (mock B): the menu line, and ?view=account = your first name + which Google account
  const nameApi = () => root.LiteName || {get: () => '', set: n => n};
  function accMenu() {
    const sub = document.querySelector('#acclink .sub');
    if (!sub) return;
    const parts = [nameApi().get(), lsGet(DRIVE_ON) && lsGet(DRIVE_EMAIL)].filter(Boolean);
    sub.textContent = parts.length ? parts.join(' · ') : 'Add your name';
  }
  function accShow() {
    const st = document.getElementById('accstate');
    if (!st) return;
    const on = !!lsGet(DRIVE_ON), email = lsGet(DRIVE_EMAIL);
    st.innerHTML = on ? '<span class="on">● On</span>' : 'Off';
    if (on && email) st.append(' · ' + email);
    document.getElementById('acchint').hidden = !on;
    document.getElementById('accon').hidden = !on || !clientId();
    document.getElementById('accconnect').hidden = on || !clientId();
    // v0.61 🛂 the Google account is the passport's: another one = Sign out in Passport
    const pp = !!(root.LockUI && root.LockUI.cloud && root.LockUI.cloud());
    document.getElementById('accswitch').hidden = pp;
    document.getElementById('acchint').textContent = pp ? "Backups go to your passport's Google account. Another account: Settings → 🛂 Passport → Sign out."
      : 'Backups go to this Google account.';
    accMenu(); driveMenu();
  }
  function accStart() {
    const box = document.getElementById('account');
    if (!box || new URLSearchParams(location.search).get('view') !== 'account') return;
    const input = document.getElementById('accname'), ok = document.getElementById('nameok'), err = document.getElementById('accerr');
    input.value = nameApi().get();
    document.getElementById('nameform').addEventListener('submit', e => {
      e.preventDefault();
      input.value = nameApi().set(input.value);
      ok.hidden = false; accMenu();
    });
    input.addEventListener('input', () => { ok.hidden = true; });
    accShow();
    document.getElementById('accoff').addEventListener('click', () => {
      lsSet(DRIVE_ON, null); lsSet(DRIVE_EMAIL, null); setToken(''); accShow(); driveSign();
    });
    document.getElementById('accswitch').addEventListener('click', async () => {
      err.hidden = true;
      try {
        await loadGsi();
        const was = lsGet(DRIVE_EMAIL);
        lsSet(DRIVE_EMAIL, null);
        try { await driveConnect(false, true); } catch (e) { if (was && !lsGet(DRIVE_EMAIL)) lsSet(DRIVE_EMAIL, was); throw e; }
        if (lsGet(DRIVE_EMAIL) !== was) {                        // a new account: its own folder and files, sent soon
          lsSet(DRIVE_ID, null); lsSet(dirKey(), null);
          lsSet(DRIVE_DIRTY, String(Date.now())); driveSign(); driveSoon();
        }
        accShow();
      } catch (e) { err.textContent = (e && e.message) || 'Something went wrong. Try again.'; err.hidden = false; }
    });
  }
  // v0.42 the Settings line under Google Drive: On + the Gmail, or Off
  function driveMenu() {
    const sub = document.querySelector('#drivelink .sub');
    if (!sub) return;
    const email = lsGet(DRIVE_EMAIL);
    if (!lsGet(DRIVE_ON)) { sub.textContent = 'Off · tap to connect'; return; }
    sub.innerHTML = '<span class="on">● On</span>';
    if (email) { const m = document.createElement('span'); m.className = 'mail'; m.textContent = email; sub.append(m); }   // v0.52: own line
  }
  // v0.40: send 1 minute after the last change (a PC window side by side is never hidden)
  let driveTimer = 0;
  function driveSoon() {
    clearTimeout(driveTimer);
    const at = Number(lsGet(DRIVE_DIRTY));
    if (!at || !lsGet(DRIVE_ON) || !getToken()) return;
    const wait = root.LITE_DRIVE_WAIT || (syncOn() ? 5000 : 60000);   // tests make it short; in step = 5 s
    driveTimer = setTimeout(() => driveAuto(false), Math.max(0, at + wait - Date.now()));
  }
  function driveAuto(hidden) {
    if (!lsGet(DRIVE_ON) || !lsGet(DRIVE_DIRTY) || !getToken() || lsGet(RESTORE) === 'need') return;
    driveSave(hidden).catch(() => { /* offline: it stays changed, the next visit sends it */ });
  }
  function driveStart() {
    const box = document.getElementById('drive'), id = clientId();
    if (!box || new URLSearchParams(location.search).get('view') !== 'drive') return;
    const set = document.getElementById('driveset'), none = document.getElementById('drivenone');
    if (!id) { set.remove(); none.hidden = false; return; }   // no client id: no buttons at all
    set.hidden = false;
    driveShow(!!getToken());
    const ok = document.getElementById('driveok'), err = document.getElementById('driveerr');
    const fail = e => { ok.hidden = true; err.textContent = (e && e.message) || 'Something went wrong. Try again.'; err.hidden = false; };
    const run = fn => async () => { ok.hidden = true; err.hidden = true; try { await fn(); } catch (e) { fail(e); } };
    document.getElementById('driveconnect').addEventListener('click', run(async () => {
      await loadGsi();
      await driveConnect(false);
      driveShow(true);
    }));
    document.getElementById('drivesave').addEventListener('click', run(async () => { await driveSave(false); ok.textContent = '✅ Saved to your Drive.'; ok.hidden = false; driveShow(true); }));
    document.getElementById('drivedl').addEventListener('click', run(async () => { const n = await driveDownload(); ok.textContent = '✅ Downloaded: ' + n; ok.hidden = false; }));
    pairStart(run);
    safeStart(run);
    document.getElementById('driveload').addEventListener('click', run(driveLoad));
    document.getElementById('driveoff').addEventListener('click', () => { lsSet(DRIVE_ON, null); lsSet(DRIVE_EMAIL, null); setToken(''); driveShow(false); driveMenu(); accMenu(); });
  }
  // the quiet reconnect: the first tap of a visit (a popup needs a tap), when Drive was connected before
  function driveWake() {
    if (!lsGet(DRIVE_ON) || !clientId()) return;
    loadGsi().catch(() => {});                                     // ready before the tap
    let tried = 0;
    const once = () => {
      if (!syncOn()) document.removeEventListener('pointerdown', once, true);   // in step: a long-open PC asks again
      if (getToken() || Date.now() - tried < 60000 || !(root.google && root.google.accounts && root.google.accounts.oauth2)) return;
      tried = Date.now();
      driveConnect(true).then(() => (syncOn() ? syncCheck() : driveAuto(false)))   // v0.40: a change not sent last time goes now
        .then(() => jobsRun())                                     // v0.60: then Orbit's jobs
        .then(() => devCheck())                                    // v0.64: then the Main / linked devices
        .catch(() => { /* blocked or closed: try again next visit */ });
    };
    document.addEventListener('pointerdown', once, true);
  }
  // ---------- v0.45 🔁 keep my devices in step (TEST: only after ?beta=sync, Darren 25 Oct) ----------
  // The phone and the PC follow the newest copy in the same Google Drive. A change goes in ~5 s; an open app looks every
  // 30 s and when it comes back into view, and loads a newer copy by itself (↩️ Undo). Changes on both = ask. A device
  // with another lock links once with the other device's passcode (then both use the same passcode and backup codes).
  const BETA = 'lite_sync_beta', DRIVE_SYNC = DK('sync'), DRIVE_SYNCED = DK('synced'), DRIVE_UNDO = DK('undo');
  try {
    const b = new URLSearchParams(location.search).get('beta');
    if (b === 'sync') lsSet(BETA, '1'); else if (b === 'off') lsSet(BETA, null);
  } catch (e) { /* ignore */ }
  const syncOn = () => !!(lsGet(BETA) && lsGet(DRIVE_SYNC) && lsGet(DRIVE_ON));
  const stampOf = f => (f ? f.id + '@' + f.modifiedTime : '');     // which copy: changes with every save
  const bare = st => { const c = Object.assign({}, st); delete c.lastBackup; return JSON.stringify(c); };
  let syncBusy = false, syncLater = false, linkAsked = false;
  async function driveOpen(text) {                                 // the state in a Drive copy, or null
    let obj = null;
    try { obj = JSON.parse(text); } catch (e) { return null; }
    if (obj && obj.scrambled) {
      const rec = root.LockUI && root.LockUI.record();
      let st = rec ? await root.Lock.openWith(rec, obj.scrambled) : null;
      if (!st) st = await syncLink(obj.scrambled);
      if (!st) return null;
      obj = {app: obj.app, saved: obj.saved, state: st};
    }
    return M.importBackup(obj);
  }
  async function syncLink(sealed) {                                // another device's key: its passcode, asked once
    if (linkAsked || !root.LockUI || !root.LockUI.adopt) return null;
    linkAsked = true;
    const secret = await root.Sheet.ask('🔗 Open your other device\'s copy', 'Your passport passcode', '', 'numeric');
    if (secret === null) { syncLater = true; return null; }
    const o = await root.Lock.adopt(sealed, secret);
    if (!o) { await root.Sheet.tell("😕 That didn't open", 'Check the passcode and try again later.'); syncLater = true; return null; }
    root.LockUI.adopt(o);
    await root.Sheet.tell('🔗 Linked', 'This device can open your other device\'s copies now.');
    return o.state;
  }
  function syncBlocked() {                                         // like v3: never reload while typing, opened or moved
    const a = document.activeElement, open = id => { const el = document.getElementById(id); return el && !el.hidden; };
    return document.documentElement.classList.contains('lockon') || document.body.classList.contains('editing') ||
      !!document.querySelector('.litesheet, .bmenu') || open('setmenu') || open('quick') || open('newmonth') ||
      !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox');
  }
  function syncUse(theirs, st) {                                   // load the other device's copy (the old one kept for Undo)
    lsSet(DRIVE_UNDO, JSON.stringify(state));
    state = theirs; Store.save(theirs);
    lsSet(DRIVE_SYNCED, st); lsSet(DRIVE_DIRTY, null);
    try { root.sessionStorage.setItem('lite_synced', '1'); } catch (e) { /* ignore */ }
    leave();
  }
  async function syncCheck(first) {
    if (!syncOn() || !getToken() || syncBusy || driveBusy || (syncLater && !first)) return;
    if (!first && syncBlocked()) return;
    syncBusy = true;
    let after = null;
    try {
      const f = (await driveList())[0], st = stampOf(f);
      if (!f) { lsSet(DRIVE_DIRTY, lsGet(DRIVE_DIRTY) || String(Date.now())); after = () => driveSave(false); return; }
      if (st === lsGet(DRIVE_SYNCED)) { driveSoon(); return; }
      const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
      if (!r.ok) return;
      const theirs = await driveOpen(await r.text());
      if (!theirs) { if (first) { lsSet(DRIVE_SYNC, null); pairBox(); } return; }
      if (bare(theirs) === bare(state)) { lsSet(DRIVE_SYNCED, st); driveSoon(); return; }
      if (first || lsGet(DRIVE_DIRTY)) {
        const pick = first
          ? await root.Sheet.choose('🔁 Which copy do you want to start with?', 'The copy in Google Drive is different from this device.',
                                    '☁️ The copy in Drive', '📱 This device')
          : await root.Sheet.choose('🔁 Changes on both devices', 'Your other device saved changes while this one had changes not sent yet. Which copy do you want to keep?',
                                    "☁️ Use the other device's copy", "📱 Keep this device's copy");
        if (pick === null) { syncLater = true; if (first) { lsSet(DRIVE_SYNC, null); pairBox(); } return; }
        if (pick === 'b') { lsSet(DRIVE_SYNCED, st); lsSet(DRIVE_DIRTY, String(Date.now())); driveSign(); after = () => driveSave(false); return; }
      }
      syncUse(theirs, st);
    } catch (e) { /* offline or signed out: try again later */ }
    finally {
      syncBusy = false;
      if (after) after().catch(() => {});
    }
  }
  function syncToast() {                                           // after a copy from the other device: ↩️ Undo
    let shown = false;
    try { shown = root.sessionStorage.getItem('lite_synced'); root.sessionStorage.removeItem('lite_synced'); } catch (e) { /* ignore */ }
    if (!shown) return;
    const t = document.createElement('div');
    t.className = 'synctoast'; t.setAttribute('role', 'status');
    const said = shown === 'load' ? '📂 Backup loaded' : shown === 'main' ? '🔁 Updated from your ' + devMainName()
      : shown === 'linked' ? '🔗 Linked · money copied from your ' + devMainName()
      : /^approved:/.test(shown) ? '✅ Added ' + shown.split(':')[1] + ' change' + (shown.split(':')[1] === '1' ? '' : 's') + ' from your other device'
      : '🔁 Updated from your other device';
    t.innerHTML = '<span></span>' + (lsGet(DRIVE_UNDO) && !/^(main|approved)/.test(shown) ? '<button type="button" class="syncundo">↩️ Undo</button>' : '');
    t.querySelector('span').textContent = said;
    document.body.appendChild(t);
    const gone = setTimeout(() => t.remove(), 10000);
    const u = t.querySelector('.syncundo');
    if (u) u.addEventListener('click', () => {
      clearTimeout(gone);
      let old = null;
      try { old = M.importBackup({app: 'wheres-my-money-lite', state: JSON.parse(lsGet(DRIVE_UNDO))}); } catch (e) { /* gone */ }
      if (!old) { t.remove(); return; }
      state = old; Store.save(old); lsSet(DRIVE_UNDO, null);
      lsSet(DRIVE_DIRTY, String(Date.now()));                        // it goes back to Drive too
      leave();
    });
  }
  function syncTurnOn() {                                          // 'which copy to start with?' if they differ
    lsSet(DRIVE_SYNC, '1'); syncLater = false;
    return (getToken() ? Promise.resolve() : loadGsi().then(() => driveConnect(true)))
      .then(() => syncCheck(true), () => { lsSet(DRIVE_SYNC, null); pairBox(); });
  }
  function syncTurnOff() { lsSet(DRIVE_SYNC, null); lsSet(DRIVE_SYNCED, null); lsSet(DRIVE_PAIRED, null); pairBox(); }
  root.LiteSync = {on: syncTurnOn, off: syncTurnOff};              // (tests turn it on without pairing)

  // ---------- v0.64 ⚠️ never write over another device's save without asking (Darren, 4 Nov: the PC wrote over the phone) ----------
  // DRIVE_SYNCED = the Drive copy this device last sent or loaded. A different newest copy = another device saved since.
  async function safeKeep(id) {                                    // that copy goes in Safety copies before it is written over
    try {
      const dir = await safeFolder().catch(() => null);
      await driveFetch(`${DRIVE_API}/${encodeURIComponent(id)}/copy?fields=id`, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.assign({name: `${SAFE_BASE} other device ${today()}.json`}, dir ? {parents: [dir]} : {}))});
    } catch (e) { /* the daily copy is still there */ }
  }
  async function guardNewer(hidden) {
    const f = (await driveList())[0];
    if (!f) return;
    const st = stampOf(f);
    if (st === lsGet(DRIVE_SYNCED)) return;
    const stop = () => { throw new Error('Another device saved to Google Drive since this one. Nothing was written over it.'); };
    if (hidden || syncBlocked()) stop();                           // never ask while the app closes or the person is typing
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
    if (!r.ok) stop();
    const theirs = await driveOpen(await r.text());
    if (!theirs) stop();
    if (bare(theirs) === bare(state)) { lsSet(DRIVE_SYNCED, st); return; }
    const spare = s => M.fmt.money(M.monthEndSpare(s));
    const pick = await root.Sheet.choose('⚠️ Another device saved too',
      'Your Google Drive copy was changed by another device since this one last saved. Which money do you want to keep? The other one goes in Safety copies.',
      `☁️ The Drive copy · ${spare(theirs)} spare`, `📱 This device's · ${spare(state)} spare`);
    if (pick === null) stop();
    if (pick === 'a') { syncUse(theirs, st); throw new Error('Loading the Drive copy…'); }
    await safeKeep(f.id);
    lsSet(DRIVE_SYNCED, st);
  }

  // ---------- v0.64 📱 Your devices: one Main, others linked (mock https://claude.ai/artifact/5jrk4Euv1xNFioJpeZaWjD) ----------
  // The Main holds the real money and is the only device that writes the Drive copy. A linked device copies it; its own
  // changes show on it straight away and go to Drive as request files. The Main lists them with tick boxes; the ticked
  // ones are done on the Main, saved, then the request files go. The linked device then copies the Main again.
  const DEV_FILE = demo ? 'wmm-lite-demo-devices.json' : 'wmm-lite-devices.json';
  const INV_FILE = demo ? 'wmm-lite-demo-invite.json' : 'wmm-lite-invite.json';
  const REQ_PREFIX = demo ? 'wmm-lite-demo-req-' : 'wmm-lite-req-';
  const DEV_ID = DK('devid'), DEV_ROLE = DK('role'), DEV_MAIN = DK('mainname'), DEV_OUT = DK('outbox'), DEV_LIST = DK('devices'), DEV_DONE = DK('reqdone');
  function devId() {
    let id = lsGet(DEV_ID);
    if (!id) { const a = new Uint32Array(2); root.crypto.getRandomValues(a); id = a[0].toString(36) + a[1].toString(36); lsSet(DEV_ID, id); }
    return id;
  }
  function devRole() { return lsGet(DRIVE_ON) ? lsGet(DEV_ROLE) : null; }   // 'main' | 'linked' | null
  const devMainName = () => lsGet(DEV_MAIN) || 'Main';
  const jsonLs = (k, d) => { try { const v = JSON.parse(lsGet(k)); return v === null ? d : v; } catch (e) { return d; } };
  async function noteGet(name) {                                   // {id, obj} or null
    const q = encodeURIComponent(`name='${qEsc(name)}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`);
    if (!r.ok) throw new Error('Could not look in your Google Drive (error ' + r.status + ').');
    const f = ((await r.json()).files || []).find(x => x.name === name);
    if (!f) return null;
    const t = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
    try { return t.ok ? {id: f.id, obj: JSON.parse(await t.text())} : null; } catch (e) { return null; }
  }
  async function notePut(name, obj, id) {
    const folder = id ? null : await driveFolder();
    const b = 'wmm' + Date.now(), meta = id ? {name} : Object.assign({name, mimeType: 'application/json'}, folder ? {parents: [folder]} : {});
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
                 `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n--${b}--`;
    const r = await driveFetch(`${DRIVE_UP}${id ? '/' + encodeURIComponent(id) : ''}?uploadType=multipart&fields=id`,
      {method: id ? 'PATCH' : 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b}, body});
    if (!r.ok) throw new Error('Google Drive would not take it (error ' + r.status + ').');
    return ((await r.json().catch(() => ({}))).id) || id;
  }
  const fileGone = id => driveFetch(`${DRIVE_API}/${encodeURIComponent(id)}`, {method: 'DELETE'}).catch(() => {});
  async function devNote() {                                        // the devices note {v, main, devices:[{id,name,at}]} (+ its file id)
    const n = await noteGet(DEV_FILE);
    const obj = n && n.obj && typeof n.obj === 'object' ? n.obj : {v: 1, main: null, devices: []};
    if (!Array.isArray(obj.devices)) obj.devices = [];
    lsSet(DEV_LIST, JSON.stringify(obj));
    return {id: n && n.id, obj};
  }
  const devAdd = (obj, name) => {
    obj.devices = obj.devices.filter(d => d.id !== devId());
    obj.devices.push({id: devId(), name: String(name || deviceName()).slice(0, 40), at: new Date().toISOString()});
  };

  // what a change says in the Main's list (worked out before the change, so a removed spend still has its name)
  function changeLabel(path, get, s) {
    const gbp = v => M.fmt.money(parseFloat(String(v).replace(/[£,]/g, '')) || 0);
    const bill = () => ((s.bills || []).find(b => b.key === get('key')) || {}).name || 'a bill';
    const pot = () => ((s.pots || []).find(p => p.key === get('key')) || {}).name || 'a pot';
    const spend = () => ((s.spends || []).find(x => String(x.id) === String(get('id'))) || {}).name || 'a spend';
    const L = {
      '/add': () => (get('upcoming') === '1' ? 'Upcoming spend · ' : 'Spend · ') + (get('name') || 'Spend') + ' ' + gbp(get('amount')),
      '/remove': () => 'Removed spend · ' + spend(),
      '/spend/paid': () => 'Spend paid · ' + spend(),
      '/spend/date': () => 'Spend date · ' + spend(),
      '/spend/cat': () => 'Spend category · ' + spend() + ' → ' + get('cat'),
      '/spend/amount': () => 'Spend amount · ' + spend() + ' → ' + gbp(get('amount')),
      '/spend/name': () => 'Spend name · ' + spend() + ' → ' + get('name'),
      '/pay': () => 'Pay → ' + gbp(get('pay')),
      '/left': () => 'Left from last month → ' + gbp(get('amount')),
      '/payday': () => 'New month · pay ' + gbp(get('pay')) + ', left ' + gbp(get('left')),
      '/payday/day': () => 'Payday → ' + get('day'),
      '/bill': () => 'Bill amount · ' + bill() + ' → ' + gbp(get('amount')),
      '/bill/add': () => 'New bill · ' + (get('name') || 'Bill') + ' ' + gbp(get('amount')),
      '/bill/paid': () => (get('paid') === '1' ? 'Marked paid · ' : 'Not paid yet · ') + bill(),
      '/bills/paid': () => 'Marked bills paid',
      '/bill/name': () => 'Bill name · ' + bill() + ' → ' + get('name'),
      '/bill/due': () => 'Bill due day · ' + bill() + ' → ' + get('day'),
      '/bill/cat': () => 'Bill category · ' + bill() + ' → ' + get('cat'),
      '/bill/delete': () => 'Deleted bill · ' + bill(),
      '/stopped': () => (get('stopped') === '1' ? 'Paused · ' : 'Resumed · ') + bill(),
      '/pot/add': () => 'New pot · ' + (get('name') || 'Pot') + ' ' + gbp(get('amount')),
      '/pot/amount': () => 'Pot amount · ' + pot() + ' → ' + gbp(get('amount')),
      '/pot/delete': () => 'Deleted pot · ' + pot(),
      '/card/add': () => (get('paid') === '1' ? 'Card paid off · ' : 'Card spend · ') + (get('name') || '') + ' ' + gbp(get('amount')),
      '/card/remove': () => 'Removed a card line',
      '/card/balance': () => 'Card used → ' + gbp(get('amount')),
      '/card/limit': () => 'Card limit → ' + gbp(get('amount')),
    };
    try { return (L[path] ? L[path]() : 'Changed · ' + path.replace(/^\//, '').replace(/\//g, ' ')).slice(0, 120); }
    catch (e) { return 'Changed · ' + path; }
  }
  const SAME_THING = ['/bill', '/pay', '/left', '/payday/day', '/layout', '/spend/amount', '/pot/amount', '/card/limit', '/card/balance'];
  function fieldsOf(data) {
    const o = {};
    if (data && typeof data.entries === 'function') { for (const [k, v] of data.entries()) if (typeof v === 'string') o[k] = v; }
    else if (data && data.obj && typeof data.obj === 'object') Object.assign(o, data.obj);
    return o;
  }
  // a linked device: the change is kept to send (typing a bill amount = one change, not one per key)
  function outAdd(path, data, label) {
    const out = jsonLs(DEV_OUT, []), fields = fieldsOf(data), who = f => f.key || f.id || f.card || '';
    const last = out[out.length - 1];
    const item = {n: Date.now() + '-' + Math.random().toString(36).slice(2, 6), path, fields, label, at: new Date().toISOString(), sent: null};
    if (last && !last.sent && last.path === path && SAME_THING.indexOf(path) >= 0 && who(last.fields) === who(fields)) out[out.length - 1] = item;
    else out.push(item);
    lsSet(DEV_OUT, JSON.stringify(out));
  }
  let outBusy = false;
  async function outSend() {                                        // what is not sent yet goes as one request file
    if (outBusy || !getToken()) return;
    const out = jsonLs(DEV_OUT, []), fresh = out.filter(x => !x.sent);
    if (!fresh.length) return;
    outBusy = true;
    try {
      const name = `${REQ_PREFIX}${devId()}-${Date.now()}.json`;
      await notePut(name, {v: 1, devid: devId(), from: deviceName(), at: new Date().toISOString(),
                           changes: fresh.map(x => ({n: x.n, path: x.path, fields: x.fields, label: x.label, at: x.at}))});
      const now = jsonLs(DEV_OUT, []);
      now.forEach(x => { if (fresh.some(y => y.n === x.n)) x.sent = name; });
      lsSet(DEV_OUT, JSON.stringify(now));
    } finally { outBusy = false; }
  }
  let outTimer = 0;
  function outSoon() { clearTimeout(outTimer); outTimer = setTimeout(() => { outSend().then(devBand, devBand); }, root.LITE_DRIVE_WAIT || 5000); devBand(); }
  async function reqList(mine) {                                    // request files (only this device's, or every device's)
    const q = encodeURIComponent(`name contains '${REQ_PREFIX}${mine ? devId() + '-' : ''}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`);
    if (!r.ok) throw new Error('Could not look in your Google Drive (error ' + r.status + ').');
    return ((await r.json()).files || []).filter(f => f.name && f.name.indexOf(REQ_PREFIX + (mine ? devId() + '-' : '')) === 0)
      .sort((a, b) => (a.name < b.name ? -1 : 1));
  }
  function devBand() {                                             // linked: '⏳ 2 changes waiting for your Main'
    let el = document.getElementById('devwait');
    const out = devRole() === 'linked' ? jsonLs(DEV_OUT, []) : [];
    if (!out.length) { if (el) el.remove(); return; }
    if (!el) {
      const cards = document.getElementById('cards');
      if (!cards) return;
      el = document.createElement('p'); el.id = 'devwait'; el.className = 'devwait'; el.setAttribute('role', 'status');
      cards.parentNode.insertBefore(el, cards);
    }
    const n = out.length, sent = out.every(x => x.sent), s = n === 1 ? '' : 's';
    el.textContent = sent ? `⏳ ${n} change${s} waiting for your ${devMainName()} to say yes` : `⏳ ${n} change${s} not sent yet · they go when you're online`;
  }
  let devBusy = false, reqLater = false;
  async function devCheck() {
    const role = devRole();
    if (!role || devBusy || leaving || !getToken()) return;
    const html = document.documentElement;
    if (html.classList.contains('lockon')) {                       // after the unlock, like Orbit's jobs
      const mo = new MutationObserver(() => { if (!html.classList.contains('lockon')) { mo.disconnect(); devCheck(); } });
      mo.observe(html, {attributes: true, attributeFilter: ['class']});
      return;
    }
    devBusy = true;
    try {
      const note = (await devNote()).obj;
      if (role === 'linked') await linkedCheck(note);
      else if (role === 'main') await mainCheck(note);
    } catch (e) { /* offline: next time */ }
    finally { devBusy = false; devMenu(); }
  }
  async function linkedCheck(note) {
    const me = note.devices.find(d => d.id === devId());
    if (note.main === devId()) { lsSet(DEV_ROLE, 'main'); return; }
    if (!me || !note.main) {                                       // the Main took this device off the list
      lsSet(DEV_ROLE, null); lsSet(DEV_OUT, null); devBand();
      root.Sheet.tell('🔗 Not linked any more', 'This device is not linked to your Main now. Its money stays as it is.');
      return;
    }
    const main = note.devices.find(d => d.id === note.main);
    if (main) lsSet(DEV_MAIN, main.name);
    await outSend();
    const live = (await reqList(true)).map(f => f.name);
    const out = jsonLs(DEV_OUT, []).filter(x => !x.sent || live.indexOf(x.sent) >= 0);   // gone from Drive = the Main has done it
    lsSet(DEV_OUT, out.length ? JSON.stringify(out) : null);
    devBand();
    if (out.length) return;                                        // still waiting: keep showing this device's changes
    const f = (await driveList())[0], st = stampOf(f);
    if (!f || st === lsGet(DRIVE_SYNCED) || syncBlocked()) return;
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
    if (!r.ok) return;
    const theirs = await driveOpen(await r.text());
    if (!theirs) return;
    if (bare(theirs) === bare(state)) { lsSet(DRIVE_SYNCED, st); return; }
    lsSet(DRIVE_UNDO, null);                                       // the Main's money is the real one: no Undo here
    state = theirs; Store.save(theirs);
    lsSet(DRIVE_SYNCED, st); lsSet(DRIVE_DIRTY, null);
    try { root.sessionStorage.setItem('lite_synced', 'main'); } catch (e) { /* ignore */ }
    leave();
  }
  async function mainCheck(note) {
    if (note.main && note.main !== devId()) {                      // another device was made the Main
      lsSet(DEV_ROLE, 'linked');
      const main = note.devices.find(d => d.id === note.main);
      if (main) lsSet(DEV_MAIN, main.name);
      return;
    }
    if (reqLater) return;
    if (syncBlocked()) { setTimeout(devCheck, 5000); return; }
    const done = jsonLs(DEV_DONE, []);
    const files = await reqList(false);
    for (const f of files.filter(x => done.indexOf(x.name) >= 0)) await fileGone(f.id);   // done before, the delete was cut off
    const asks = [];
    for (const f of files.filter(x => done.indexOf(x.name) < 0)) {
      const t = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
      let obj = null;
      try { obj = t.ok ? JSON.parse(await t.text()) : null; } catch (e) { obj = null; }
      if (!obj || !Array.isArray(obj.changes)) { await fileGone(f.id); continue; }
      obj.changes.forEach(c => { if (c && ROUTES[c.path]) asks.push({file: f, from: String(obj.from || 'other device').slice(0, 40), c}); });
      if (!obj.changes.length) await fileGone(f.id);
    }
    if (!asks.length) { files.forEach(f => { if (done.indexOf(f.name) < 0 && !asks.some(a => a.file.id === f.id)) fileGone(f.id); }); return; }
    const ticked = await approveSheet(asks);
    if (ticked === null) { reqLater = true; return; }
    let n = 0;
    asks.forEach((a, i) => {
      if (ticked.indexOf(i) < 0) return;
      const f = a.c.fields || {};
      try { if (!ROUTES[a.c.path](state, getter({get: k => f[k]}))) n++; } catch (e) { /* skip a change that no longer fits */ }
    });
    const names = [...new Set(asks.map(a => a.file.name))];
    lsSet(DEV_DONE, JSON.stringify(done.concat(names).slice(-200)));
    Store.save(state); lsSet(DRIVE_DIRTY, String(Date.now()));
    try { await driveSave(false); } catch (e) { /* saved here; Drive next time */ }
    for (const id of [...new Set(asks.map(a => a.file.id))]) await fileGone(id);   // after the save: the other device then copies it
    try { root.sessionStorage.setItem('lite_synced', 'approved:' + n); } catch (e) { /* ignore */ }
    leave();
  }
  // the list with tick boxes (mock 4); resolves to the ticked indexes, or null for Not now
  function approveSheet(asks) {
    return new Promise(resolve => {
      document.getElementById('approve')?.remove();
      const froms = [...new Set(asks.map(a => a.from))], who = froms.length === 1 ? froms[0] : 'other devices';
      const back = document.createElement('div');
      back.id = 'approve'; back.className = 'sheetback litesheet';
      back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="aptitle"><div class="grab"></div>
        <h3 id="aptitle"></h3><p>Nothing counts until you say yes. Unticked ones are dropped.</p><div class="aplist"></div>
        <button type="button" class="pri" id="apyes"></button><button type="button" class="ter" id="apno">Not now</button></div>`;
      back.querySelector('#aptitle').textContent = `📲 Your ${who} made ${asks.length} change${asks.length === 1 ? '' : 's'}`;
      const list = back.querySelector('.aplist'), yes = back.querySelector('#apyes');
      const count = () => { const n = list.querySelectorAll('input:checked').length; yes.textContent = n ? `✅ Add ticked (${n})` : '✅ Drop them all'; };
      asks.forEach((a, i) => {
        const row = document.createElement('label'); row.className = 'aprow';
        const box = document.createElement('input'); box.type = 'checkbox'; box.checked = true; box.value = String(i);
        const txt = document.createElement('span'); txt.textContent = a.c.label || a.c.path;
        if (froms.length > 1) { const sub = document.createElement('small'); sub.textContent = a.from; txt.appendChild(sub); }
        row.append(box, txt); list.appendChild(row);
        box.addEventListener('change', count);
      });
      count();
      const close = v => { back.remove(); resolve(v); };
      yes.addEventListener('click', () => close([...list.querySelectorAll('input:checked')].map(b => Number(b.value))));
      back.querySelector('#apno').addEventListener('click', () => close(null));
      document.body.appendChild(back);
      yes.focus();
    });
  }

  // making the Main, inviting, joining (?view=devices)
  async function devMakeMain() {
    await driveReady();
    const {id, obj} = await devNote();
    const was = obj.main && obj.main !== devId() ? (obj.devices.find(d => d.id === obj.main) || {}).name || 'other device' : '';
    if (!await root.Sheet.confirm('⭐ Make this device the Main?',
      (was ? `Your ${was} is the Main now. ` : '') + "This device's money becomes the real money in Google Drive. Other devices copy it. The Drive copy there now goes in Safety copies.",
      'Make it the Main')) return false;
    const f = (await driveList())[0];
    if (f && stampOf(f) !== lsGet(DRIVE_SYNCED)) await safeKeep(f.id);
    obj.main = devId(); devAdd(obj); await notePut(DEV_FILE, obj, id);
    lsSet(DEV_LIST, JSON.stringify(obj));
    lsSet(DEV_ROLE, 'main'); lsSet(DEV_MAIN, deviceName()); lsSet(DEV_OUT, null);
    lsSet(DRIVE_SYNCED, stampOf(f)); lsSet(DRIVE_DIRTY, String(Date.now()));
    await driveSave(false);
    return true;
  }
  let invNote = null, invTimer = 0;
  async function devInvite() {
    await driveReady();
    if (lsGet(DRIVE_DIRTY)) await driveSave(false);                // the other device copies the newest money
    const n = new Uint32Array(1); root.crypto.getRandomValues(n);
    const code = String(n[0] % 1000000).padStart(6, '0'), exp = Date.now() + PAIR_MINS * 60000;
    const old = await noteGet(INV_FILE).catch(() => null);
    const note = {code, exp, main: devId(), from: deviceName()};
    note.id = await notePut(INV_FILE, {code, exp, main: note.main, from: note.from}, old && old.id);
    invNote = note;
    const url = location.origin + location.pathname + '?join=' + code;
    try { const qr = (await loadQr())(0, 'M'); qr.addData(url); qr.make(); document.getElementById('devqr').innerHTML = qr.createSvgTag(5, 2); }
    catch (e) { document.getElementById('devqr').textContent = ''; }
    document.getElementById('devnum').textContent = code.slice(0, 3) + ' ' + code.slice(3);
    document.getElementById('devwaiting').textContent = '⏳ Waiting for your other device…';
    document.getElementById('devcode').hidden = false;
    document.getElementById('devinvite').hidden = true;
    invPoll(note);
  }
  function invClose() {
    clearTimeout(invTimer);
    const n = invNote; invNote = null;
    if (n) fileGone(n.id);
    document.getElementById('devcode').hidden = true;
    devView();
  }
  function invPoll(note) {
    invTimer = setTimeout(async () => {
      if (invNote !== note) return;
      let p = null;
      try { p = await noteGet(INV_FILE); } catch (e) { /* offline: look again */ }
      if (invNote !== note) return;
      if (p && p.obj && p.obj.code === note.code && p.obj.joined) {
        invNote = null; fileGone(p.id);
        document.getElementById('devcode').hidden = true;
        await devNote().catch(() => null);
        devView();
        root.Sheet.tell('✅ Linked', `Your ${String(p.obj.joined).slice(0, 40)} now copies this device. Its changes come here for you to say yes.`);
        return;
      }
      if (Date.now() > note.exp) { document.getElementById('devwaiting').textContent = '⌛ The code ran out. Tap Cancel and make a new one.'; return; }
      invPoll(note);
    }, root.LITE_PAIR_EVERY || 3000);
  }
  async function devJoin(code) {
    code = String(code || '').replace(/\D/g, '');
    if (code.length !== 6) throw new Error('Type the 6 numbers from your Main.');
    await driveReady();
    const p = await noteGet(INV_FILE);
    if (!p || !p.obj || p.obj.code !== code || p.obj.joined) throw new Error("That code didn't match. Check it on your Main and try again.");
    if (Date.now() > p.obj.exp) throw new Error('That code has run out. Make a new one on your Main.');
    if (p.obj.main === devId()) throw new Error('This device is the Main. Type the code on your other device.');
    const f = (await driveList())[0];
    if (!f) throw new Error('Your Main has not saved to Google Drive yet. Try again in a minute.');
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
    const theirs = r.ok ? await driveOpen(await r.text()) : null;
    if (!theirs) throw new Error("Could not open your Main's money. Try again.");
    const from = String(p.obj.from || 'Main').slice(0, 40);
    if (hadState && bare(theirs) !== bare(state)) {
      if (!await root.Sheet.confirm(`🔗 Copy your ${from}'s money?`,
        `This device will show the same money as your ${from}. The money here now is kept: tap ↩️ Undo after, or find it in this device's Settings → Load backup.`,
        'Copy and link')) return;
      try { fileOut('wmm-before-link ' + today() + '.json', JSON.stringify(await backupFile(), null, 1)); } catch (e) { /* the Undo still has it */ }
      lsSet(DRIVE_UNDO, JSON.stringify(state));
    }
    const {id, obj} = await devNote();
    obj.main = obj.main || p.obj.main;
    if (!obj.devices.some(d => d.id === p.obj.main)) obj.devices.push({id: p.obj.main, name: from, at: new Date().toISOString()});
    devAdd(obj); await notePut(DEV_FILE, obj, id);
    state = theirs; Store.save(theirs); hadState = true;
    lsSet(DEV_ROLE, 'linked'); lsSet(DEV_MAIN, from); lsSet(DEV_OUT, null); lsSet(DEV_LIST, JSON.stringify(obj));
    lsSet(DRIVE_SYNCED, stampOf(f)); lsSet(DRIVE_DIRTY, null); lsSet(DRIVE_ID, JSON.stringify({name: f.name, id: f.id}));
    await notePut(INV_FILE, Object.assign({}, p.obj, {joined: deviceName()}), p.id);
    try { root.sessionStorage.setItem('lite_synced', 'linked'); } catch (e) { /* ignore */ }
    const u = new URL(location.href); u.searchParams.delete('join'); history.replaceState(null, '', u.toString());
    leave();
  }
  async function devUnlink(otherId) {                               // the Main takes one off, or this device leaves
    await driveReady();
    const {id, obj} = await devNote();
    obj.devices = obj.devices.filter(d => d.id !== (otherId || devId()));
    await notePut(DEV_FILE, obj, id);
    lsSet(DEV_LIST, JSON.stringify(obj));
    if (!otherId) { lsSet(DEV_ROLE, null); lsSet(DEV_OUT, null); lsSet(DEV_MAIN, null); devBand(); }
    devView(); devMenu();
  }
  function devMenu() {                                             // the Settings line
    const sub = document.querySelector('#devlink .sub');
    if (!sub) return;
    const role = devRole();
    sub.textContent = role === 'main' ? '⭐ Main · this device' : role === 'linked' ? 'Linked to your ' + devMainName() : 'One Main, the others follow';
  }
  function devView() {                                             // ?view=devices
    const box = document.getElementById('devices');
    if (!box || box.hidden) return;
    const on = !!lsGet(DRIVE_ON) && !!clientId();
    document.getElementById('devnodrive').hidden = on;
    document.getElementById('devset').hidden = !on;
    if (!on) return;
    const role = devRole(), obj = jsonLs(DEV_LIST, {devices: []}), list = document.getElementById('devlist');
    list.textContent = '';
    const rows = (obj.devices || []).slice();
    if (!rows.some(d => d.id === devId())) rows.unshift({id: devId(), name: deviceName()});
    rows.sort((a, b) => (a.id === obj.main ? -1 : b.id === obj.main ? 1 : 0));
    rows.forEach(d => {
      const me = d.id === devId(), main = d.id === obj.main && (role || !me);
      const row = document.createElement('div'); row.className = 'devrow' + (main ? ' main' : '');
      const txt = document.createElement('span'), n = document.createElement('b'), sub = document.createElement('span');
      sub.className = 'sub'; n.textContent = d.name + (me ? ' (this device)' : '');
      sub.textContent = main ? 'Holds the real money' : me && role !== 'linked' ? 'Not linked' : 'Linked · copies the Main';
      txt.append(n, sub); row.append(txt);
      if (main) { const t = document.createElement('span'); t.className = 'devtag'; t.textContent = 'MAIN'; row.append(t); }
      else if (!me && role === 'main') {
        const x = document.createElement('button'); x.type = 'button'; x.className = 'small devremove'; x.textContent = 'Remove';
        x.addEventListener('click', async () => {
          if (await root.Sheet.confirm('Remove ' + d.name + '?', 'It stops copying this device. Its money stays as it is there.', 'Remove', true)) devRun(() => devUnlink(d.id))();
        });
        row.append(x);
      }
      list.append(row);
    });
    document.getElementById('devmain').hidden = role === 'main';
    document.getElementById('devmain').textContent = role === 'linked' ? '⭐ Make this device the Main instead' : '⭐ Make this device the Main';
    document.getElementById('devinvite').hidden = role !== 'main' || !document.getElementById('devcode').hidden;
    document.getElementById('devjoinform').hidden = role === 'main';
    document.getElementById('devleave').hidden = role !== 'linked';
  }
  let devRun = fn => fn;
  function devStart() {
    const box = document.getElementById('devices');
    if (!box) return;
    try {                                                           // the camera link ?join=CODE opens this page
      const u = new URL(location.href), c = u.searchParams.get('join');
      if (c && u.searchParams.get('view') !== 'devices') { u.searchParams.set('view', 'devices'); location.replace(u.toString()); return; }
      if (c) document.getElementById('devjoin').value = c;
    } catch (e) { /* ignore */ }
    if (new URLSearchParams(location.search).get('view') !== 'devices') return;
    const ok = document.getElementById('devok'), err = document.getElementById('deverr');
    devRun = fn => async () => {
      ok.hidden = true; err.hidden = true;
      try { const msg = await fn(); if (typeof msg === 'string') { ok.textContent = msg; ok.hidden = false; } }
      catch (e) { err.textContent = (e && e.message) || 'Something went wrong. Try again.'; err.hidden = false; }
      devView(); devMenu();
    };
    document.getElementById('devmain').addEventListener('click', devRun(async () => (await devMakeMain()) ? '⭐ This device is the Main now.' : null));
    document.getElementById('devinvite').addEventListener('click', devRun(devInvite));
    document.getElementById('devcancel').addEventListener('click', invClose);
    document.getElementById('devjoinform').addEventListener('submit', e => { e.preventDefault(); devRun(() => devJoin(document.getElementById('devjoin').value))(); });
    document.getElementById('devleave').addEventListener('click', async () => {
      if (await root.Sheet.confirm('Unlink this device?', 'It stops copying your Main. The money here stays as it is.', 'Unlink', true)) devRun(() => devUnlink(null))();
    });
    devView();
    if (getToken()) devNote().then(devView, () => {});
  }
  root.LiteDevices = {check: devCheck, role: devRole, id: devId};   // (tests)
  document.addEventListener('DOMContentLoaded', () => { devMenu(); devStart(); devBand(); setTimeout(devCheck, 400); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { reqLater = false; devCheck(); }
    else if (devRole() === 'linked' && !leaving) outSend().catch(() => {});
  });
  setInterval(() => { if (document.visibilityState === 'visible') devCheck(); }, root.LITE_SYNC_EVERY || 30000);

  // ---------- v0.55 🔗 pair a device (mock https://claude.ai/artifact/XvEVsgGDZzfsVTLCdSFroq) ----------
  // No server: the two devices meet in the same Google Drive. The device showing the code writes a pair note
  // {code, exp, from, copy} (copy = its backup, scrambled like the Drive copy; an unpaired device's auto-save may have
  // written over the month file meanwhile). The other device (camera link ?pair=CODE, or the code typed) checks it, picks
  // which money to keep (the sharing device's first), sends that to Drive, marks the note joined, and both stay in step.
  // TEST: ?beta=sync only.
  const DRIVE_PAIRED = DK('paired');
  const PAIR_MINS = 10;
  try {                                                            // the camera link opens the Drive tab
    const u = new URL(location.href);
    if (u.searchParams.get('pair') && u.searchParams.get('view') !== 'drive') { u.searchParams.set('view', 'drive'); location.replace(u.toString()); }
  } catch (e) { /* ignore */ }
  function deviceName() {
    const u = navigator.userAgent;
    return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android phone'
      : /Windows/.test(u) ? 'Windows PC' : /Mac/.test(u) ? 'Mac' : 'Computer';
  }
  const pairedList = () => { try { return JSON.parse(lsGet(DRIVE_PAIRED)) || []; } catch (e) { return []; } };
  function pairedAdd(name) {
    const l = pairedList().filter(p => p.name !== name);
    l.push({name: String(name || 'Other device').slice(0, 40), at: new Date().toISOString()});
    lsSet(DRIVE_PAIRED, JSON.stringify(l));
  }
  async function pairRead() {                                      // the pair note in Drive, or null
    const q = encodeURIComponent(`name='${PAIR_FILE}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`);
    const f = r.ok ? ((await r.json()).files || []).find(x => x.name === PAIR_FILE) : null;
    if (!f) return null;
    const t = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
    try { return t.ok ? Object.assign(JSON.parse(await t.text()), {id: f.id}) : null; } catch (e) { return null; }
  }
  async function pairWrite(note, id) {
    const folder = id ? null : await driveFolder();                // v0.61: in the app's folder
    const b = 'wmm' + Date.now(), meta = id ? {name: PAIR_FILE} : Object.assign({name: PAIR_FILE, mimeType: 'application/json'}, folder ? {parents: [folder]} : {});
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
                 `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(note)}\r\n--${b}--`;
    const r = await driveFetch(`${DRIVE_UP}${id ? '/' + encodeURIComponent(id) : ''}?uploadType=multipart&fields=id`,
      {method: id ? 'PATCH' : 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b}, body});
    if (!r.ok) throw new Error('Google Drive would not take the pair code (error ' + r.status + ').');
    return ((await r.json().catch(() => ({}))).id) || id;
  }
  const pairGone = id => (id ? driveFetch(`${DRIVE_API}/${encodeURIComponent(id)}`, {method: 'DELETE'}).catch(() => {}) : Promise.resolve());
  async function driveReady() {                                    // a token: quiet when connected before, else sign in
    await loadGsi();
    if (getToken()) return;
    if (lsGet(DRIVE_ON) && lsGet(DRIVE_EMAIL)) { try { await driveConnect(true); return; } catch (e) { /* ask */ } }
    await driveConnect(false);
  }
  function loadQr() {
    return new Promise((resolve, reject) => {
      if (root.qrcode) return resolve(root.qrcode);
      const s = document.createElement('script');
      s.src = 'qrcode.js'; s.onload = () => resolve(root.qrcode); s.onerror = () => reject(new Error('Could not make the QR code.'));
      document.head.appendChild(s);
    });
  }
  function pairBox() {                                             // the Paired devices card in ?view=drive
    const box = document.getElementById('pairbox');
    if (!box) return;
    const beta = !!lsGet(BETA), list = document.getElementById('pairlist');
    box.hidden = !lsGet(DRIVE_ON) || !beta;                        // v0.64: 📱 Your devices replaces it (beta testers keep it)
    box.classList.toggle('locked', !beta);                         // everyone sees it greyed out; ?beta=sync can use it
    document.getElementById('pairgo').disabled = !beta;
    document.getElementById('pairsoon').hidden = beta;
    document.getElementById('paircodeform').hidden = !beta;
    box.querySelector('.beta').textContent = beta ? 'TEST' : 'In development';
    const rows = [{name: 'This device', note: deviceName(), me: true}];
    const last = lsGet(DRIVE_LAST), step = syncOn() ? 'In step' + (last ? ' · ' + localTime(last) : '') : 'Not in step';
    const paired = pairedList();
    paired.forEach(p => rows.push({name: p.name, note: step}));
    if (syncOn() && !paired.length) rows.push({name: 'Your other device', note: step});
    list.textContent = '';
    rows.forEach(r => {
      const row = document.createElement('div'), txt = document.createElement('span'), n = document.createElement('b'), sub = document.createElement('span');
      row.className = 'pairrow'; sub.className = 'sub'; n.textContent = r.name; sub.textContent = r.note;
      txt.append(n, sub); row.append(txt);
      if (!r.me) {
        const u = document.createElement('button');
        u.type = 'button'; u.className = 'small unpair'; u.textContent = 'Unpair';
        u.addEventListener('click', async () => {
          if (!await root.Sheet.confirm('Unpair ' + r.name + '?', 'This device stops following it. The money here stays as it is.', 'Unpair', true)) return;
          const l = pairedList().filter(p => p.name !== r.name);
          if (l.length) { lsSet(DRIVE_PAIRED, JSON.stringify(l)); pairBox(); } else syncTurnOff();
        });
        row.append(u);
      }
      list.append(row);
    });
  }
  let pairTimer = 0, pairNote = null;
  function pairClose() {
    clearTimeout(pairTimer);
    document.getElementById('pairscreen').hidden = true;
    document.getElementById('drive').classList.remove('pairing');
  }
  async function pairShare() {                                     // this device shares: its money, a code + QR
    await driveReady();
    const n = new Uint32Array(1); root.crypto.getRandomValues(n);
    const code = String(n[0] % 1000000).padStart(6, '0'), exp = Date.now() + PAIR_MINS * 60000;
    const old = await pairRead().catch(() => null);
    const note = {code, exp, from: deviceName()};
    note.id = await pairWrite({code, exp, from: note.from, copy: await backupFile()}, old && old.id);
    pairNote = note;
    const url = location.origin + location.pathname + '?pair=' + code;
    try {
      const qr = (await loadQr())(0, 'M');
      qr.addData(url); qr.make();
      document.getElementById('pairqr').innerHTML = qr.createSvgTag(6, 2);
    } catch (e) { document.getElementById('pairqr').textContent = ''; }
    document.getElementById('pairnum').textContent = code.slice(0, 3) + ' ' + code.slice(3);
    const mail = lsGet(DRIVE_EMAIL);
    document.getElementById('pairmail').textContent = mail ? 'It will use ' + mail : 'Use the same Google account on it';
    document.getElementById('pairwait').firstChild.textContent = '⏳ Waiting for your other device…';
    document.getElementById('drive').classList.add('pairing');
    document.getElementById('pairscreen').hidden = false;
    pairPoll(note);
  }
  function pairPoll(note) {
    pairTimer = setTimeout(async () => {
      if (pairNote !== note) return;
      let p = null;
      try { p = await pairRead(); } catch (e) { /* offline: look again */ }
      if (pairNote !== note) return;
      if (p && p.code === note.code && p.joined) {
        pairNote = null; pairGone(p.id);
        lsSet(BETA, '1'); lsSet(DRIVE_SYNC, '1'); pairedAdd(p.joined);
        pairClose(); pairBox();
        await syncCheck();                                         // they kept their own money: it comes over here (a reload)
        root.Sheet.tell('✅ Paired', 'This device and your ' + String(p.joined).slice(0, 40) + ' now show the same money.');
        return;
      }
      if (Date.now() > note.exp) {
        pairNote = null; pairGone(note.id);
        document.getElementById('pairwait').firstChild.textContent = '⌛ The code ran out. Tap Cancel and make a new one.';
        return;
      }
      pairPoll(note);
    }, root.LITE_PAIR_EVERY || 3000);
  }
  async function pairJoin(code) {                                  // this device joins the one showing the code
    code = String(code || '').replace(/\D/g, '');
    if (code.length !== 6) throw new Error('Type the 6 numbers from your other device.');
    await driveReady();
    const p = await pairRead();
    if (!p || p.code !== code || p.joined) throw new Error("That code didn't match. Check it on your other device and try again.");
    if (Date.now() > p.exp) throw new Error('That code has run out. Make a new one on your other device.');
    const theirs = p.copy ? await driveOpen(JSON.stringify(p.copy)) : null;
    if (!theirs) throw new Error("Could not open your other device's money. Try again.");
    const from = String(p.from || 'other device').slice(0, 40), spare = st => M.fmt.money(M.monthEndSpare(st));
    const pick = bare(theirs) === bare(state) ? 'a'
      : await root.Sheet.choose('🔗 Which money do you want to keep?', `Your ${from} is sharing its money. Both devices will show the one you pick.`,
                                `☁️ The ${from}'s · ${spare(theirs)} spare`, `📱 This device's · ${spare(state)} spare`);
    if (pick === null) return;
    if (pick === 'a' && bare(theirs) !== bare(state)) {            // like a copy from the other device: ↩️ Undo
      lsSet(DRIVE_UNDO, JSON.stringify(state));
      state = theirs; Store.save(theirs);
      try { root.sessionStorage.setItem('lite_synced', '1'); } catch (e) { /* ignore */ }
    }
    lsSet(BETA, '1'); lsSet(DRIVE_SYNC, '1'); pairedAdd(from);
    lsSet(DRIVE_SYNCED, stampOf((await driveList())[0]));          // the picked money goes up over whatever is there
    lsSet(DRIVE_DIRTY, String(Date.now()));
    await driveSave(false);
    await pairWrite({code: p.code, exp: p.exp, from: p.from, joined: deviceName()}, p.id);   // then the other device follows
    const u = new URL(location.href); u.searchParams.delete('pair'); history.replaceState(null, '', u.toString());
    leave();
  }
  function pairStart(run) {                                        // the buttons (driveStart: ?view=drive only)
    const code = new URLSearchParams(location.search).get('pair');
    if (code) {
      document.getElementById('pairjoin').hidden = false;
      document.getElementById('pairjoingo').addEventListener('click', run(() => pairJoin(code)));
    }
    document.getElementById('pairgo').addEventListener('click', run(pairShare));
    document.getElementById('paircancel').addEventListener('click', () => {
      const n = pairNote; pairNote = null; pairClose();
      if (n) pairGone(n.id);
    });
    document.getElementById('paircodeform').addEventListener('submit', e => {
      e.preventDefault();
      run(() => pairJoin(document.getElementById('paircode').value))();
    });
  }
  function syncStart() {
    pairBox(); syncToast();
    if (syncOn()) setTimeout(() => syncCheck(), 300);
    setInterval(() => { if (document.visibilityState === 'visible') syncCheck(); }, root.LITE_SYNC_EVERY || 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncLater = false; syncCheck(); } });
  }
  document.addEventListener('DOMContentLoaded', syncStart);

  let leaving = false;                                             // our own reload after a save is not "closing the app"
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || leaving) return;
    driveAuto(true);
  });
  document.addEventListener('DOMContentLoaded', () => { driveSign(); driveSoon(); driveMenu(); accMenu(); });
  document.addEventListener('DOMContentLoaded', accStart);
  document.addEventListener('DOMContentLoaded', driveWake);
  document.addEventListener('DOMContentLoaded', driveStart);

  // ---------- v0.60 Orbit inbox ----------
  // Orbit Agent drops wmm-job-*.json files in the Drive folder. Open app + Drive token + unlocked: read them oldest first,
  // apply, delete, save, reload once. A job we do not know stays in Drive (a newer app may). Offline = next time.
  let jobsBusy = false;
  function jobsRun() {
    if (jobsBusy || leaving || !lsGet(DRIVE_ON) || !getToken() || devRole() === 'linked') return;   // v0.64: the Main does them
    const html = document.documentElement;
    if (html.classList.contains('lockon')) {                       // wait for the unlock
      const mo = new MutationObserver(() => { if (!html.classList.contains('lockon')) { mo.disconnect(); jobsRun(); } });
      mo.observe(html, {attributes: true, attributeFilter: ['class']});
      return;
    }
    if (syncBlocked()) { setTimeout(jobsRun, 5000); return; }      // typing or a menu open: not under the person
    jobsBusy = true;
    jobsGo().catch(() => { /* offline or odd: next time */ }).finally(() => { jobsBusy = false; });
  }
  async function jobsGo() {
    const prefix = JOB_PREFIX;
    const q = encodeURIComponent(`name contains '${prefix}' and trashed=false`);
    const l = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`);
    if (!l.ok) return;
    const files = M.jobOrder((await l.json()).files || [], demo);
    if (!files.length) return;
    const gone = [], notes = [];
    let changed = false;
    for (const f of files) {
      const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
      if (!r.ok) continue;
      let job;
      try { job = JSON.parse(await r.text()); } catch (e) { gone.push(f.id); continue; }   // not JSON: nobody can use it
      const res = M.applyJob(state, job, today());
      if (res.skip === 'unknown') continue;
      gone.push(f.id);
      if (res.done || res.skip === 'bad') changed = true;
      if (res.note) notes.push(res.note);
    }
    if (changed) { Store.save(state); lsSet(DRIVE_DIRTY, String(Date.now())); }
    for (const id of gone) await driveFetch(`${DRIVE_API}/${encodeURIComponent(id)}`, {method: 'DELETE'}).catch(() => {});
    if (!changed) return;
    try { root.sessionStorage.setItem('lite_jobs', JSON.stringify(notes)); } catch (e) { /* no note */ }
    const reload = () => { if (syncBlocked()) setTimeout(reload, 5000); else leave(); };
    reload();
  }
  function jobsToast() {                                           // after the reload: what Orbit did
    let notes = [];
    try { notes = JSON.parse(root.sessionStorage.getItem('lite_jobs') || '[]'); root.sessionStorage.removeItem('lite_jobs'); } catch (e) { notes = []; }
    if (!Array.isArray(notes) || !notes.length) return;
    const lines = notes.slice(0, 4).map(n => String(n));
    if (notes.length > 4) lines.push('+' + (notes.length - 4) + ' more');
    const t = document.createElement('div');
    t.className = 'synctoast jobtoast'; t.setAttribute('role', 'status');
    lines.forEach(n => { const d = document.createElement('div'); d.textContent = n; t.appendChild(d); });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 10000);
  }
  document.addEventListener('DOMContentLoaded', () => { jobsToast(); setTimeout(jobsRun); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') jobsRun(); });

  function handleForm(form, submitter) {
    const path = pathOf(form.action);
    if (!ROUTES[path]) return;
    let data;
    try { data = new FormData(form, submitter || undefined); } catch (e) { data = new FormData(form); }
    lastForm = form;
    const r = run(path, data);
    leave(r && r.error);
  }

  // Capture phase: stop the real post, let the page's own submit handlers run first (they may ask "Clear your typed
  // spends?" or save Left and send the form again themselves), then do the route unless they took over.
  document.addEventListener('submit', e => {
    const form = e.target;
    if (!form || !ROUTES[pathOf(form.action)]) return;
    e.preventDefault();
    let taken = false;
    const original = e.preventDefault.bind(e);
    e.preventDefault = () => { taken = true; original(); };
    const submitter = e.submitter || null;
    setTimeout(() => { if (!taken) handleForm(form, submitter); }, 0);
  }, true);

  // The page's ⋯ menu sends forms with form.submit(), which fires no event
  HTMLFormElement.prototype.submit = function () {
    if (ROUTES[pathOf(this.action)]) handleForm(this, null);
  };

  // ---------- fetch: the page script's quiet calls ----------
  const stepOneFetch = root.fetch.bind(root);
  root.fetch = function (url, opts) {
    const path = pathOf(typeof url === 'string' ? url : (url && url.url));
    const known = new URL(typeof url === 'string' ? url : url.url, location.href).origin === location.origin && ROUTES[path];
    if (!known) return stepOneFetch(url, opts);
    opts = opts || {};
    let data = new URLSearchParams();
    const body = opts.body;
    if (body instanceof URLSearchParams) data = body;
    else if (typeof FormData !== 'undefined' && body instanceof FormData) data = body;
    else if (typeof body === 'string') {
      const type = opts.headers && (opts.headers['Content-Type'] || opts.headers['content-type']);
      if (type && /json/.test(type)) {                  // a JSON body: get(name) gives the value as it is
        let obj = {};
        try { obj = JSON.parse(body) || {}; } catch (e) { /* not JSON: empty */ }
        data = {obj, get: name => (obj && typeof obj === 'object' ? obj[name] : undefined)};
      } else data = new URLSearchParams(body);
    }
    const quiet = opts.headers && (opts.headers['X-Requested-With'] === 'fetch');
    const r = run(path, data);
    if (path === '/payday/day') return Promise.resolve(new Response(null, {status: r && r.error ? 400 : 204}));   // quiet: no reload
    if (path === '/bill' && quiet) {                 // live: 400 for a bad amount, 204 saved, no reload
      const bad = r && r.error;
      return Promise.resolve(bad ? new Response('', {status: 400}) : (r && r.unknown ? new Response('', {status: 200}) : new Response(null, {status: 204})));
    }
    if (QUIET_204.indexOf(path) >= 0) return Promise.resolve(new Response(null, {status: 204}));
    return Promise.resolve(new Response('', {status: 200}));   // live redirects here; fetch just follows it
  };

  // ---------- start: draw the numbers before the page's own script runs ----------
  function start() {
    let err = null;
    try { err = new URLSearchParams(location.search).get('error'); } catch (e) { /* ignore */ }
    Store.save(state);
    const out = root.LiteRender.render(state, err, today());
    placeNow();
    return out;
  }

  // ---------- v0.61 a wiped device: Passport's Google sign-in + passcode, then the newest Drive copy comes back ----------
  // (passport-lock.js shows the screens.) Drive saves wait until the money is back, so nothing writes over the copy.
  let found = null;
  function restoreOff() {                                          // 'Start new instead': Drive off, the copy stays as it is
    [DRIVE_ON, DRIVE_EMAIL, DRIVE_ID, dirKey(), DRIVE_DIRTY, RESTORE].forEach(k => lsSet(k, null));
    setToken(''); found = null;
  }
  const PC = () => (typeof PassportCloud !== 'undefined' && PassportCloud.enabled ? PassportCloud : null);
  async function restoreFind() {                                   // {file: null} or {file, obj, kind 'sealed'|'plain', day}
    found = null;
    const f = (await driveList())[0];
    if (!f) return {file: null};
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
    if (!r.ok) throw new Error('Could not read the copy from Google Drive (error ' + r.status + ').');
    let obj = null;
    try { obj = JSON.parse(await r.text()); } catch (e) { /* not JSON */ }
    if (!obj || obj.app !== 'wheres-my-money-lite' || !(obj.scrambled || M.importBackup(obj))) {
      throw new Error("The copy in your Google Drive is not a Where's My Money backup.");
    }
    found = {file: f, obj};
    return {file: f, obj, kind: obj.scrambled ? 'sealed' : 'plain', day: M.fmt.day(obj.saved || String(f.modifiedTime || '').slice(0, 10))};
  }
  function restoreFinish(st) {                                     // the money is back: keep it, and Drive carries on with that file
    if (!found) return false;
    const s = M.importBackup({app: found.obj.app, saved: found.obj.saved, state: st || found.obj.state});
    if (!s) return false;
    signedOut = false;                                             // v0.62: signed in again on this page: keep it
    state = s; Store.save(s); hadState = true;
    lsSet(DRIVE_ID, JSON.stringify({name: found.file.name, id: found.file.id}));
    lsSet(DRIVE_DIRTY, null); lsSet(RESTORE, null);
    if (found.file.modifiedTime) lsSet(DRIVE_SYNCED, stampOf(found.file));   // v0.64: this copy is the one seen here
    return true;
  }
  async function restoreConnect() {                                // a tap: the passport's Google account
    await loadGsi();
    if (PC() && root.LockUI && root.LockUI.email()) await PC().ensureToken(root.LockUI.email());
    else await driveConnect(false);
  }
  root.LiteRestore = {find: restoreFind, finish: restoreFinish, off: restoreOff, none: () => lsSet(RESTORE, null),
                      connect: restoreConnect, hasToken: () => !!getToken(), ready: () => !!clientId(), isOn: () => !!lsGet(DRIVE_ON)};

  // ---------- v0.61 🛂 Passport tells the app who is in ----------
  // The first time a passport is used here (a real Google one): Drive is on with that Google account. No money here yet
  // (a wiped device or a new person) = get the newest Drive copy first. Another Google account than before = new files.
  function ppUnlocked(p, cloud) {
    if (!cloud || !p || !p.email) return {};
    if (lsGet(PPSEEN) !== p.email) {
      lsSet(PPSEEN, p.email);
      if (clientId()) {
        const was = lsGet(DRIVE_EMAIL);
        if (was && was.toLowerCase() !== p.email.toLowerCase()) {   // its files are in the other account's Drive
          [DRIVE_ID, DK('ppdir'), DK('ppsafe'), DK('summary'), DK('moved'), DK('synced')].forEach(k => lsSet(k, null));
          if (hadState) lsSet(DRIVE_DIRTY, String(Date.now()));
        }
        lsSet(DRIVE_ON, '1'); lsSet(DRIVE_EMAIL, p.email);
        if (!hadState) lsSet(RESTORE, 'need');
        driveSign(); driveMenu(); accMenu();
      }
    }
    return {restore: lsGet(RESTORE) === 'need'};
  }
  // 🚪 Sign out: what is not in Drive yet goes there first (or a backup file is downloaded), then WMM's keys leave this device
  async function signOut() {
    let saved = false;
    const money = hadState && lsGet(RESTORE) !== 'need';
    if (money && lsGet(DRIVE_ON) && clientId()) {
      try {
        if (!getToken() && PC() && root.LockUI && root.LockUI.email()) await PC().ensureToken(root.LockUI.email());
        if (devRole() === 'linked') await outSend();                // v0.64: to the Main
        else if (lsGet(DRIVE_DIRTY)) await driveSave(false);
        saved = !!getToken();
      } catch (e) { saved = false; }
    }
    if (money && !saved) {
      try { fileOut(M.backupName(today()), JSON.stringify(await backupFile(), null, 1)); } catch (e) { /* nothing to keep */ }
    }
    signedOut = true; hadState = false; clearTimeout(driveTimer);
    const mine = k => (demo ? k.indexOf('lite_demo_') === 0 && k !== 'lite_demo_lock' : k.indexOf('lite_') === 0 && k.indexOf('lite_demo_') !== 0);
    [root.localStorage, root.sessionStorage].forEach(area => {
      try { Object.keys(area).filter(mine).forEach(k => area.removeItem(k)); } catch (e) { /* ignore */ }
    });
  }
  root.LitePassport = {unlocked: ppUnlocked, signOut, signedOut: () => signedOut,
                       pending: email => !!(PC() && email && clientId() && (lsGet(PPSEEN) !== email || lsGet(RESTORE) === 'need'))};

  root.Lite = {start, Store, today, state: () => state, run, leave, saveBackup};
})(window);
