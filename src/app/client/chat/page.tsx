
'use client';

import { ArrowLeft, ShieldCheck, MessageSquare, Headphones } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { Skeleton } from '@/components/ui/skeleton';

export default function ClientChatPage() {
  const { user, userProfile, loading } = useUser();

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
          <Link href="/client">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight font-headline">Suporte Central</h1>
        <div className="size-10" />
      </header>

      <main className="flex-1 p-4 flex flex-col overflow-hidden pb-24">
        <div className="mb-4 bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 shrink-0">
            <ShieldCheck className="text-primary size-6" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Canal de Atendimento Direto</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tire dúvidas sobre entregas, taxas ou problemas técnicos.</p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {user && (
            <ChatInterface 
              chatId={`admin_${user.uid}`} 
              recipientId="admin"
              recipientProfile={{
                uid: 'admin',
                displayName: 'Suporte Lucas-Expresso',
                role: 'admin',
                createdAt: userProfile?.createdAt // Dummy
              } as any}
            />
          )}
        </div>
      </main>
    </div>
  );
}
