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
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (user && userRole === 'courier') {
      // Solicita permissão de notificação
      requestPermissionAndSaveToken(user.uid);

      // Sincronização de localização em tempo real com THROTTLE (30 segundos)
      // Isso reduz drasticamente o número de escritas no banco de dados
      let watchId: number;
      if (navigator.geolocation && firestore) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now();
            // Apenas atualiza se passou 30 segundos desde a última gravação
            if (now - lastUpdateRef.current < 30000) return;
            
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
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
        );
      }

      return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [user?.uid, userRole, firestore]);

  return (
    <MobileLayout>
      {children}
      <CourierNav />
    </MobileLayout>
  );
}
