// Service Worker para Webpush nativo - Lucas Expresso
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const options = {
        body: data.body || 'Nova atualização do sistema',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
        badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
        vibrate: [200, 100, 200],
        tag: 'lucas-expresso-notif',
        renotify: true,
        data: {
          url: data.url || '/'
        },
        actions: [
          { action: 'open', title: 'Abrir Aplicativo' }
        ]
      };

      // O título da notificação será priorizado como o enviado pelo servidor,
      // ou o nome da marca 'Lucas Expresso' como fallback.
      event.waitUntil(
        self.registration.showNotification(data.title || 'Lucas Expresso', options)
      );
    } catch (e) {
      console.error('Erro ao processar dados do Push:', e);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já houver uma janela aberta, foca nela e navega
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(urlToOpen));
        }
      }
      // Se não, abre uma nova
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
