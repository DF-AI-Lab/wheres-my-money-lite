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
    '/add': (s, get) => get('upcoming') === '1' && !get('date').trim() ? 'spend'
      : M.addSpend(s, today(), get('amount'), get('name'), get('upcoming') === '1' ? get('date') : ''),
    '/spend/paid': (s, get) => M.paySpend(s, get('id'), today()),
    '/spend/date': (s, get) => M.setSpendDate(s, get('id'), get('date')),
    '/spend/cat': (s, get) => M.setSpendCat(s, get('id'), get('cat')),
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
    if (!error) { Store.save(state); lsSet(DRIVE_DIRTY, '1'); }   // Drive sends it when the app is next hidden
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
  function backToPlace() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('lite_place')); sessionStorage.removeItem('lite_place'); } catch (e) { /* none */ }
    if (!saved) return;
    const go = () => {
      for (const p of saved.places || []) {
        const node = document.querySelectorAll(p.sel)[p.i];
        if (shown(node)) { scrollTo({top: scrollY + node.getBoundingClientRect().top - p.top, behavior: 'instant'}); return; }
      }
      scrollTo({top: saved.y || 0, behavior: 'instant'});
    };
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (document.readyState === 'complete') go(); else addEventListener('load', () => { go(); requestAnimationFrame(go); });
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
  function driveConnect(quiet) {
    return new Promise((resolve, reject) => {
      const client = root.google.accounts.oauth2.initTokenClient({
        client_id: clientId(), scope: 'https://www.googleapis.com/auth/drive.file',
        callback: t => { if (t && t.access_token) { setToken(t.access_token, Number(t.expires_in) || 3600); lsSet(DRIVE_ON, '1'); resolve(); }
                         else reject(new Error('Google did not let you in. Try again.')); },
        error_callback: () => reject(new Error('Google sign-in was closed or blocked. Try again.')),
      });
      if (quiet) client.requestAccessToken({prompt: ''}); else client.requestAccessToken();
    });
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
    if (!driveBusy) driveBusy = driveSaveNow(hidden).finally(() => { driveBusy = null; });
    return driveBusy;
  }
  async function driveSaveNow(hidden) {
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
      const r = await driveFetch(`${DRIVE_UP}${id ? '/' + encodeURIComponent(id) : ''}?uploadType=multipart&fields=id,trashed`,
        {method: id ? 'PATCH' : 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b}, body,
         keepalive: !!hidden && body.length < 60000});              // the app is closing: let the save finish
      if (!r.ok) return {status: r.status};
      const j = await r.json().catch(() => ({}));
      return {status: r.status, ok: true, id: j.id || id, trashed: !!j.trashed};
    };
    const fresh = async () => { folder = await driveFolder(); return send(null); };
    let id = saved && saved.name === name ? saved.id : null, r = id ? await send(id) : await fresh();
    // v0.39: Drive lets you save into a binned file (or a binned folder): that counts as gone too
    if (id && (r.status === 404 || r.trashed)) { id = null; r = await fresh(); }   // deleted in Drive: make a new one
    if (!id && (r.status === 404 || r.trashed) && folder) { lsSet(DRIVE_DIR, null); r = await fresh(); }   // folder gone: a new one
    if (!r.ok) throw new Error('Google Drive would not take the copy (error ' + r.status + ').');
    if (r.id) lsSet(DRIVE_ID, JSON.stringify({name, id: r.id}));
    if (!id) {                                                     // a new pay month: a new file, then keep the last 3
      try { for (const old of M.drivePrune(await driveList(), 3)) await driveFetch(`${DRIVE_API}/${encodeURIComponent(old)}`, {method: 'DELETE'}); }
      catch (e) { /* tidy next time */ }
    }
    lsSet(DRIVE_DIRTY, null); lsSet(DRIVE_LAST, new Date().toISOString());
    M.setBackupDay(state, today()); Store.save(state);             // counts as a backup (no bell reminder)
  }
  async function driveLoad() {
    const list = await driveList();
    if (!list.length) throw new Error('There is no copy in your Google Drive yet. Save one first.');
    const r = await driveFetch(`${DRIVE_API}/${encodeURIComponent(list[0].id)}?alt=media`);
    if (!r.ok) throw new Error('Could not read the copy from Google Drive (error ' + r.status + ').');
    await loadBackup(await r.text());
  }
  function driveShow(connected) {
    const set = (id, hide) => { const el = document.getElementById(id); if (el) el.hidden = hide; };
    set('driveconnect', connected); set('drivesave', !connected); set('driveload', !connected);
    set('driveauto', !connected); set('driveoff', !connected);
    const last = document.getElementById('drivelast'), at = lsGet(DRIVE_LAST);
    if (last) last.textContent = at ? 'last saved ' + M.fmt.day(at.slice(0, 10)) + ' ' + at.slice(11, 16) : 'saves when you close the app';
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
    document.getElementById('drivesave').addEventListener('click', run(async () => { await driveSave(false); ok.hidden = false; driveShow(true); }));
    document.getElementById('driveload').addEventListener('click', run(driveLoad));
    document.getElementById('driveoff').addEventListener('click', () => { lsSet(DRIVE_ON, null); setToken(''); driveShow(false); });
  }
  // the quiet reconnect: the first tap of a visit (a popup needs a tap), when Drive was connected before
  function driveWake() {
    if (!lsGet(DRIVE_ON) || !clientId()) return;
    loadGsi().catch(() => {});                                     // ready before the tap
    const once = () => {
      document.removeEventListener('pointerdown', once, true);
      if (getToken() || !(root.google && root.google.accounts && root.google.accounts.oauth2)) return;
      driveConnect(true).catch(() => { /* blocked or closed: try again next visit */ });
    };
    document.addEventListener('pointerdown', once, true);
  }
  let leaving = false;                                             // our own reload after a save is not "closing the app"
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || leaving || !lsGet(DRIVE_ON) || !lsGet(DRIVE_DIRTY) || !getToken()) return;
    driveSave(true).catch(() => { /* offline: it stays changed, the next visit sends it */ });
  });
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
    return root.LiteRender.render(state, err, today());
  }

  root.Lite = {start, Store, today, state: () => state, run, leave, saveBackup};
})(window);
