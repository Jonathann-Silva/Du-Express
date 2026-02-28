'use client';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Chave pública para identificar seu projeto no serviço de push do navegador
const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

/**
 * Solicita permissão e salva o Token do aparelho no Firestore.
 * Essencial para que o sistema saiba para qual celular enviar a notificação.
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
      // 2. Registra o Service Worker (o "vigia" que roda com app fechado)
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      await navigator.serviceWorker.ready;

      // 3. Obtém o Token (o "endereço" único deste celular)
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        const userDocRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        const existingToken = userDoc.data()?.fcmToken;

        // 4. Salva no banco apenas se for um aparelho novo ou token mudou
        if (existingToken !== currentToken) {
          await setDoc(userDocRef, { fcmToken: currentToken }, { merge: true });
          console.log('FCM: Aparelho registrado com sucesso para notificações push.');
        }
      } else {
        console.warn('FCM: Não foi possível gerar o token. Verifique as configurações do navegador.');
      }
    } else {
      console.warn('FCM: Permissão de notificação negada pelo usuário.');
    }
  } catch (err) {
    console.error('FCM: Erro ao configurar notificações:', err);
  }
};
