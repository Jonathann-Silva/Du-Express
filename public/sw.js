/**
 * Service Worker do Du Express
 * Responsável por receber e exibir notificações push em segundo plano.
 */

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      // Tenta interpretar a mensagem como JSON
      const data = event.data.json();
      
      const options = {
        body: data.body,
        icon: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1',
        badge: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/'
        },
        // Garante que a notificação substitua a anterior se for do mesmo tipo
        tag: data.url ? data.url : 'default-tag'
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'Du Express', options)
      );
    } catch (e) {
      // Fallback caso a mensagem não seja JSON
      event.waitUntil(
        self.registration.showNotification('Du Express', {
          body: event.data.text(),
          icon: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1'
        })
      );
    }
  }
});

// Abre o aplicativo na página correta ao clicar na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const targetUrl = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Se o app já estiver aberto, foca nele
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Força a atualização do Service Worker quando houver nova versão
self.addEventListener('install', () => {
  self.skipWaiting();
});
