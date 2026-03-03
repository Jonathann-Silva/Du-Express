'use client';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

export const requestPermissionAndSaveToken = async (userId: string) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const supported = await isSupported();
    if (!supported) return;
    
    const app = getApp();
    const firestore = getFirestore(app);
    const messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;

      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        const userDocRef = doc(firestore, 'users', userId);
        await setDoc(userDocRef, { fcmToken: currentToken }, { merge: true });
        console.log('FCM: Token registrado com sucesso:', currentToken);

        onMessage(messaging, (payload) => {
          console.log('Mensagem em primeiro plano:', payload);
          new Notification(payload.notification?.title || 'Lucas-Expresso', {
            body: payload.notification?.body,
            icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s'
          });
        });
      }
    } else {
      console.warn('FCM: Permissão de notificação negada.');
    }
  } catch (err) {
    console.error('FCM: Erro crítico na configuração:', err);
  }
};
