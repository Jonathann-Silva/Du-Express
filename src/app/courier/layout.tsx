
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
      // Solicita permissão de notificação Webpush
      requestPermissionAndSaveToken(user.uid);

      // --- OTIMIZAÇÃO PARA PLANO SPARK ---
      // Sincronização de localização com THROTTLE agressivo (2 minutos)
      // Cálculo: 15 motoboys x 30 updates/hora (1 a cada 2min) x 10h = 4.500 escritas.
      // Isso mantém o app dentro do limite de 20.000 escritas gratuitas/dia.
      
      let watchId: number;
      
      if (navigator.geolocation && firestore && isOnline) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now();
            // Apenas grava no banco se passou 2 minutos (120.000ms) desde a última atualização
            if (now - lastUpdateRef.current < 120000) return;
            
            lastUpdateRef.current = now;
            const userRef = doc(firestore, 'users', user.uid);
            
            // Gravação não bloqueante (Background)
            updateDoc(userRef, {
              lastLocation: {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                updatedAt: serverTimestamp()
              }
            }).catch(() => {
                // Falha silenciosa para economizar recursos de erro
            });
          },
          (err) => console.warn("GPS Throttled:", err),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 90000 }
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
