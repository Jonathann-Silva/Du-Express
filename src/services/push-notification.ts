'use server';

import webpush from 'web-push';

/**
 * Envia uma notificação push real para um dispositivo assinado.
 * As chaves VAPID são lidas das variáveis de ambiente.
 */
export async function sendPushNotification(subscriptionJson: string, payload: { title: string; body: string; url?: string }) {
  if (!subscriptionJson) return { success: false, error: 'No subscription provided' };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  // Verifica se as chaves estão configuradas corretamente no servidor
  if (!publicKey || !privateKey) {
    console.error('ERRO CRÍTICO: Chaves VAPID não configuradas no servidor (.env).');
    return { success: false, error: 'VAPID keys not configured' };
  }

  try {
    webpush.setVapidDetails(
      'mailto:suporte@duexpress.com.br',
      publicKey,
      privateKey
    );

    const subscription = JSON.parse(subscriptionJson);
    
    // O payload deve ser uma string JSON que o Service Worker possa interpretar
    const response = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    
    console.log('Webpush enviado com sucesso para o dispositivo.');
    return { success: true, status: response.statusCode };
  } catch (error: any) {
    console.error('Erro ao enviar Webpush:', error.message);
    // Se o erro for 410 (Gone) ou 404 (Not Found), a assinatura expirou ou é inválida
    return { success: false, error: error.message, statusCode: error.statusCode };
  }
}
