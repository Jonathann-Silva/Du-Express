
'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { MobileLayout } from '@/components/MobileLayout';
import { CourierNav } from '@/components/nav/CourierNav';
import { useUser, useFirestore } from '@/firebase';
import { requestPermissionAndSaveToken } from '@/firebase/messaging';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function CourierLayout({ children }: { children: ReactNode }) {
  const { user, userProfile } = useUser();
  const firestore = useFirestore();
  const userRole = userProfile?.role;
  const isOnline = userProfile?.status === 'online';
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (user && userRole === 'courier') {
      // Solicita permissão de notificação
      requestPermissionAndSaveToken(user.uid);

      // Sincronização de localização em tempo real com THROTTLE agressivo (2 minutos)
      // Otimização para plano gratuito do Firebase: 40 usuários x 1 update/2min = 28.800 escritas/dia
      let watchId: number;
      
      // SÓ RASTREIA SE ESTIVER ONLINE
      if (navigator.geolocation && firestore && isOnline) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now();
            // Apenas atualiza se passou 2 minutos desde a última gravação (120.000ms)
            if (now - lastUpdateRef.current < 120000) return;
            
            lastUpdateRef.current = now;
            const userRef = doc(firestore, 'users', user.uid);
            updateDoc(userRef, {
              lastLocation: {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                updatedAt: serverTimestamp()
              }
            }).catch(() => {
                // Falha silenciosa para não atrapalhar a experiência
            });
          },
          (err) => console.warn("Erro ao rastrear localização GPS:", err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      }

      return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [user?.uid, userRole, firestore, isOnline]);

  return (
    <MobileLayout>
      {children}
      <CourierNav />
    </MobileLayout>
  );
}
