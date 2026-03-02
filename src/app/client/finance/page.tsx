
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, CreditCard, Wallet, CheckCircle2, AlertCircle, Loader2, Info, Banknote, ChevronRight, AlertTriangle, Calendar, Ban, Smartphone, QrCode, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, doc, writeBatch, serverTimestamp, orderBy, limit, Timestamp } from 'firebase/firestore';
import type { Delivery } from '@/lib/types';
import { format, startOfWeek, isBefore, getDay, subDays, addDays, subWeeks, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn, checkClientBlockStatus } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ClientFinancePage() {
  const { user, userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsUpdating] = useState(false);
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Cálculo do Ciclo Semanal (Seg-Sáb)
  const { weekStart, weekEnd, periodLabel } = useMemo(() => {
    const reference = new Date(currentDate);
    const day = getDay(reference);
    const dateForCalc = day === 0 ? subDays(reference, 1) : reference;
    const start = startOfWeek(dateForCalc, { weekStartsOn: 1 });
    start.setHours(0, 0, 0, 0);
    
    const end = addDays(start, 5); // Vai até Sábado
    end.setHours(23, 59, 59, 999);
    
    return { 
      weekStart: start, 
      weekEnd: end, 
      periodLabel: `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}` 
    };
  }, [currentDate]);

  const handlePrevWeek = () => setCurrentDate(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate(prev => addWeeks(prev, 1));

  // 1. Busca TODAS as entregas finalizadas para o cálculo de bloqueio
  // Removido o filtro 'paidByClient == false' da query para ser mais robusto com dados antigos/missing
  const allDeliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'deliveries'),
      where('clientId', '==', user.uid),
      where('status', '==', 'finished')
    );
  }, [firestore, user?.uid]);

  const { data: allFinishedDeliveries } = useCollection<Delivery>(allDeliveriesQuery);

  const unpaidDeliveries = useMemo(() => {
    return allFinishedDeliveries?.filter(d => d.paidByClient === false || d.paidByClient === undefined) || [];
  }, [allFinishedDeliveries]);

  // 2. Busca as entregas da SEMANA SELECIONADA para exibição na lista
  const weeklyDeliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'deliveries'),
      where('clientId', '==', user.uid),
      where('status', '==', 'finished'),
      where('createdAt', '>=', Timestamp.fromDate(weekStart)),
      where('createdAt', '<=', Timestamp.fromDate(weekEnd)),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
  }, [firestore, user?.uid, weekStart, weekEnd]);

  const { data: weeklyDeliveries, loading: loadingDeliveries } = useCollection<Delivery>(weeklyDeliveriesQuery);

  const blockStatus = useMemo(() => checkClientBlockStatus(unpaidDeliveries), [unpaidDeliveries]);

  // Verifica se o período selecionado está vencido (Prazo: Quarta da semana seguinte)
  const isPeriodExpired = useMemo(() => {
    const deadline = addDays(weekStart, 9); 
    deadline.setHours(23, 59, 59, 999);
    return isBefore(deadline, new Date());
  }, [weekStart]);

  // Cálculos baseados na semana selecionada
  const stats = useMemo(() => {
    if (!weeklyDeliveries) return { totalWeek: 0, paidWeek: 0, unpaidWeek: 0 };
    return weeklyDeliveries.reduce((acc, d) => {
        acc.totalWeek += d.price;
        if (d.paidByClient) acc.paidWeek += d.price;
        else acc.unpaidWeek += d.price;
        return acc;
    }, { totalWeek: 0, paidWeek: 0, unpaidWeek: 0 });
  }, [weeklyDeliveries]);

  const totalDebt = useMemo(() => {
    return unpaidDeliveries.reduce((sum, d) => sum + (d.price || 0), 0);
  }, [unpaidDeliveries]);

  const handlePayDeliveries = async () => {
    if (!firestore || unpaidDeliveries.length === 0) return;
    
    setIsUpdating(true);
    
    setTimeout(async () => {
        const batch = writeBatch(firestore);
        
        unpaidDeliveries.forEach(delivery => {
            const dRef = doc(firestore, 'deliveries', delivery.id);
            batch.update(dRef, { paidByClient: true });
        });

        const notifRef = doc(collection(firestore, 'notifications'));
        batch.set(notifRef, {
            userId: 'admin', 
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
            setIsQRCodeOpen(false);
        } catch (e) {
            toast({ title: "Erro ao processar", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    }, 2000);
  };

  const isLoading = userLoading || loadingDeliveries;

  const isCurrentlyInDebtInPeriod = stats.unpaidWeek > 0;
  const cardStatus = useMemo(() => {
    // Se a semana está vencida E tem dívida nela, ou se o app está bloqueado globalmente
    if ((isCurrentlyInDebtInPeriod && isPeriodExpired) || (blockStatus.isBlocked && totalDebt > 0)) {
        return { color: "bg-destructive text-white", label: "PAGAMENTO VENCIDO", icon: <Ban className="size-6" /> };
    }
    if (isCurrentlyInDebtInPeriod) {
        return { color: "bg-amber-500 text-white", label: "SALDO DA SEMANA", icon: <AlertCircle className="size-6" /> };
    }
    return { color: "bg-emerald-500 text-white", label: "CICLO LIQUIDADO", icon: <CheckCircle2 className="size-6" /> };
  }, [isCurrentlyInDebtInPeriod, isPeriodExpired, blockStatus.isBlocked, totalDebt]);

  return (
    <div className="flex flex-col h-full bg-background outline-none">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight font-headline">Financeiro</h1>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-32 outline-none">
        
        <section className="mb-6">
            <Card className="p-2 bg-muted/50 border shadow-sm rounded-2xl flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="rounded-xl h-12 w-12" disabled={isLoading}>
                    <ChevronLeft className="size-6" />
                </Button>
                <div className="text-center">
                    <p className="text-sm font-bold">{periodLabel}</p>
                    <p className="text-[10px] uppercase font-black text-primary tracking-widest leading-none mt-0.5">Ciclo Seg-Sáb</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleNextWeek} className="rounded-xl h-12 w-12" disabled={isLoading}>
                    <ChevronRight className="size-6" />
                </Button>
            </Card>
        </section>

        <section className="mb-6">
            <Card className={cn(
                "p-6 border-none shadow-xl transition-all relative overflow-hidden",
                cardStatus.color
            )}>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl bg-white/20">
                        {cardStatus.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">
                        {cardStatus.label}
                    </span>
                </div>
                <p className="text-sm font-medium opacity-80 uppercase tracking-widest">Saldo Pendente no Período</p>
                {isLoading ? <Skeleton className="h-10 w-32 bg-white/20 mt-1" /> : (
                    <h2 className="text-4xl font-black mt-1">
                        {stats.unpaidWeek.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h2>
                )}
                
                {(blockStatus.isBlocked || (totalDebt > stats.unpaidWeek)) && (
                    <div className="mt-4 p-3 bg-black/10 rounded-xl">
                        <p className="text-[10px] font-bold leading-tight">
                            {blockStatus.isBlocked 
                                ? "ACESSO BLOQUEADO: Você possui débitos vencidos. Regularize o total acumulado para voltar a pedir."
                                : "Existem pendências financeiras em outros períodos."}
                            <br />
                            <span className="text-xs font-black uppercase">Total Acumulado a Pagar: {totalDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </p>
                    </div>
                )}
            </Card>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3">
            <Card className="p-4 bg-muted/50 border-none shadow-sm">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Período</p>
                {isLoading ? <Skeleton className="h-6 w-24 mt-1" /> : (
                    <p className="text-lg font-black text-foreground">{stats.totalWeek.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                )}
            </Card>
            <Card className={cn("p-4 border-none shadow-sm", stats.unpaidWeek > 0 ? "bg-primary/5 border border-primary/10" : "bg-emerald-50")}>
                <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1 text-primary">Pendente Período</p>
                {isLoading ? <Skeleton className="h-6 w-24 mt-1" /> : (
                    <p className="text-lg font-black text-primary">{stats.unpaidWeek.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                )}
            </Card>
        </section>

        {totalDebt > 0 && (
            <section className="mb-8 space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Pagar Total Acumulado</h3>
                <Card className="p-4 border-primary/20 bg-primary/5 cursor-pointer active:scale-[0.98] transition-all" onClick={() => setIsQRCodeOpen(true)}>
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-[#32BCAD] flex items-center justify-center shadow-lg">
                            <Smartphone className="text-white size-6" />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-sm">Gerar QR Code PIX</p>
                            <p className="text-xs text-muted-foreground">Pagar saldo total de {totalDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <ChevronRight className="text-primary/40" />
                    </div>
                </Card>
                <div className="flex gap-2 p-3 bg-muted/50 rounded-xl border border-dashed">
                    <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-tight italic">
                        O vencimento da semana fechada ocorre toda Quarta-Feira subsequente. Pagamentos via PIX dão baixa imediata.
                    </p>
                </div>
            </section>
        )}

        <section className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Lançamentos do Período</h3>
                <span className="text-[10px] font-bold text-muted-foreground">{weeklyDeliveries?.length || 0} entregas</span>
            </div>
            <div className="space-y-3">
                {isLoading ? (
                    <>
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                    </>
                ) : weeklyDeliveries && weeklyDeliveries.length > 0 ? (
                    weeklyDeliveries.map(delivery => {
                        const isPrevCycle = isBefore(delivery.createdAt.toDate(), startOfWeek(new Date(), {weekStartsOn: 1}));
                        return (
                            <Card key={delivery.id} className="p-4 rounded-xl border-l-4 overflow-hidden shadow-sm" style={{ borderLeftColor: delivery.paidByClient ? '#10b981' : (isPrevCycle ? '#ef4444' : '#f59e0b') }}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-muted-foreground uppercase">{format(delivery.createdAt.toDate(), 'dd/MM HH:mm', {locale: ptBR})}</p>
                                            {!delivery.paidByClient && isPrevCycle && (
                                                <span className="text-[8px] font-black bg-destructive/10 text-destructive px-1 rounded uppercase">Vencido</span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-sm truncate max-w-[180px]">{delivery.dropoff}</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-base">{delivery.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                                        <span className={cn(
                                            "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                                            delivery.paidByClient ? "bg-emerald-100 text-emerald-700" : (isPrevCycle ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")
                                        )}>
                                            {delivery.paidByClient ? 'Liquidado' : 'Em Aberto'}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        )
                    })
                ) : (
                    <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-muted/10">
                        <Banknote className="size-10 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">Nenhuma entrega neste período.</p>
                    </div>
                )}
            </div>
        </section>
      </main>

      <Dialog open={isQRCodeOpen} onOpenChange={setIsQRCodeOpen}>
        <DialogContent className="max-w-[90vw] rounded-[2rem] p-6 overflow-hidden">
          <DialogHeader className="text-center">
            <DialogTitle className="font-headline text-2xl font-black">Pagamento PIX</DialogTitle>
            <DialogDescription className="text-sm">
              Escaneie o código para liquidar o saldo total.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-6">
            <div className="p-4 bg-white rounded-[2rem] shadow-inner border-2 border-dashed border-muted relative group">
              <Image 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=LucasExpresso-Pagamento-${totalDebt}`}
                alt="QR Code PIX"
                width={200}
                height={200}
                className="rounded-xl"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/80 transition-opacity rounded-xl">
                <QrCode className="size-12 text-primary" />
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Valor Total a Pagar</p>
              <h3 className="text-3xl font-black text-primary font-headline">
                {totalDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
          </div>

          <div className="mt-2 space-y-3">
            <Button 
              className="w-full h-16 rounded-2xl font-black text-base shadow-xl shadow-primary/20 active:scale-95 transition-all"
              onClick={handlePayDeliveries}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  DANDO BAIXA...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-5" />
                  JÁ REALIZEI O PAGAMENTO
                </>
              )}
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground font-bold" onClick={() => setIsQRCodeOpen(false)} disabled={isProcessing}>
              Cancelar
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-muted/30 rounded-xl flex gap-3 items-start">
            <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-tight italic">
              O sistema dará baixa em todas as suas entregas pendentes imediatamente após a confirmação.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
