// SERVICE WORKER – resiliente
const CACHE_VERSION = 'v1.0.4';
const CACHE_NAME = `oracao-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(async (url) => {
      try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
        await cache.put(url, resp);
      } catch (err) {
        console.warn('[SW] Falhou ao cachear:', url, err.message);
      }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) {
      fetch(event.request).then(r => {
        if (r && r.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, r));
      }).catch(()=>{});
      return cached;
    }
    try {
      const net = await fetch(event.request);
      if (net && net.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, net.clone()));
      return net;
    } catch {
      return caches.match('./index.html');
    }
  })());
});
// ... (fetch, install, activate)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_VERSION') {
    self.skipWaiting();
  }
});
