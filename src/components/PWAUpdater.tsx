
'use client';

import { useEffect } from 'react';

/**
 * Componente invisível que monitora atualizações do Service Worker.
 * Se uma nova versão for detectada e ativada, ele recarrega a página.
 */
export function PWAUpdater() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // 1. Monitora quando um novo Service Worker assume o controle
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      // Recarrega a página para aplicar as mudanças do servidor
      window.location.reload();
    });

    // 2. Tenta registrar/atualizar o Service Worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        // Verifica atualizações a cada 5 minutos enquanto o app estiver aberto
        setInterval(() => {
          registration.update();
        }, 1000 * 60 * 5);

        // Se encontrar uma atualização esperando, força o skipWaiting
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão instalada, avisa para pular a espera
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      } catch (err) {
        console.error('Erro ao registrar Service Worker:', err);
      }
    };

    registerSW();
  }, []);

  return null; // Componente não renderiza nada visualmente
}
