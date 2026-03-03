'use client';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

export const requestPermissionAndSaveToken = async (userId: string) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !userId) return;

  try {
    const supported = await isSupported();
    if (!supported) return;
    
    const app = getApp();
    const firestore = getFirestore(app);
    const messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // AJUSTE: Forçamos a atualização do Service Worker se houver mudanças
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        updateViaCache: 'none'
      });
      
      // AJUSTE: Garantimos que o SW está ativo e "controlando" a página
      const activeRegistration = await navigator.serviceWorker.ready;

      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: activeRegistration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        const userDocRef = doc(firestore, 'users', userId);
        
        // Mantemos o seu merge:true que é excelente para o Admin
        await setDoc(userDocRef, { 
          fcmToken: currentToken,
          lastTokenUpdate: new Date().toISOString(),
          status: 'online' 
        }, { merge: true });
        
        console.log('FCM: Token registrado para UID:', userId);

        onMessage(messaging, (payload) => {
          console.log('FCM: Foreground message', payload);
          // Notificação nativa para quando o app está aberto
          if (Notification.permission === 'granted') {
             new Notification(payload.notification?.title || 'Lucas-Expresso', {
               body: payload.notification?.body,
               icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s'
             });
          }
        });
      }
    }
  } catch (err) {
    console.error('FCM: Erro ao configurar:', err);
  }
};