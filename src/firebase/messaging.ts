'use client';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const requestPermissionAndSaveToken = async (userId: string) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !userId) {
    console.warn('Webpush: Navegador não suportado ou ID de usuário ausente.');
    return;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('Webpush ERROR: NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada no ambiente.');
    return;
  }

  try {
    console.log('Webpush: Solicitando permissão...');
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      await navigator.serviceWorker.ready;
      console.log('Webpush: Service Worker pronto.');

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      
      if (subscription) {
        const firestore = getFirestore(getApp());
        const userDocRef = doc(firestore, 'users', userId);
        
        await setDoc(userDocRef, { 
          pushSubscription: JSON.stringify(subscription),
          fcmToken: 'webpush_active',
          lastTokenUpdate: serverTimestamp(),
        }, { merge: true });
        
        console.log('Webpush: Assinatura salva no Firestore para:', userId);
        return true;
      }
    } else {
      console.warn('Webpush: Permissão negada pelo usuário.');
    }
  } catch (err) {
    console.error('Webpush: Erro fatal no registro:', err);
  }
  return false;
};
