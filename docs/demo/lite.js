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
    save(s) { try { Store.area().setItem(Store.key, JSON.stringify(s)); } catch (e) { /* private window: not saved */ } },
  };
  // v0.57 the demo copy can try the lock as a WIPED device: ?lock=1 clears the demo's own lock, name, money and Drive
  // keys and turns its lock on for this tab; ?lock=0 = no lock again. Live's keys are never touched.
  if (demoCopy) {
    try {
      const u = new URL(location.href), q = u.searchParams.get('lock');
      if (q === '1') {
        ['lite_demo_lock_v1', 'lite_demo_name'].concat(Object.keys(root.localStorage).filter(k => k.indexOf('lite_demo_drive_') === 0))
          .forEach(k => root.localStorage.removeItem(k));
        [DEMO_KEY, 'lite_demo_unlock', 'lite_demo_drive_token'].forEach(k => root.sessionStorage.removeItem(k));
        root.sessionStorage.setItem('lite_demo_lock', '1');
      } else if (q === '0') root.sessionStorage.removeItem('lite_demo_lock');
      if (q !== null) { u.searchParams.delete('lock'); history.replaceState(null, '', u.pathname + u.search + u.hash); }   // a reload must not wipe again
    } catch (e) { /* no storage */ }
  }
  let state = Store.load() || (demo ? M.FAKE() : M.TEMPLATE());
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
    const error = fn(state, getter(data));
    if (!error) { Store.save(state); lsSet(DRIVE_DIRTY, String(Date.now())); driveSign(); driveSoon(); }   // Drive: 1 minute on, or when hidden
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
  async function loadBackup(text) {                                // the text of a backup file (from a file or from Drive)
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
  const TOKEN_KEY = demo ? 'lite_demo_drive_token' : 'lite_drive_token';     // sessionStorage: survives the reload after a save
  const GSI = 'https://accounts.google.com/gsi/client';
  const FOLDER_TYPE = 'application/vnd.google-apps.folder';
  const DRIVE_API = 'https://www.googleapis.com/drive/v3/files', DRIVE_UP = 'https://www.googleapis.com/upload/drive/v3/files';
  const lsGet = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v === null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  function getToken() {
    try { const t = JSON.parse(root.sessionStorage.getItem(TOKEN_KEY)); if (t && t.t && t.exp > Date.now() + 60000) return t.t; } catch (e) { /* none */ }
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
    if (r.status === 401) { setToken(''); driveShow(false); throw new Error('Google Drive signed you out. Tap Connect Google Drive again.'); }
    return r;
  }
  async function driveList() {                                     // this app's backup files, the newest first
    const q = encodeURIComponent(`name contains '${DRIVE_BASE}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)`);
    if (!r.ok) throw new Error('Could not look in your Google Drive (error ' + r.status + ').');
    return ((await r.json()).files || []).filter(f => f.name && f.name.indexOf(DRIVE_BASE) === 0);
  }
  async function driveFolder() {                                   // the folder's id (found or made once); null = save loose
    if (lsGet(DRIVE_DIR)) return lsGet(DRIVE_DIR);
    try {
      const q = encodeURIComponent(`name='${DRIVE_FOLDER.replace(/'/g, "\\'")}' and mimeType='${FOLDER_TYPE}' and trashed=false`);
      const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name,mimeType)`);
      let f = r.ok ? ((await r.json()).files || []).find(x => x.name === DRIVE_FOLDER && x.mimeType === FOLDER_TYPE) : null;
      if (!f) {
        const m = await driveFetch(DRIVE_API, {method: 'POST', headers: {'Content-Type': 'application/json'},
                                               body: JSON.stringify({name: DRIVE_FOLDER, mimeType: FOLDER_TYPE})});
        f = m.ok ? await m.json() : null;
      }
      if (f && f.id) { lsSet(DRIVE_DIR, f.id); return f.id; }
    } catch (e) { /* no folder this time */ }
    return null;
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
    const was = lsGet(DRIVE_DIRTY);                                // a change made while this one is going stays to send
    if (syncOn()) {                                                // v0.45: never write over a newer copy from the other device
      const f = (await driveList())[0];
      if (f && stampOf(f) !== lsGet(DRIVE_SYNCED)) {
        setTimeout(() => syncCheck(), 0);
        throw new Error('Your other device saved a newer copy first. Nothing was written over it.');
      }
    }
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
    if (!id && (r.status === 404 || r.trashed) && folder) { lsSet(DRIVE_DIR, null); r = await fresh(); }   // folder gone: a new one
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
  }
  async function driveLoad() {
    const list = await driveList();
    if (!list.length) throw new Error('There is no copy in your Google Drive yet. Save one first.');
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(list[0].id)}?alt=media`);
    if (!r.ok) throw new Error('Could not read the copy from Google Drive (error ' + r.status + ').');
    await loadBackup(await r.text());
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
  const SAFE_BASE = demo ? 'wmm-lite-demo-safety' : 'wmm-lite-safety', SAFE_DIR = DK('safedir'), SAFE_DAY = DK('safeday');
  const SAFE_KEEP = 30;
  async function safeList() {                                      // the safety copies, the newest day first
    const q = encodeURIComponent(`name contains '${SAFE_BASE}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`);
    if (!r.ok) throw new Error('Could not look in your Google Drive (error ' + r.status + ').');
    return ((await r.json()).files || []).map(f => Object.assign(f, {day: (/(\d{4}-\d{2}-\d{2})\.json$/.exec(f.name || '') || [])[1]}))
      .filter(f => f.name.indexOf(SAFE_BASE + ' ') === 0 && f.day).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }
  async function safeFolder() {                                    // 'Safety copies' inside the app's folder (found or made once)
    if (lsGet(SAFE_DIR)) return lsGet(SAFE_DIR);
    const q = encodeURIComponent(`name='Safety copies' and mimeType='${FOLDER_TYPE}' and trashed=false`);
    const r = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name,mimeType)`);
    let f = r.ok ? ((await r.json()).files || []).find(x => x.name === 'Safety copies' && x.mimeType === FOLDER_TYPE) : null;
    for (let n = 0; !f && n < 2; n++) {                            // made inside a binned folder = binned: the folder again
      const top = await driveFolder();
      const m = await driveFetch(`${DRIVE_API}?fields=id,trashed`, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.assign({name: 'Safety copies', mimeType: FOLDER_TYPE}, top ? {parents: [top]} : {}))});
      f = m.ok ? await m.json() : null;
      if (f && f.trashed) { f = null; lsSet(DRIVE_DIR, null); }
    }
    if (f && f.id) lsSet(SAFE_DIR, f.id);
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
        if (!await copy()) { lsSet(SAFE_DIR, null); lsSet(DRIVE_DIR, null); if (!await copy()) return; }
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
      row.innerHTML = '<span><b></b><span class="sub">Start of the day</span></span>' +
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
          lsSet(DRIVE_ID, null); lsSet(DRIVE_DIR, null);
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
    if (!lsGet(DRIVE_ON) || !lsGet(DRIVE_DIRTY) || !getToken()) return;
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
      driveConnect(true).then(() => syncOn() ? syncCheck() : driveAuto(false))   // v0.40: a change not sent last time goes now
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
    const secret = await root.Sheet.ask('🔗 Link this device', 'The passcode you use on your other device', '', 'numeric');
    if (secret === null) { syncLater = true; return null; }
    const o = await root.Lock.adopt(sealed, secret);
    if (!o) { await root.Sheet.tell("😕 That didn't open", 'Check the passcode and try again later.'); syncLater = true; return null; }
    root.LockUI.adopt(o);
    await root.Sheet.tell('🔗 Linked', 'This device now uses the same passcode and backup codes as your other device.');
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
    t.innerHTML = (shown === 'load' ? '<span>📂 Backup loaded</span>' : '<span>🔁 Updated from your other device</span>') + (lsGet(DRIVE_UNDO) ? '<button type="button" class="syncundo">↩️ Undo</button>' : '');
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

  // ---------- v0.55 🔗 pair a device (mock https://claude.ai/artifact/XvEVsgGDZzfsVTLCdSFroq) ----------
  // No server: the two devices meet in the same Google Drive. The device showing the code writes a pair note
  // {code, exp, from, copy} (copy = its backup, scrambled like the Drive copy; an unpaired device's auto-save may have
  // written over the month file meanwhile). The other device (camera link ?pair=CODE, or the code typed) checks it, picks
  // which money to keep (the sharing device's first), sends that to Drive, marks the note joined, and both stay in step.
  // TEST: ?beta=sync only.
  const PAIR_FILE = demo ? 'wmm-lite-demo-pair.json' : 'wmm-lite-pair.json', DRIVE_PAIRED = DK('paired');
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
    const b = 'wmm' + Date.now(), meta = id ? {name: PAIR_FILE} : {name: PAIR_FILE, mimeType: 'application/json'};
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
    box.hidden = !lsGet(DRIVE_ON);
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
        data = {get: name => (obj && typeof obj === 'object' ? obj[name] : undefined)};
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

  // ---------- v0.57 a wiped device: sign in with Google, find the newest Drive copy (lockui.js asks the passcode) ----------
  // Drive stays off until the money is back, so a device that starts new instead can never write over the copy.
  let found = null;
  function restoreOff() {
    [DRIVE_ON, DRIVE_EMAIL, DRIVE_ID, DRIVE_DIR, DRIVE_DIRTY].forEach(k => lsSet(k, null));
    setToken(''); found = null;
  }
  async function restoreFind(pick) {                               // {email, file: null} or {email, file, day, scrambled}
    if (!clientId()) throw new Error('Google sign-in is not set up yet.');
    found = null;
    try {
      await loadGsi();
      lsSet(DRIVE_EMAIL, null);
      await driveConnect(false, pick);
      const email = lsGet(DRIVE_EMAIL) || '', f = (await driveList())[0];
      if (!f) { restoreOff(); return {email, file: null}; }
      const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(f.id)}?alt=media`);
      if (!r.ok) throw new Error('Could not read the copy from Google Drive (error ' + r.status + ').');
      let obj = null;
      try { obj = JSON.parse(await r.text()); } catch (e) { /* not JSON */ }
      if (!obj || obj.app !== 'wheres-my-money-lite' || !(obj.scrambled || M.importBackup(obj))) {
        throw new Error("The copy in your Google Drive is not a Where's My Money backup.");
      }
      found = {file: f, obj};
      return {email, file: f, day: M.fmt.day(obj.saved || String(f.modifiedTime || '').slice(0, 10)), scrambled: !!obj.scrambled};
    } catch (e) { restoreOff(); throw e; }
  }
  const restoreOpen = secret => (found && found.obj.scrambled ? root.Lock.adopt(found.obj.scrambled, secret) : Promise.resolve(null));
  function restoreFinish(st) {                                     // the money is back: keep it, and Drive carries on with that file
    const s = M.importBackup({app: found.obj.app, saved: found.obj.saved, state: st || found.obj.state});
    if (!s) return false;
    state = s; Store.save(s);
    lsSet(DRIVE_ID, JSON.stringify({name: found.file.name, id: found.file.id}));
    lsSet(DRIVE_DIRTY, null);
    return true;
  }
  // v0.58 a new person is asked to turn Drive on straight after the passcode. A Google account that already holds a copy
  // is NOT used (it would be written over): they get it back with Sign in with Google on a fresh start instead.
  async function setupConnect() {
    await loadGsi();
    lsSet(DRIVE_EMAIL, null);
    await driveConnect(false);
    let had = [];
    try { had = await driveList(); } catch (e) { restoreOff(); throw e; }
    if (had.length) { const email = lsGet(DRIVE_EMAIL) || 'that Google account'; restoreOff(); return {email, had: true}; }
    lsSet(DRIVE_DIRTY, String(Date.now()));                         // the first copy goes up soon
    driveSoon(); driveMenu(); accMenu();
    return {email: lsGet(DRIVE_EMAIL) || '', had: false};
  }
  root.LiteRestore = {find: restoreFind, open: restoreOpen, finish: restoreFinish, off: restoreOff, ready: () => !!clientId(),
                      connect: setupConnect, isOn: () => !!lsGet(DRIVE_ON)};

  root.Lite = {start, Store, today, state: () => state, run, leave, saveBackup};
})(window);
