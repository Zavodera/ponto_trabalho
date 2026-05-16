// ─── SERVICE WORKER — PontiFy (github.io/pontify) ─────────
const VERSION = 'v4.9.2';
const CACHE   = `pontify-${VERSION}`;

const ASSETS = [
  './index.html',
  './manifest.json',
  // './abertura.json', // Lottie desativado temporariamente
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log(`[SW] Instalando ${CACHE}`);
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] Alguns assets não foram cacheados:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa TODOS os caches antigos ──────────────
self.addEventListener('activate', event => {
  console.log(`[SW] Ativando ${CACHE}`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => {
            console.log(`[SW] Removendo cache antigo: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first para HTML, cache-first para assets ──
self.addEventListener('fetch', event => {
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.url.includes('googleapis.com')) return;
  if (event.request.url.includes('jsdelivr.net')) return;

  const isHTML = event.request.destination === 'document'
    || event.request.url.endsWith('.html')
    || event.request.url.endsWith('/');

  if (isHTML) {
    // HTML: Network-first — sempre tenta buscar versão nova
    // Se falhar (offline), usa cache
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        console.log('[SW] Offline, servindo HTML do cache');
        return caches.match('./index.html');
      })
    );
  } else {
    // Outros assets (JS, CSS, fontes): Cache-first
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => null);
      })
    );
  }
});

// ── MENSAGEM: força atualização ──────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
