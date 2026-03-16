'use client';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';

// Chave VAPID pública para o Webpush
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

/**
 * Solicita permissão e salva a assinatura de push no Firestore.
 */
export const requestPermissionAndSaveToken = async (userId: string) => {
  if (typeof window === 'undefined') return false;

  if (!('serviceWorker' in navigator)) {
    console.warn('Webpush: Service Workers não são suportados neste navegador.');
    return false;
  }

  if (!userId) {
    console.warn('Webpush: Falha no registro - ID de usuário não fornecido.');
    return false;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn('Webpush: NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada. O registro será ignorado.');
    return false;
  }

  try {
    console.log('Webpush: Iniciando processo de registro para:', userId);
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      await navigator.serviceWorker.ready;
      
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
        
        console.log('Webpush: Dispositivo registrado com sucesso no Firestore.');
        return true;
      }
    } else {
      console.warn('Webpush: Permissão negada pelo usuário.');
    }
  } catch (err) {
    console.error('Webpush: Erro crítico ao registrar assinatura:', err);
  }
  return false;
};
