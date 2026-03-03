// Scripts do Firebase compat (necessário para Service Workers)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Inicializa o Firebase no Service Worker
// IMPORTANTE: Estes valores devem ser idênticos aos do src/firebase/config.ts
firebase.initializeApp({
  apiKey: "AIzaSyBviQrq6B1yVM3SrEyrAnvpbcqyOwEj5KM",
  authDomain: "studio-7544233787-fa02d.firebaseapp.com",
  projectId: "studio-7544233787-fa02d",
  storageBucket: "studio-7544233787-fa02d.firebasestorage.app",
  messagingSenderId: "728368824438",
  appId: "1:728368824438:web:95f7473612d84de68d1f57"
});

const messaging = firebase.messaging();

// Este evento captura notificações quando o app está em SEGUNDO PLANO ou FECHADO
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano: ', payload);

  const notificationTitle = payload.notification.title || 'Lucas-Expresso';
  const notificationOptions = {
    body: payload.notification.body || 'Você tem uma nova atualização.',
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    data: payload.data // Permite passar links ou IDs
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Listener para quando o usuário clica na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Abre o app ou redireciona
  event.waitUntil(
    clients.openWindow('/')
  );
});
