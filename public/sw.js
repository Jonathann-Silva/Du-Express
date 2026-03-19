/**
 * Service Worker do Du Express
 * Versão: 1.0.1 (Força atualização)
 */

const CACHE_NAME = 'duexpress-cache-v1';

// Quando o novo Service Worker é instalado, ele pula a espera e assume o controle
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpa caches antigos se necessário e assume o controle das abas abertas
  event.waitUntil(clients.claim());
});

// Intercepta mensagens do componente React (PWAUpdater)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Lógica para notificações Push (Webpush)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1&v=15',
      badge: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1&v=15',
      data: {
        url: data.url || '/'
      },
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'Ver Agora' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Du Express', options)
    );
  } catch (e) {
    console.error('Erro ao processar notificação push:', e);
  }
});

// Ao clicar na notificação, abre o app na URL enviada
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
