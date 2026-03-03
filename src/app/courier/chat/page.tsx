'use client';

import { ArrowLeft, ShieldCheck, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { Skeleton } from '@/components/ui/skeleton';

export default function CourierChatPage() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="h-full flex flex-col p-6 space-y-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background outline-none">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b flex items-center justify-between">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/courier">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight font-headline">Falar com a Central</h1>
        <div className="size-10" />
      </header>

      <main className="flex-1 p-4 flex flex-col overflow-hidden pb-24">
        <div className="mb-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/20 shrink-0">
            <ShieldCheck className="text-emerald-600 size-6" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Suporte</p>
            <p className="text-xs text-muted-foreground mt-0.5">Comunique problemas em rota, endereços errados ou falhas no app.</p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {user && (
            <ChatInterface 
              chatId={`admin_${user.uid}`} 
              recipientId="admin"
              recipientProfile={{
                uid: 'admin',
                displayName: 'Central de Operações',
                role: 'admin',
                createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date()
              } as any}
            />
          )}
        </div>
      </main>
    </div>
  );
}
