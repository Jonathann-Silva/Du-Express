'use server';

import webpush from 'web-push';

/**
 * Envia uma notificação push real para um dispositivo assinado.
 * As chaves VAPID são lidas das variáveis de ambiente (Vercel ou .env).
 */
export async function sendPushNotification(subscriptionJson: string, payload: { title: string; body: string; url?: string }) {
  if (!subscriptionJson) return { success: false, error: 'No subscription provided' };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  // Verifica se as chaves estão configuradas corretamente
  // A chave privada deve ter cerca de 43 caracteres em base64 para resultar em 32 bytes decodificados
  if (!publicKey || !privateKey || privateKey.length < 30) {
    console.warn('VAPID keys não configuradas corretamente na Vercel ou .env. Notificação ignorada.');
    return { success: false, error: 'VAPID keys not configured' };
  }

  try {
    // Configura os detalhes VAPID apenas no momento do envio para evitar crash no boot
    webpush.setVapidDetails(
      'mailto:suporte@lucasexpresso.com.br',
      publicKey,
      privateKey
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
