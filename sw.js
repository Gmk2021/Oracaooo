// SERVICE WORKER – versão estável e resiliente
const CACHE_VERSION = 'v1.0.6';
const CACHE_NAME = `oracao-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

// Instala e faz cache inicial
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of APP_SHELL) {
        try {
          const resp = await fetch(url, { cache: 'no-cache' });
          if (resp.ok) await cache.put(url, resp.clone());
        } catch (err) {
          console.warn('[SW] Falhou ao cachear:', url, err.message);
        }
      }
    })()
  );
  self.skipWaiting();
});

// Ativa e limpa versões antigas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Intercepta fetch e serve cache + atualização em segundo plano
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) {
        fetch(event.request).then(r => {
          if (r && r.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      try {
        const net = await fetch(event.request);
        if (net && net.ok) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, net.clone()));
        }
        return net;
      } catch {
        return caches.match('./index.html');
      }
    })()
  );
});

// Listener para forçar atualização manual
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_VERSION') {
    self.skipWaiting();
  }
});
