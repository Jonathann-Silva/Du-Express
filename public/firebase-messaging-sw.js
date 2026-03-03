importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBviQrq6B1yVM3SrEyrAnvpbcqyOwEj5KM",
  authDomain: "studio-7544233787-fa02d.firebaseapp.com",
  projectId: "studio-7544233787-fa02d",
  storageBucket: "studio-7544233787-fa02d.firebasestorage.app",
  messagingSenderId: "728368824438",
  appId: "1:728368824438:web:95f7473612d84de68d1f57"
});

const messaging = firebase.messaging();

// Este evento é o que garante que o navegador "acorde" para mostrar a notificação
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensagem recebida em segundo plano:', payload);

  // Se o payload vier vazio ou sem a parte de notification, a gente extrai do data
  const title = payload.notification?.title || payload.data?.title || "Lucas-Expresso";
  const options = {
    body: payload.notification?.body || payload.data?.body || "Nova atualização disponível.",
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    vibrate: [200, 100, 200],
    tag: 'lucas-expresso-notif',
    renotify: true, // Faz o celular vibrar de novo se chegar outra
    data: {
      url: payload.data?.link || '/'
    }
  };

  // Linha vital: força a exibição no sistema operacional
  return self.registration.showNotification(title, options);
});

// Listener para cliques: abre o app ou foca na aba já aberta
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se o app já estiver aberto, foca nele
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Se estiver fechado, abre uma nova janela/instância do PWA
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});