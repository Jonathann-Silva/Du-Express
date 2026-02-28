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

    // Solicita permissão de forma explícita
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Registra o Service Worker (arquivo em /public/firebase-messaging-sw.js)
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      // Garante que o Service Worker está pronto
      await navigator.serviceWorker.ready;

      // Obtém o Token único deste aparelho
      // Nota: Em iOS, isso requer que o site seja "Adicionado à Tela de Início"
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
          console.log('FCM: Aparelho registrado para notificações em segundo plano.');
        }
      } else {
        console.warn('FCM: Falha ao gerar token de registro. Tente limpar os dados do site.');
      }
    } else {
      console.warn('FCM: Permissão de notificação negada pelo usuário.');
    }
  } catch (err) {
    console.error('FCM: Erro crítico ao configurar push:', err);
  }
};
