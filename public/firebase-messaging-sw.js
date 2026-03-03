// scripts necessários para o Firebase Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuração idêntica à do seu projeto
firebase.initializeApp({
  apiKey: "AIzaSyBviQrq6B1yVM3SrEyrAnvpbcqyOwEj5KM",
  authDomain: "studio-7544233787-fa02d.firebaseapp.com",
  projectId: "studio-7544233787-fa02d",
  storageBucket: "studio-7544233787-fa02d.firebasestorage.app",
  messagingSenderId: "728368824438",
  appId: "1:728368824438:web:95f7473612d84de68d1f57"
});

const messaging = firebase.messaging();

// Lógica para lidar com mensagens recebidas com APP MINIMIZADO OU FECHADO
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em background: ', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'Lucas-Expresso';
  const body = payload.notification?.body || payload.data?.body || 'Novo pedido recebido!';
  
  const notificationOptions = {
    body: body,
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
    tag: 'lucas-expresso-notificacao',
    renotify: true,
    data: {
      url: payload.data?.link || '/'
    }
  };

  // O 'return' é OBRIGATÓRIO para o iOS não ignorar a notificação
  return self.registration.showNotification(title, notificationOptions);
});

// Listener para abrir o app ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});