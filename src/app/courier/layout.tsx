
'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { MobileLayout } from '@/components/MobileLayout';
import { CourierNav } from '@/components/nav/CourierNav';
import { useUser, useFirestore } from '@/firebase';
import { requestPermissionAndSaveToken } from '@/firebase/messaging';
import { getSocket } from '@/services/socket';

export default function CourierLayout({ children }: { children: ReactNode }) {
  const { user, userProfile } = useUser();
  const userRole = userProfile?.role;
  const isOnline = userProfile?.status === 'online';
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (user && userRole === 'courier') {
      // Solicita permissão de notificação Webpush
      requestPermissionAndSaveToken(user.uid);

      // --- RASTREIO VIA VPS (SOCKET.IO) ---
      let watchId: number;
      const socket = getSocket();
      
      if (navigator.geolocation && isOnline) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now();
            // Com a VPS, atualizamos a cada 2 segundos para fluidez total em 3D
            if (now - lastUpdateRef.current < 2000) return;
            
            lastUpdateRef.current = now;
            
            // Envia para a VPS via WebSocket incluindo o heading (direção)
            socket.emit('update-location', {
              courierId: user.uid,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading, // O ângulo de rotação do celular/veículo
              speed: pos.coords.speed,
              updatedAt: now
            });
          },
          (err) => console.warn("GPS via VPS Error:", err),
          { 
            enableHighAccuracy: true, 
            timeout: 10000, 
            maximumAge: 0 
          }
        );
      }

      return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [user?.uid, userRole, isOnline]);

  return (
    <MobileLayout>
      {children}
      <CourierNav />
    </MobileLayout>
  );
}
