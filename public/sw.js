// Service Worker para Du Express - Gerenciamento de Notificações Push
self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1',
        badge: 'https://www.dropbox.com/scl/fi/j4dmyf2di1bmkgt0sba7l/2026-03-16-09-00-23.png?rlkey=zgeougxi0yha49jg3aejdxkes&st=124je16z&raw=1',
        vibrate: [200, 100, 200],
        tag: 'du-express-notification',
        renotify: true,
        data: {
          url: data.url || '/'
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'Du Express', options)
      );
    } catch (e) {
      console.error('Erro ao processar evento de push:', e);
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já houver uma aba aberta com essa URL, foca nela
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
