
// Service Worker para Du Express - Gerenciamento de Notificações Push
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1',
        badge: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/'
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'Du Express', options)
      );
    } catch (e) {
      console.error('Erro ao processar payload da notificação:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Força a atualização do SW imediatamente
self.addEventListener('install', () => self.skipWaiting());
