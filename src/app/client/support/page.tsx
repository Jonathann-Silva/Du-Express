
'use client';

import { useMemo } from 'react';
import { ArrowLeft, MessageSquare, Mail, ChevronRight, Info, Zap, Clock, ShieldCheck, Phone } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFirestore, useDoc, useUser } from '@/firebase';
import type { AppStatus } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const commitments = [
  { 
    title: "Agilidade Total", 
    desc: "Seu pedido é notificado instantaneamente para nossa central de despacho.",
    icon: <Zap className="size-5 text-amber-500"/> 
  },
  { 
    title: "Segurança", 
    desc: "Trabalhamos apenas com entregadores verificados e com histórico de excelência.",
    icon: <ShieldCheck className="size-5 text-emerald-500"/> 
  },
  { 
    title: "Transparência", 
    desc: "Acompanhe cada passo da entrega em tempo real direto pelo seu painel.",
    icon: <Clock className="size-5 text-blue-500"/> 
  },
];

export default function SupportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const statusDocRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'status', 'main');
  }, [firestore, user]);

  const { data: appStatus, loading: statusLoading } = useDoc<AppStatus>(statusDocRef);
  
  const isAdminOnline = appStatus?.adminOnline;

  const whatsappUrl = "https://wa.me/5543988536639";

  return (
    <>
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center justify-between px-4 h-16">
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link href="/client"><ArrowLeft /></Link>
          </Button>
          <h1 className="text-lg font-bold tracking-tight font-headline">Central de Suporte</h1>
          <div className="size-10"></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-md mx-auto w-full pb-24">
        
        {/* Status da Central */}
        <section className="px-1">
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border/50">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <MessageSquare className="size-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Status da Logística</p>
                        <p className="text-sm font-bold mt-1">Admin Central</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 bg-background px-3 py-1 rounded-full border border-border shadow-sm">
                    {statusLoading ? <Skeleton className="h-2 w-2 rounded-full" /> : (
                        <span className={cn("size-2 rounded-full", isAdminOnline ? "bg-green-500 animate-pulse" : "bg-red-500")}></span>
                    )}
                    <span className={cn("text-[10px] font-black uppercase tracking-tighter", isAdminOnline ? "text-green-600" : "text-slate-500")}>
                        {statusLoading ? '...' : (isAdminOnline ? 'Admin Online' : 'Admin Offline')}
                    </span>
                </div>
            </div>
        </section>

        <section className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">Fale Conosco</h2>
            <div className="grid grid-cols-1 gap-3">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block active:scale-[0.98] transition-all">
                    <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                                <MessageSquare className="size-6" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-primary uppercase tracking-widest leading-none mb-1">WhatsApp Oficial</p>
                                <h3 className="text-lg font-bold leading-tight">(43) 98853-6639</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Clique para iniciar conversa</p>
                            </div>
                            <ChevronRight className="text-primary/40 size-5" />
                        </CardContent>
                    </Card>
                </a>

                <a href="mailto:LucasExpresso@gmail.com" className="block active:scale-[0.98] transition-all">
                    <Card className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                                <Mail className="size-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">E-mail</p>
                                <h3 className="text-sm font-bold truncate">LucasExpresso@gmail.com</h3>
                            </div>
                            <ChevronRight className="text-muted-foreground/30 size-4" />
                        </CardContent>
                    </Card>
                </a>
            </div>
        </section>

        {/* Nova seção de compromissos */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold tracking-tight font-headline px-1">Nosso Compromisso</h3>
          <div className="space-y-3">
            {commitments.map((item) => (
              <Card key={item.title} className="border-none shadow-sm bg-card">
                <CardContent className="p-4 flex items-start gap-4">
                    <div className="size-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                        {item.icon}
                    </div>
                    <div>
                        <p className="text-sm font-bold">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3">
          <Info className="text-primary size-5 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            O atendimento humano via WhatsApp está disponível das 08:00 às 18:00 de Segunda a Sábado. Para emergências técnicas fora deste horário, utilize o suporte por e-mail.
          </p>
        </div>
      </main>
    </>
  );
}
