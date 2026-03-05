
'use server';

import webpush from 'web-push';

// Chaves VAPID (Devem ser as mesmas do messaging.ts)
const VAPID_PUBLIC_KEY = 'BEl62fvEocDi_9guS2g6DBJXPJ6Ouu79No7Adn7SJreiaS-MBoYp97mST9rd5qcJubBen97Isrf8M2VAt9qh_As';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'PLACEHOLDER_PRIVATE_KEY'; // Você deve gerar uma real e colocar no .env

webpush.setVapidDetails(
  'mailto:suporte@lucasexpresso.com.br',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export async function sendPushNotification(subscriptionJson: string, payload: { title: string; body: string; url?: string }) {
  if (!subscriptionJson) return;

  try {
    const subscription = JSON.parse(subscriptionJson);
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar Webpush:', error);
    return { success: false, error };
  }
}
