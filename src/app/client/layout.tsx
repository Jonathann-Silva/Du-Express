import type { ReactNode } from 'react';
import { MobileLayout } from '@/components/MobileLayout';
import { ClientNav } from '@/components/nav/ClientNav';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <MobileLayout>
      {children}
      <ClientNav />
    </MobileLayout>
  );
}
