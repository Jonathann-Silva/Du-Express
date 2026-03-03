
'use client';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Chave pública (VAPID) configurada no console do Firebase
const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

/**
 * Registra o dispositivo no Firebase para receber Push Notifications.
 */
export const requestPermissionAndSaveToken = async (userId: string) => {
  if (typeof window === 'undefined') return;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('FCM: Notificações não suportadas neste navegador.');
      return;
    }
    
    const app = getApp();
    const firestore = getFirestore(app);
    const messaging = getMessaging(app);

    // 1. Solicita permissão ao usuário
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // 2. Registra o Service Worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      await navigator.serviceWorker.ready;

      // 3. Obtém o Token único do dispositivo
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        const userDocRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        const existingToken = userDoc.data()?.fcmToken;

        // 4. Salva no Firestore se for novo ou tiver mudado
        if (existingToken !== currentToken) {
          await setDoc(userDocRef, { fcmToken: currentToken }, { merge: true });
          console.log('FCM: Dispositivo registrado para Push Notifications.');
        }

        // Listener para quando o app está ABERTO (primeiro plano)
        onMessage(messaging, (payload) => {
          console.log('Mensagem recebida em primeiro plano:', payload);
          // Opcional: Mostrar um toast customizado aqui
          if (Notification.permission === 'granted') {
            new Notification(payload.notification?.title || 'Nova Notificação', {
              body: payload.notification?.body,
              icon: '/icon-192x192.png'
            });
          }
        });

      } else {
        console.warn('FCM: Não foi possível gerar o token.');
      }
    } else {
      console.warn('FCM: Permissão negada pelo usuário.');
    }
  } catch (err) {
    console.error('FCM: Erro na configuração:', err);
  }
};
