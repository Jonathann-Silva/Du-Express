'use client';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Chave pública VAPID (essencial para navegadores Chrome/Safari)
const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

/**
 * Solicita permissão de notificação e registra o token do dispositivo no Firestore do usuário.
 */
export const requestPermissionAndSaveToken = async (userId: string) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('FCM: Notificações push não são suportadas neste navegador.');
      return;
    }
    
    const app = getApp();
    const firestore = getFirestore(app);
    const messaging = getMessaging(app);

    // 1. Pede permissão ao usuário
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // 2. Registra o Service Worker explicitamente
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      // Aguarda o SW estar pronto
      await navigator.serviceWorker.ready;

      // 3. Obtém o Token Único do Aparelho (FCM Token)
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        // 4. SALVA O TOKEN NO DOCUMENTO DO USUÁRIO NO FIRESTORE
        const userDocRef = doc(firestore, 'users', userId);
        await setDoc(userDocRef, { fcmToken: currentToken }, { merge: true });
        console.log('FCM: Token registrado e salvo no Firestore:', currentToken);

        // Handler para mensagens enquanto o app está aberto (foreground)
        onMessage(messaging, (payload) => {
          console.log('FCM: Mensagem recebida em primeiro plano:', payload);
          // Opcional: mostrar um alerta customizado aqui ou usar a notificação nativa
          new Notification(payload.notification?.title || 'Lucas-Expresso', {
            body: payload.notification?.body,
            icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s'
          });
        });
      } else {
        console.warn('FCM: Nenhum token de registro disponível. Verifique as permissões.');
      }
    } else {
      console.warn('FCM: Permissão de notificação negada pelo usuário.');
    }
  } catch (err) {
    console.error('FCM: Erro ao configurar notificações push:', err);
  }
};
