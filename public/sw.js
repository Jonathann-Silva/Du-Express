
/**
 * Service Worker Oficial Du Express
 * Gerencia cache, atualizações instantâneas e notificações Push.
 */

const CACHE_NAME = 'duexpress-cache-v15';

self.addEventListener('install', (event) => {
  // Força a instalação imediata
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Assume o controle de todas as abas abertas imediatamente
  event.waitUntil(clients.claim());
});

// Listener para mensagens vindas da interface (como o botão de atualizar)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Estratégia de Fetch: Network First (Rede primeiro para garantir dados atualizados)
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// Listener de Notificações PUSH
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Du Express';
    const options = {
      body: data.body || 'Você tem uma nova notificação.',
      icon: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1&v=15',
      badge: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1&v=15',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      },
      // Remove o prefixo "from" no iOS
      tag: 'duexpress-notification',
      renotify: true
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('Erro ao processar notificação push:', e);
  }
});

// Ação ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
