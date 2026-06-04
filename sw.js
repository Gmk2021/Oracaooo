// SERVICE WORKER – PWA estável + atualização suave
// 👉 sempre que alterar qualquer arquivo do app, mude a versão abaixo
const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `oracao-cache-${CACHE_VERSION}`;

// arquivos essenciais do app (app shell)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/canal.png'
];

// instala e pré-cacheia o app shell (ignora falhas individuais)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(async (url) => {
      try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
        await cache.put(url, resp);
      } catch (err) {
        console.warn('[SW] Falha ao cachear:', url, err.message);
      }
    }));
  })());
  self.skipWaiting();
});

// ativa nova versão e limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// estratégia: Stale-While-Revalidate (rápido + atualiza ao fundo)
self.addEventListener('fetch', (event) => {
  // só GET
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    // tenta cache primeiro
    const cached = await caches.match(event.request);
    if (cached) {
      // atualiza ao fundo (não bloqueia a resposta)
      fetch(event.request).then((fresh) => {
        if (fresh && fresh.ok) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, fresh.clone()));
        }
      }).catch(() => {});
      return cached;
    }

    // se não tem no cache, tenta rede e salva
    try {
      const net = await fetch(event.request);
      if (net && net.ok) {
        (await caches.open(CACHE_NAME)).put(event.request, net.clone());
      }
      return net;
    } catch {
      // fallback simples: devolve index para navegação offline
      return caches.match('./index.html');
    }
  })());
});

// recebe mensagens da página para forçar atualização imediata
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'CHECK_VERSION' || type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
