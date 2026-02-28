
'use client';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

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

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Registra o Service Worker explicitamente
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      // Espera o service worker estar pronto
      await navigator.serviceWorker.ready;

      // Obtém o Token único deste aparelho
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        const userDocRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        const existingToken = userDoc.data()?.fcmToken;

        // Salva o token no banco se for novo ou diferente
        if (existingToken !== currentToken) {
          await setDoc(userDocRef, { fcmToken: currentToken }, { merge: true });
          console.log('FCM: Aparelho registrado com sucesso! Token salvo no Firestore.');
        }
      } else {
        console.warn('FCM: Falha ao gerar token. Tente limpar o cache do navegador.');
      }
    } else {
      console.warn('FCM: Permissão de notificação negada. O campo fcmToken não será criado.');
    }
  } catch (err) {
    console.error('FCM: Erro crítico ao configurar push:', err);
  }
};
