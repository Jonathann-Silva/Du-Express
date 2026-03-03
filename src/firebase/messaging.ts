'use client';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Chave VAPID pública do seu projeto Firebase
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

    // 1. Pede permissão ao usuário
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // 2. Registra o Service Worker essencial para o token ser gerado
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      
      await navigator.serviceWorker.ready;

      // 3. Gera o token único do aparelho
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        // 4. SALVA NO FIRESTORE (Campo fcmToken)
        // Usamos updateDoc para APENAS ADICIONAR o token, sem apagar o resto (role, address, etc)
        const userDocRef = doc(firestore, 'users', userId);
        
        await updateDoc(userDocRef, { 
          fcmToken: currentToken,
          lastTokenUpdate: serverTimestamp()
        });
        
        console.log('FCM: fcmToken salvo com sucesso para:', userId);

        // Listener para quando o usuário está com o site aberto
        onMessage(messaging, (payload) => {
          console.log('FCM: Foreground message:', payload);
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
