// SERVICE WORKER — simples, resiliente e sem erros de clone()
// Autor: você 😊  | Versão:
const CACHE_VERSION = 'v1.0.5';
const CACHE_NAME = `oracao-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

// INSTALAÇÃO — faz cache do shell do app, sem quebrar se algum arquivo falhar
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of APP_SHELL) {
      try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (resp.ok) {
          await cache.put(url, resp.clone()); // clone() para usar a resposta depois
        } else {
          console.warn('[SW] skip cache (HTTP)', url, resp.status);
        }
      } catch (err) {
        console.warn('[SW] skip cache (network)', url, err.message);
      }
    }
  })());
  self.skipWaiting();
});

// ATIVAÇÃO — remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
  })());
  self.clients.claim();
});

// FETCH — cache-first com atualização em segundo plano
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) {
      // Atualiza em segundo plano
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
        const copy = net.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
      }
      return net;
    } catch {
      return caches.match('./index.html');
    }
  })());
});

// Mensagem para ativar nova versão (usada pelo card "Atualizar agora")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_VERSION') {
    self.skipWaiting();
  }
});
