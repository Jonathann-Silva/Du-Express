'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Componente que monitora atualizações do Service Worker e exibe um Pop-up
 * amigável para o usuário atualizar o app sem precisar reinstalar.
 */
export function PWAUpdater() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showUpdateBar, setShowUpdateBar] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        // Registra o Service Worker (o arquivo sw.js deve estar em public/sw.js)
        const reg = await navigator.serviceWorker.register('/sw.js');
        setRegistration(reg);

        console.log('PWA: Service Worker registrado com sucesso.');

        // Se o navegador detectar que já existe um worker esperando (uma atualização antiga não aplicada)
        if (reg.waiting) {
          console.log('PWA: Existe uma atualização aguardando ativação.');
          setShowUpdateBar(true);
        }

        // Monitora novas atualizações enquanto o app está aberto
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão foi baixada e está pronta (installed)
                console.log('PWA: Nova versão baixada e pronta para uso.');
                setShowUpdateBar(true);
              }
            });
          }
        });

        // Verifica manualmente por atualizações a cada 2 minutos
        const interval = setInterval(() => {
          reg.update();
        }, 1000 * 60 * 2);

        return () => clearInterval(interval);
      } catch (err) {
        console.error('PWA: Erro ao registrar Service Worker:', err);
      }
    };

    registerSW();

    // Evento disparado quando o novo SW assume o controle (após o skipWaiting)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('PWA: Novo Service Worker assumiu o controle. Recarregando...');
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Envia mensagem para o Service Worker (sw.js) avisando para ignorar o tempo de espera
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: força o reload manual se não houver worker esperando
      window.location.reload();
    }
  };

  if (!showUpdateBar) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999] animate-in slide-in-from-top-full duration-500 max-w-md mx-auto pointer-events-none">
      <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl border-2 border-white/20 flex items-center gap-4 pointer-events-auto ring-1 ring-black/10">
        <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="animate-pulse size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Nova Versão Disponível!</p>
          <p className="text-[10px] opacity-90 font-medium mt-0.5">Toque para atualizar seu Du Express agora.</p>
        </div>
        <Button 
          size="sm" 
          variant="secondary" 
          className="rounded-xl font-black gap-2 px-4 h-10 shadow-lg active:scale-95 transition-all bg-white text-primary hover:bg-white/90"
          onClick={handleUpdate}
        >
          <RefreshCw size={14} />
          ATUALIZAR
        </Button>
      </div>
    </div>
  );
}
