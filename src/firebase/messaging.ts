'use client';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'; // Trocado updateDoc por setDoc

const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

export const requestPermissionAndSaveToken = async (userId: string) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !userId) {
    return;
  }

  try {
    const supported = await isSupported();
    if (!supported) return;
    
    const app = getApp();
    const firestore = getFirestore(app);
    const messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      
      await navigator.serviceWorker.ready;

      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        // CORREÇÃO CRÍTICA: setDoc + merge permite criar o Admin se ele não existir
        const userDocRef = doc(firestore, 'users', userId);
        
        await setDoc(userDocRef, { 
          fcmToken: currentToken,
          lastTokenUpdate: serverTimestamp(),
          // Se for o Admin e o documento for novo, ele entra como admin
          // Se já existir, o merge não deixará apagar os dados antigos
          status: 'online'
        }, { merge: true });
        
        console.log('FCM: fcmToken salvo/atualizado com sucesso para:', userId);

        onMessage(messaging, (payload) => {
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
    console.error('FCM Error:', err);
  }
};