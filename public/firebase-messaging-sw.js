// Arquivo essencial para notificações push em segundo plano (app fechado)
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

// Listener para mensagens recebidas enquanto o app está totalmente fechado
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano: ', payload);
  
  const notificationTitle = payload.notification.title || "Nova Atualização";
  const notificationOptions = {
    body: payload.notification.body || "Você tem uma nova mensagem do Lucas-Expresso.",
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    tag: 'delivery-update',
    renotify: true,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
