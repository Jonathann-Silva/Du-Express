'use client';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';

// Chave VAPID pública para o Webpush
// Deve ser configurada no arquivo .env como NEXT_PUBLIC_VAPID_PUBLIC_KEY
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
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !userId) {
    console.warn('Webpush: Ambiente não suportado (não é browser ou sem ID).');
    return false;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('Webpush ERROR: NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada no .env');
    return false;
  }

  try {
    console.log('Webpush: Verificando permissões...');
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Registra/Recupera o Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      await navigator.serviceWorker.ready;
      console.log('Webpush: Service Worker está pronto.');

      // Inscreve o usuário no serviço de Push do navegador
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      
      if (subscription) {
        const firestore = getFirestore(getApp());
        const userDocRef = doc(firestore, 'users', userId);
        
        // Salva a assinatura como string no Firestore para o servidor usar depois
        await setDoc(userDocRef, { 
          pushSubscription: JSON.stringify(subscription),
          fcmToken: 'webpush_active',
          lastTokenUpdate: serverTimestamp(),
        }, { merge: true });
        
        console.log('Webpush: Dispositivo registrado com sucesso para:', userId);
        return true;
      }
    } else {
      console.warn('Webpush: Permissão de notificação negada pelo usuário.');
    }
  } catch (err) {
    console.error('Webpush: Falha crítica no registro:', err);
  }
  return false;
};
