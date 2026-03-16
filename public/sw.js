/**
 * Service Worker do Du Express
 * Responsável por receber e exibir notificações Push em segundo plano.
 */

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = JSON.parse(event.data.text());
      const options = {
        body: data.body,
        icon: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1',
        badge: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/'
        },
        actions: [
          { action: 'open', title: 'Abrir App' }
        ]
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'Du Express', options)
      );
    } catch (e) {
      console.error('Erro ao processar push data:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
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

// Força a atualização do SW imediatamente
self.addEventListener('install', () => self.skipWaiting());
