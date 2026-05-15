// ─── SERVICE WORKER — Ponto de Trabalho ───────────────────
// Mude a versão aqui sempre que fizer uma atualização!
// Isso garante que todos os usuários recebam a versão nova.
const VERSION = 'v3.4.0';
const CACHE   = `pontify-${VERSION}`;

// Arquivos que serão cacheados para funcionar offline
const ASSETS = [
  './index.html',
  './manifest.json',
  './abertura.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ── INSTALL: cacheia os arquivos na primeira vez ──────────
self.addEventListener('install', event => {
  console.log(`[SW] Instalando ${CACHE}`);
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        // CDN assets podem falhar offline — não bloqueia a instalação
        console.warn('[SW] Alguns assets não foram cacheados:', err);
      });
    }).then(() => self.skipWaiting()) // Ativa imediatamente sem esperar
  );
});

// ── ACTIVATE: remove caches antigos ──────────────────────
self.addEventListener('activate', event => {
  console.log(`[SW] Ativando ${CACHE}`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => (key.startsWith('pontify-') || key.startsWith('ponto-')) && key !== CACHE)
          .map(key => {
            console.log(`[SW] Removendo cache antigo: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // Assume controle de todas as abas abertas
  );
});

// ── FETCH: serve do cache, busca na rede se não tiver ────
self.addEventListener('fetch', event => {
  // Ignora requisições ao Supabase (sempre precisam da rede)
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Não está no cache: busca na rede e cacheia
      return fetch(event.request).then(response => {
        // Só cacheia respostas válidas
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline e não está no cache: retorna o index.html como fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── MENSAGEM: força atualização quando o app pedir ───────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
