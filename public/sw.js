
/**
 * @fileOverview Service Worker para Lucas-Expresso
 * Gerencia cache e atualizações automáticas.
 * Versão: 0.0.9-t
 */

// Força a nova versão a se tornar ativa imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Garante que o novo Service Worker assuma o controle de todas as abas abertas
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Listener para mensagens (útil para debug ou comandos manuais)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Cache básico para funcionamento PWA (pode ser expandido conforme necessidade)
self.addEventListener('fetch', (event) => {
  // Estratégia: Network First (prioriza rede para logística em tempo real)
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
