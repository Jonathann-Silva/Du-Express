
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuração idêntica ao src/firebase/config.ts
firebase.initializeApp({
  apiKey: "AIzaSyBviQrq6B1yVM3SrEyrAnvpbcqyOwEj5KM",
  authDomain: "studio-7544233787-fa02d.firebaseapp.com",
  projectId: "studio-7544233787-fa02d",
  storageBucket: "studio-7544233787-fa02d.firebasestorage.app",
  messagingSenderId: "728368824438",
  appId: "1:728368824438:web:95f7473612d84de68d1f57"
});

const messaging = firebase.messaging();

// Este evento captura a notificação quando o app está FECHADO ou em SEGUNDO PLANO
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificação em segundo plano recebida: ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.link || '/'
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Ao clicar na notificação com o app fechado, ele abre o site na página correta
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
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
