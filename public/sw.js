/* eslint-disable no-restricted-globals */

// Service Worker para Lucas Expresso
// Responsável por garantir que o app possa ser atualizado e tenha capacidades offline básicas.

const CACHE_NAME = 'lucas-expresso-cache-v1';

// Ativa o novo service worker imediatamente após a instalação
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Assume o controle de todas as abas abertas imediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Estratégia de busca: Network First
// Tenta buscar na rede primeiro, se falhar (offline), tenta o cache.
// Isso garante que o usuário sempre veja a versão mais recente quando online.
self.addEventListener('fetch', (event) => {
  // Ignora requisições de API, Firebase e WebSockets (GPS)
  if (
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebasestorage.googleapis.com') ||
    event.request.url.includes('identitytoolkit.googleapis.com') ||
    event.request.url.includes('socket.io')
  ) {
    return;
  }

  // Estratégia Network First
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, clonamos e guardamos no cache apenas requisições GET
        if (event.request.method === 'GET' && response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tenta o cache
        return caches.match(event.request);
      })
  );
});

// Escuta mensagens do componente React (PWAUpdater)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
