
'use client';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getApp } from 'firebase/app';

// Chave Pública VAPID (Deve ser a mesma do push-notification.ts)
const VAPID_PUBLIC_KEY = 'BEl62fvEocDi_9guS2g6DBJXPJ6Ouu79No7Adn7SJreiaS-MBoYp97mST9rd5qcJubBen97Isrf8M2VAt9qh_As';

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
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Registra o Service Worker (sw.js na pasta public)
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      await navigator.serviceWorker.ready;

      // Subscreve o usuário para receber notificações push nativas do navegador
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      
      if (subscription) {
        const firestore = getFirestore(getApp());
        const userDocRef = doc(firestore, 'users', userId);
        
        // Salva a assinatura completa no Firestore
        await setDoc(userDocRef, { 
          pushSubscription: JSON.stringify(subscription),
          fcmToken: 'webpush_active', // Marcador para o sistema saber que este usuário aceitou push
          lastTokenUpdate: serverTimestamp(),
        }, { merge: true });
        
        console.log('Webpush registrado com sucesso para:', userId);
      }
    }
  } catch (err) {
    console.error('Erro no registro de Webpush:', err);
  }
};
