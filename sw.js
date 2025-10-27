// SERVICE WORKER — v1.0.7
const CACHE_VERSION = 'v1.0.7';
const CACHE_NAME = `oracao-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  // ícones e imagens usadas na UI
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/canal.png'
];

// ——— Instalação: pré-cache do app shell (não falha se algum asset faltar)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(async (url) => {
      try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp.ok) throw new Error(`${resp.status}`);
        await cache.put(url, resp);
      } catch (err) {
        console.warn('[SW] Falhou ao cachear:', url, err.message);
      }
    }));
  })());
  self.skipWaiting();
});

// ——— Ativação: limpa caches antigos e habilita navigation preload (quando houver)
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
  })());
  self.clients.claim();
});

// ——— Estratégias de fetch:
// • Páginas (document): network-first com fallback para cache e depois index (offline)
// • Demais GET: stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // não interferir em POST/PUT/etc. (ex.: TTS)
  if (request.method !== 'GET') return;

  const isDocument = request.mode === 'navigate' || request.destination === 'document';

  if (isDocument) {
    event.respondWith((async () => {
      try {
        // tenta usar o navigation preload quando disponível
        const preload = await event.preloadResponse;
        if (preload) return preload;

        const net = await fetch(request, { cache: 'no-store' });
        // atualiza cópia do index para fallback
        const cache = await caches.open(CACHE_NAME);
        cache.put('./', net.clone());
        return net;
      } catch {
        // offline → tenta cache
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request) || await cache.match('./') || await cache.match('./index.html');
        if (cached) return cached;
        // último recurso: resposta vazia básica
        return new Response('<h1>Offline</h1><p>Tente novamente quando voltar a conexão.</p>', {
          headers: { 'Content-Type': 'text/html; charset=UTF-8' }, status: 503
        });
      }
    })());
    return;
  }

  // assets estáticos → stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const netPromise = fetch(request).then((netRes) => {
      if (netRes && netRes.ok) cache.put(request, netRes.clone());
      return netRes;
    }).catch(() => null);

    // prioriza cache (rápido) e atualiza em segundo plano
    if (cached) {
      netPromise.catch(() => {});
      return cached;
    }
    // sem cache: tenta rede
    const net = await netPromise;
    if (net) return net;

    // fallback genérico
    return new Response('', { status: 504 });
  })());
});

// ——— Mensagens do cliente (página) para controlar atualização
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING' || type === 'CHECK_VERSION') {
    self.skipWaiting();
    // opcional: responder com a versão atual
    event.source?.postMessage?.({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
});
