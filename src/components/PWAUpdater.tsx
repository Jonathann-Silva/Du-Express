
'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
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
        // Registra o Service Worker
        const reg = await navigator.serviceWorker.register('/sw.js');
        setRegistration(reg);

        // Verifica atualizações a cada 5 minutos
        const interval = setInterval(() => {
          reg.update();
        }, 1000 * 60 * 5);

        // Se já houver uma atualização esperando (em cache), mostra o aviso
        if (reg.waiting) {
          setShowUpdateBar(true);
        }

        // Monitora novas atualizações que chegarem enquanto o app está aberto
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão baixada e pronta para ser ativada
                setShowUpdateBar(true);
              }
            });
          }
        });

        return () => clearInterval(interval);
      } catch (err) {
        console.error('Erro ao registrar Service Worker:', err);
      }
    };

    registerSW();

    // Quando o novo Service Worker assume o controle, recarrega a página
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Envia mensagem para o SW pular a espera e ativar imediatamente
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: força reload se algo falhar
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
