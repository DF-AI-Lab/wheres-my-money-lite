/* Where's My Money? Lite - the service worker (step 8): keeps the app files on the phone so it opens with no internet.
   Bump VERSION with every app version (the tests check that the cache name = the page version). */
const VERSION = '0.30';
// Live (…/) and the demo (…/demo/) share one website, so each keeps its own cache and never touches the other's.
const DEMO = /\/demo\/$/.test(new URL('./', self.location).pathname);
const PREFIX = DEMO ? 'wmm-lite-demo-' : 'wmm-lite-';
const CACHE = PREFIX + VERSION;
const mine = name => DEMO ? name.startsWith('wmm-lite-demo-') : /^wmm-lite-\d/.test(name);
const FILES = ['./', 'index.html', 'config.js', 'money.js', 'render.js', 'sheet.js', 'lite.js', 'lock.js', 'lockui.js', 'look.css', 'lite.css',
  'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'lite-192.png', 'lite-512.png', 'lite-maskable-512.png', 'invite-qr.svg'];

// install: fetch every file fresh (not from the HTTP cache) and keep it under its plain URL (no ?v=)
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FILES.map(async f => {
      const r = await fetch(new Request(f, {cache: 'reload'}));
      if (!r.ok) throw new Error(f + ' ' + r.status);
      await cache.put(f, r);
    }));
    await self.skipWaiting();
  })());
});

// activate: throw away the caches of older versions
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) if (mine(name) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;     // fonts etc. go their own way
  const scope = new URL('./', self.location).pathname;
  if (!url.pathname.startsWith(scope) || url.pathname.slice(scope.length).startsWith('demo/')) return;   // the demo's own files
  if (url.pathname.endsWith('/version.json')) {                                // the Update check: always the internet
    return;                                                                    // not answered here = straight to the internet, never kept
  }
  if (req.mode === 'navigate') {                                               // the page: newest if online, else kept
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok) {
          const cache = await caches.open(CACHE);
          cache.put('index.html', r.clone());
          cache.put('./', r.clone());
        }
        return r;
      } catch (err) {
        const hit = await caches.match('./', {ignoreSearch: true}) || await caches.match('index.html', {ignoreSearch: true});
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  e.respondWith((async () => (await caches.match(req, {ignoreSearch: true})) || fetch(req))());   // files: kept first
});
