
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, CreditCard, Wallet, CheckCircle2, AlertCircle, Loader2, Info, Banknote, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, doc, writeBatch, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import type { Delivery } from '@/lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ClientFinancePage() {
  const { user, userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsUpdating] = useState(false);

  // Busca todas as entregas concluídas da loja
  const deliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'deliveries'),
      where('clientId', '==', user.uid),
      where('status', '==', 'finished'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [firestore, user?.uid]);

  const { data: deliveries, loading: loadingDeliveries } = useCollection<Delivery>(deliveriesQuery);

  const unpaidDeliveries = useMemo(() => {
    return deliveries?.filter(d => !d.paidByClient) || [];
  }, [deliveries]);

  const totalDebt = useMemo(() => {
    return unpaidDeliveries.reduce((sum, d) => sum + d.price, 0);
  }, [unpaidDeliveries]);

  const handlePayDeliveries = async () => {
    if (!firestore || unpaidDeliveries.length === 0) return;
    
    setIsUpdating(true);
    
    // SIMULAÇÃO DE MERCADO PAGO
    // Em produção, aqui você chamaria sua API para criar uma Preference ID
    // e abriria o checkout.
    
    setTimeout(async () => {
        const batch = writeBatch(firestore);
        
        unpaidDeliveries.forEach(delivery => {
            const dRef = doc(firestore, 'deliveries', delivery.id);
            batch.update(dRef, { paidByClient: true });
        });

        // Notifica o Admin
        const notifRef = doc(collection(firestore, 'notifications'));
        batch.set(notifRef, {
            userId: 'admin', // Aqui você buscaria os IDs dos admins reais
            title: 'Pagamento Recebido!',
            description: `${userProfile?.displayName} realizou o pagamento de R$ ${totalDebt.toFixed(2)}.`,
            createdAt: serverTimestamp(),
            read: false,
            icon: 'wallet'
        });

        try {
            await batch.commit();
            toast({
                title: "Pagamento Confirmado!",
                description: "Obrigado! Suas entregas foram marcadas como pagas.",
            });
        } catch (e) {
            toast({ title: "Erro ao processar", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    }, 2000);
  };

  const isLoading = userLoading || loadingDeliveries;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight font-headline">Financeiro</h1>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-32">
        
        {/* Resumo de Dívida */}
        <section className="mb-8">
            <Card className={cn(
                "p-6 border-none shadow-xl transition-all",
                totalDebt > 0 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
            )}>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl bg-white/20">
                        {totalDebt > 0 ? <AlertCircle className="size-6" /> : <CheckCircle2 className="size-6" />}
                    </div>
                    <Badge className="bg-white/20 text-white border-none">STATUS ATUAL</Badge>
                </div>
                <p className="text-sm font-medium opacity-80 uppercase tracking-widest">Saldo Devedor</p>
                {isLoading ? <Skeleton className="h-10 w-32 bg-white/20 mt-1" /> : (
                    <h2 className="text-4xl font-black mt-1">
                        {totalDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h2>
                )}
                <p className="text-xs mt-4 opacity-70 leading-tight">
                    {totalDebt > 0 
                        ? `${unpaidDeliveries.length} entregas aguardando pagamento para a central.` 
                        : "Tudo em dia! Você não possui faturas pendentes."}
                </p>
            </Card>
        </section>

        {/* Métodos de Pagamento */}
        {totalDebt > 0 && (
            <section className="mb-8 space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Pagar com Mercado Pago</h3>
                <Card className="p-4 border-primary/20 bg-primary/5 cursor-pointer active:scale-[0.98] transition-all" onClick={handlePayDeliveries}>
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-[#009EE3] flex items-center justify-center shadow-lg">
                            <CreditCard className="text-white size-6" />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-sm">Cartão ou PIX</p>
                            <p className="text-xs text-muted-foreground">Checkout seguro via Mercado Pago</p>
                        </div>
                        {isProcessing ? <Loader2 className="animate-spin text-primary" /> : <ChevronRight className="text-primary/40" />}
                    </div>
                </Card>
                <div className="flex gap-2 p-3 bg-muted/50 rounded-xl border border-dashed">
                    <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-tight italic">
                        O pagamento é processado instantaneamente e libera o limite da sua conta na central Lucas-Expresso.
                    </p>
                </div>
            </section>
        )}

        {/* Histórico Recente */}
        <section className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Últimos Lançamentos</h3>
            <div className="space-y-3">
                {isLoading ? (
                    <>
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                    </>
                ) : deliveries && deliveries.length > 0 ? (
                    deliveries.map(delivery => (
                        <Card key={delivery.id} className="p-4 rounded-xl border-l-4 overflow-hidden" style={{ borderLeftColor: delivery.paidByClient ? '#10b981' : '#f59e0b' }}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-muted-foreground uppercase">{format(delivery.createdAt.toDate(), 'dd/MM/yyyy', {locale: ptBR})}</p>
                                    <h4 className="font-bold text-sm truncate max-w-[180px]">{delivery.dropoff}</h4>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-base">{delivery.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                                    <span className={cn(
                                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                                        delivery.paidByClient ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                    )}>
                                        {delivery.paidByClient ? 'Pago' : 'Pendente'}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-10 border-2 border-dashed rounded-3xl">
                        <Banknote className="size-10 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">Nenhuma entrega concluída ainda.</p>
                    </div>
                )}
            </div>
        </section>
      </main>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight border", className)}>
            {children}
        </span>
    )
}
