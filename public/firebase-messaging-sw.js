// Script para rodar o Firebase Messaging em segundo plano (Browser Service Worker)
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

// Listener para exibir notificações quando o navegador estiver em segundo plano ou fechado
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificação em background:', payload);

  const notificationTitle = payload.notification.title || 'Lucas-Expresso';
  const notificationOptions = {
    body: payload.notification.body || 'Você recebeu uma nova atualização.',
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
