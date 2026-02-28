
'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { MobileLayout } from '@/components/MobileLayout';
import { ClientNav } from '@/components/nav/ClientNav';
import { useUser } from '@/firebase';
import { requestPermissionAndSaveToken } from '@/firebase/messaging';

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      // Registra o aparelho do cliente para notificações push (status de pedidos)
      requestPermissionAndSaveToken(user.uid);
    }
  }, [user?.uid]);

  return (
    <MobileLayout>
      {children}
      <ClientNav />
    </MobileLayout>
  );
}
