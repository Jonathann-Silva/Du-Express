'use client';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

export const requestPermissionAndSaveToken = async (userId: string) => {
  if (typeof window === 'undefined') return;

  try {
    const supported = await isSupported();
    if (!supported) return;
    
    const app = getApp();
    const firestore = getFirestore(app);
    const messaging = getMessaging(app);

    // 1. Solicita permissão (O iOS exige que isso venha de um clique do usuário)
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // 2. Registro do Service Worker otimizado para PWAs
      // Removi o scope: '/' para evitar conflitos de rota no iOS
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      // Aguarda o SW estar pronto e ativo
      await navigator.serviceWorker.ready;

      // 3. Obtém o Token
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        // 4. Salva no Firestore (Simplifiquei a lógica para garantir o update)
        const userDocRef = doc(firestore, 'users', userId);
        await setDoc(userDocRef, { fcmToken: currentToken }, { merge: true });
        console.log('FCM: Token registrado com sucesso.');

        // 5. Listener para quando o app está ABERTO
        onMessage(messaging, (payload) => {
          console.log('Mensagem em primeiro plano:', payload);
          // O navegador não mostra notificação nativa se o app estiver aberto, 
          // a menos que você force como abaixo:
          new Notification(payload.notification?.title || 'Lucas-Expresso', {
            body: payload.notification?.body,
            icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s'
          });
        });

      }
    }
  } catch (err) {
    console.error('FCM: Erro crítico na configuração:', err);
  }
};