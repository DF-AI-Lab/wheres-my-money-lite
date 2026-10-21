/* Where's My Money? Lite - step 2: the in-browser "server".
   Live's Flask routes (/add /remove /pay /left /bill /stopped /card/...) become functions on a state object that is
   kept in the browser. A form post or the page script's fetch() to one of those routes changes the state, saves it,
   and (for a form) reloads the page, exactly like live's redirect after a POST. Every other server path still does
   nothing (the step 1 shim in index.html answers /stamp and swallows the rest).
   STEP 3 will move the saving from sessionStorage to localStorage: that is this file's Store, nothing else. */
(function (root) {
  'use strict';
  const M = root.Money;

  // ---------- where the state lives (one place) ----------
  const KEY = 'lite_state_v1', TODAY_KEY = 'lite_today';
  const Store = {
    area() { return root.sessionStorage; },            // step 3: root.localStorage
    load() {
      try {
        const raw = Store.area().getItem(KEY);
        if (raw) { const s = JSON.parse(raw); if (s && typeof s === 'object' && Array.isArray(s.bills)) return s; }
      } catch (e) { /* no storage: start from the fake data */ }
      return null;
    },
    save(s) { try { Store.area().setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window: not saved */ } },
  };
  let state = Store.load() || M.FAKE();

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
  const ROUTES = {
    '/add': (s, get) => M.addSpend(s, today(), get('amount'), get('name')),
    '/remove': (s, get) => M.removeSpend(s, get('id')),
    '/pay': (s, get) => M.setPay(s, get('pay'), get('clear') === '1'),
    '/left': (s, get) => M.setLeft(s, get('amount')),
    '/bill': (s, get) => { const r = M.setBill(s, get('key'), get('amount')); return r === 'unknown' ? null : r; },
    '/stopped': (s, get) => { const r = M.setStopped(s, get('key'), get('stopped') === '1'); return r === 'unknown' ? null : r; },
    '/card/add': (s, get) => M.cardAdd(s, today(), get('amount'), get('name'), get('paid') === '1'),
    '/card/remove': (s, get) => M.cardRemove(s, get('id')),
    '/card/limit': (s, get) => M.cardLimit(s, get('amount')),
    '/card/balance': (s, get) => M.cardBalance(s, today(), get('amount')),
  };
  const pathOf = url => { try { return new URL(url, location.href).pathname; } catch (e) { return ''; } };
  const getter = data => name => { const v = data.get(name); return v === null || v === undefined ? '' : String(v); };

  // Run a route on the state and save it. Returns {error, unknownBill}.
  function run(path, data) {
    const fn = ROUTES[path];
    if (!fn) return null;
    let unknown = false;
    if (path === '/bill' || path === '/stopped') {
      unknown = !state.bills.some(b => b.key === getter(data)('key'));
    }
    const error = fn(state, getter(data));
    if (!error) Store.save(state);
    return {error, unknown};
  }

  // ---------- forms: apply, then go where live's redirect goes ----------
  function leave(error) {
    if (error) {
      const u = new URL(location.href);
      u.searchParams.set('error', error);
      location.assign(u.toString());
    } else {
      location.replace(location.href);              // a fresh load at the top, like live's redirect after a POST
    }
  }
  function handleForm(form, submitter) {
    const path = pathOf(form.action);
    if (!ROUTES[path]) return;
    let data;
    try { data = new FormData(form, submitter || undefined); } catch (e) { data = new FormData(form); }
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
    else if (typeof body === 'string') data = new URLSearchParams(body);
    const quiet = opts.headers && (opts.headers['X-Requested-With'] === 'fetch');
    const r = run(path, data);
    if (path === '/bill' && quiet) {                 // live: 400 for a bad amount, 204 saved, no reload
      const bad = r && r.error;
      return Promise.resolve(bad ? new Response('', {status: 400}) : (r && r.unknown ? new Response('', {status: 200}) : new Response(null, {status: 204})));
    }
    return Promise.resolve(new Response('', {status: 200}));   // live redirects here; fetch just follows it
  };

  // ---------- start: draw the numbers before the page's own script runs ----------
  function start() {
    let err = null;
    try { err = new URLSearchParams(location.search).get('error'); } catch (e) { /* ignore */ }
    Store.save(state);
    return root.LiteRender.render(state, err);
  }

  root.Lite = {start, Store, today, state: () => state, run};
})(window);
