
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, CreditCard, Wallet, CheckCircle2, AlertCircle, Loader2, Info, Banknote, ChevronRight, AlertTriangle, Calendar, Ban, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, doc, writeBatch, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import type { Delivery } from '@/lib/types';
import { format, startOfWeek, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn, checkClientBlockStatus } from '@/lib/utils';

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

  const blockStatus = useMemo(() => checkClientBlockStatus(unpaidDeliveries), [unpaidDeliveries]);

  const { currentWeekAmount, previousWeeksAmount } = useMemo(() => {
    const now = new Date();
    const currentMonday = startOfWeek(now, { weekStartsOn: 1 });
    currentMonday.setHours(0, 0, 0, 0);

    return unpaidDeliveries.reduce((acc, d) => {
        const deliveryDate = d.createdAt.toDate();
        if (isBefore(deliveryDate, currentMonday)) {
            acc.previousWeeksAmount += d.price;
        } else {
            acc.currentWeekAmount += d.price;
        }
        return acc;
    }, { currentWeekAmount: 0, previousWeeksAmount: 0 });
  }, [unpaidDeliveries]);

  const totalDebt = currentWeekAmount + previousWeeksAmount;

  const handlePayDeliveries = async () => {
    if (!firestore || unpaidDeliveries.length === 0) return;
    
    setIsUpdating(true);
    
    // SIMULAÇÃO DE MERCADO PAGO (PIX)
    setTimeout(async () => {
        const batch = writeBatch(firestore);
        
        unpaidDeliveries.forEach(delivery => {
            const dRef = doc(firestore, 'deliveries', delivery.id);
            batch.update(dRef, { paidByClient: true });
        });

        // Notifica o Admin
        const notifRef = doc(collection(firestore, 'notifications'));
        batch.set(notifRef, {
            userId: 'admin', // Idealmente buscaria os IDs dos admins reais
            title: 'Pagamento Recebido!',
            description: `${userProfile?.displayName} realizou o pagamento via PIX de R$ ${totalDebt.toFixed(2)}.`,
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
        <section className="mb-6">
            <Card className={cn(
                "p-6 border-none shadow-xl transition-all relative overflow-hidden",
                blockStatus.isBlocked ? "bg-destructive text-destructive-foreground" : (totalDebt > 0 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white")
            )}>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl bg-white/20">
                        {blockStatus.isBlocked ? <Ban className="size-6" /> : (totalDebt > 0 ? <AlertCircle className="size-6" /> : <CheckCircle2 className="size-6" />)}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">
                        {blockStatus.isBlocked ? "ACESSO BLOQUEADO" : "STATUS ATUAL"}
                    </span>
                </div>
                <p className="text-sm font-medium opacity-80 uppercase tracking-widest">Saldo Total Devedor</p>
                {isLoading ? <Skeleton className="h-10 w-32 bg-white/20 mt-1" /> : (
                    <h2 className="text-4xl font-black mt-1">
                        {totalDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h2>
                )}
                
                {blockStatus.isBlocked && (
                    <div className="mt-4 p-3 bg-black/10 rounded-xl">
                        <p className="text-[10px] font-bold leading-tight">O prazo de pagamento da semana anterior venceu na quarta-feira. Realize o acerto agora para desbloquear sua conta.</p>
                    </div>
                )}
            </Card>
        </section>

        {/* Detalhamento por Ciclo */}
        {totalDebt > 0 && (
            <section className="mb-8 grid grid-cols-2 gap-3">
                <Card className="p-4 bg-muted/50 border-none shadow-sm">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Semana Atual</p>
                    <p className="text-lg font-black text-foreground">{currentWeekAmount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                    <p className="text-[9px] text-muted-foreground mt-1">Vence na próxima quarta</p>
                </Card>
                <Card className={cn("p-4 border-none shadow-sm", previousWeeksAmount > 0 ? "bg-destructive/10" : "bg-muted/50")}>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest leading-none mb-1", previousWeeksAmount > 0 ? "text-destructive" : "text-muted-foreground")}>Semana Anterior</p>
                    <p className={cn("text-lg font-black", previousWeeksAmount > 0 ? "text-destructive" : "text-foreground")}>{previousWeeksAmount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                    <p className="text-[9px] text-muted-foreground mt-1">Vencido {blockStatus.isGracePeriod ? "(Em prazo de graça)" : ""}</p>
                </Card>
            </section>
        )}

        {/* Métodos de Pagamento */}
        {totalDebt > 0 && (
            <section className="mb-8 space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Pagar com PIX</h3>
                <Card className="p-4 border-primary/20 bg-primary/5 cursor-pointer active:scale-[0.98] transition-all" onClick={handlePayDeliveries}>
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-[#32BCAD] flex items-center justify-center shadow-lg">
                            <Smartphone className="text-white size-6" />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-sm">Pagar via PIX</p>
                            <p className="text-xs text-muted-foreground">Checkout seguro via Mercado Pago</p>
                        </div>
                        {isProcessing ? <Loader2 className="animate-spin text-primary" /> : <ChevronRight className="text-primary/40" />}
                    </div>
                </Card>
                <div className="flex gap-2 p-3 bg-muted/50 rounded-xl border border-dashed">
                    <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-tight italic">
                        O ciclo de pagamentos funciona de Segunda a Sábado. O vencimento da semana fechada ocorre toda Quarta-Feira subsequente.
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
                    deliveries.map(delivery => {
                        const isPrevious = isBefore(delivery.createdAt.toDate(), startOfWeek(new Date(), {weekStartsOn: 1}));
                        return (
                            <Card key={delivery.id} className="p-4 rounded-xl border-l-4 overflow-hidden" style={{ borderLeftColor: delivery.paidByClient ? '#10b981' : (isPrevious ? '#ef4444' : '#f59e0b') }}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-muted-foreground uppercase">{format(delivery.createdAt.toDate(), 'dd/MM/yyyy', {locale: ptBR})}</p>
                                            {isPrevious && !delivery.paidByClient && (
                                                <span className="text-[8px] font-black bg-destructive/10 text-destructive px-1 rounded uppercase">Vencido</span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-sm truncate max-w-[180px]">{delivery.dropoff}</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-base">{delivery.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                                        <span className={cn(
                                            "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                                            delivery.paidByClient ? "bg-emerald-100 text-emerald-700" : (isPrevious ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")
                                        )}>
                                            {delivery.paidByClient ? 'Pago' : 'Pendente'}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        )
                    })
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
