'use client';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Sua Chave VAPID do Console do Firebase
const VAPID_KEY = 'BIiPXefnrJB_RH2iDZNKlvJXUTUFaHNWPkgdqv4WRYSMB7OvzX_GPf0WylTwE23_uYwcDsRAFpijfDi0tE4gEhg';

export const requestPermissionAndSaveToken = async (userId: string) => {
  // 1. Verificações de segurança iniciais
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !userId) {
    console.warn('FCM: Ambiente não suportado ou usuário não logado.');
    return;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      console.error('FCM: Notificações não suportadas neste navegador.');
      return;
    }
    
    const app = getApp();
    const firestore = getFirestore(app);
    const messaging = getMessaging(app);

    // 2. Solicita permissão ao usuário (O balão do iOS/Android)
    const permission = await Notification.requestPermission();
    console.log('FCM: Permissão:', permission);
    
    if (permission === 'granted') {
      // 3. Registro do Service Worker (Essencial para o app fechado)
      // O 'updateViaCache: none' força o iPhone a pegar a versão mais nova do script
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        updateViaCache: 'none'
      });
      
      // Aguarda o Service Worker estar pronto e controlando a página
      const activeRegistration = await navigator.serviceWorker.ready;

      // 4. Geração do Token Único (Endereço do seu iPhone)
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: activeRegistration,
        vapidKey: VAPID_KEY
      });
      
      if (currentToken) {
        console.log('FCM: Token gerado:', currentToken);

        // 5. SALVAMENTO NO FIRESTORE (O Pulo do Gato para o Admin)
        // Usamos setDoc com merge: true para CRIAR o registro caso ele não exista
        const userDocRef = doc(firestore, 'users', userId);
        
        await setDoc(userDocRef, { 
          fcmToken: currentToken,
          role: 'admin', // Garante que você seja identificado como admin
          lastTokenUpdate: new Date().toISOString(),
          status: 'online' 
        }, { merge: true });
        
        console.log('FCM: Token salvo com sucesso no Firestore para o UID:', userId);

        // 6. Handler para mensagens com o APP ABERTO
        onMessage(messaging, (payload) => {
          console.log('FCM: Mensagem em primeiro plano:', payload);
          
          // Mostra notificação nativa mesmo com o app aberto
          new Notification(payload.notification?.title || 'Lucas-Expresso', {
            body: payload.notification?.body || 'Nova atualização no sistema.',
            icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s'
          });
        });

      } else {
        console.warn('FCM: Falha ao obter o Token. Verifique as configurações do Firebase.');
      }
    } else {
      console.warn('FCM: Permissão de notificação negada.');
    }
  } catch (err) {
    console.error('FCM: Erro crítico na configuração:', err);
  }
};