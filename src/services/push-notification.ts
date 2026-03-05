
'use server';

import webpush from 'web-push';

// Chave Pública VAPID (Deve ser a mesma do messaging.ts)
const VAPID_PUBLIC_KEY = 'BEl62fvEocDi_9guS2g6DBJXPJ6Ouu79No7Adn7SJreiaS-MBoYp97mST9rd5qcJubBen97Isrf8M2VAt9qh_As';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

/**
 * Envia uma notificação push real para um dispositivo assinado.
 * As chaves VAPID devem ser configuradas no servidor.
 */
export async function sendPushNotification(subscriptionJson: string, payload: { title: string; body: string; url?: string }) {
  if (!subscriptionJson) return { success: false, error: 'No subscription provided' };

  // Verifica se as chaves estão configuradas para evitar erro 500 no NextJS
  if (!VAPID_PRIVATE_KEY || VAPID_PRIVATE_KEY.length < 20) {
    console.warn('VAPID_PRIVATE_KEY não configurada. Notificação Push ignorada.');
    return { success: false, error: 'VAPID keys not configured' };
  }

  try {
    // Inicializa o web-push dentro da função para evitar crash no boot do app
    webpush.setVapidDetails(
      'mailto:suporte@lucasexpresso.com.br',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const subscription = JSON.parse(subscriptionJson);
    
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao enviar Webpush:', error.message);
    return { success: false, error: error.message };
  }
}
