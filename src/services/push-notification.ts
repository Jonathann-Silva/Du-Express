'use server';

import webpush from 'web-push';

/**
 * Envia uma notificação push real para um dispositivo assinado.
 * Estrutura o payload para evitar que o navegador adicione prefixos como "from".
 */
export async function sendPushNotification(subscriptionJson: string, payload: { title: string; body: string; url?: string }) {
  if (!subscriptionJson) return { success: false, error: 'No subscription provided' };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.error('ERRO CRÍTICO: Chaves VAPID não configuradas no servidor.');
    return { success: false, error: 'VAPID keys not configured' };
  }

  try {
    webpush.setVapidDetails(
      'mailto:suporte@duexpress.com.br',
      publicKey,
      privateKey
    );

    const subscription = JSON.parse(subscriptionJson);
    
    // O payload é enviado como JSON puro para que o sw.js o processe corretamente
    const response = await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url
      })
    );
    
    return { success: true, status: response.statusCode };
  } catch (error: any) {
    console.error('Erro ao enviar Webpush:', error.message);
    return { success: false, error: error.message, statusCode: error.statusCode };
  }
}
