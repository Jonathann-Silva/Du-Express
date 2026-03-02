
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Wallet, ChevronLeft, ChevronRight, Banknote, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { format, startOfWeek, addDays, subDays, addWeeks, subWeeks, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Delivery } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientName } from '@/components/info/ClientName';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function CourierEarningsPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const { user, userProfile, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const { dateRangeStart, dateRangeEnd, periodLabel } = useMemo(() => {
        const reference = new Date(currentDate);
        const day = getDay(reference);
        // Se for domingo (0), volta para sábado para calcular a semana correta do ciclo
        const dateForCalc = day === 0 ? subDays(reference, 1) : reference;
        const weekStart = startOfWeek(dateForCalc, { weekStartsOn: 1 });
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = addDays(weekStart, 5); // Vai até Sábado
        weekEnd.setHours(23, 59, 59, 999);
        
        return { 
            dateRangeStart: weekStart, 
            dateRangeEnd: weekEnd, 
            periodLabel: `${format(weekStart, 'dd/MM')} até ${format(weekEnd, 'dd/MM')}` 
        };
    }, [currentDate]);

    const handlePrev = () => setCurrentDate(prev => subWeeks(prev, 1));
    const handleNext = () => setCurrentDate(prev => addWeeks(prev, 1));

    const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
    const [deliveriesLoading, setDeliveriesLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user?.uid) return;

        const fetchEarnings = async () => {
            setDeliveriesLoading(true);
            try {
                const q = query(
                    collection(firestore, 'deliveries'),
                    where('courierId', '==', user.uid),
                    where('status', '==', 'finished'),
                    where('createdAt', '>=', dateRangeStart),
                    where('createdAt', '<=', dateRangeEnd),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery));
                setDeliveries(results);
            } catch (error: any) {
                if (error.code === 'permission-denied') {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'deliveries', operation: 'list' }));
                } else {
                    console.error("Error fetching courier earnings:", error);
                }
                setDeliveries([]);
            } finally { 
                setDeliveriesLoading(false); 
            }
        };

        fetchEarnings();
    }, [firestore, user?.uid, dateRangeStart, dateRangeEnd]);

    const stats = useMemo(() => {
        if (!deliveries || !userProfile) return { totalEarned: 0, receivedInCash: 0, finalBalance: 0 };
        const rate = userProfile.deliveryRate || 6;
        
        return deliveries.reduce((acc, d) => {
            acc.totalEarned += rate;
            if (d.paymentMethod === 'cash') {
                acc.receivedInCash += d.price;
            }
            return acc;
        }, { totalEarned: 0, receivedInCash: 0, finalBalance: 0 });
    }, [deliveries, userProfile]);

    const finalBalance = stats.totalEarned - stats.receivedInCash;
    const isLoading = userLoading || deliveriesLoading;

    return (
        <div className="flex flex-col h-full bg-background">
            <header className="flex items-center justify-between px-4 pt-6 pb-2 bg-background sticky top-0 z-10 shrink-0">
                <Button asChild variant="ghost" size="icon" className="rounded-full">
                    <Link href="/courier"><ArrowLeft /></Link>
                </Button>
                <h1 className="text-lg font-bold tracking-tight font-headline">Extrato de Ganhos</h1>
                <div className="size-10" />
            </header>

            <main className="flex-1 overflow-y-auto px-4 pb-24">
                <section className="mt-4">
                    <Card className="p-3 bg-card border shadow-sm rounded-2xl flex items-center justify-between">
                        <Button variant="ghost" size="icon" onClick={handlePrev} className="rounded-full">
                            <ChevronLeft className="size-5" />
                        </Button>
                        <div className="text-center">
                            <p className="text-sm font-bold">{periodLabel}</p>
                            <p className="text-[10px] uppercase font-black text-primary tracking-widest leading-none mt-0.5">Ciclo Semanal Seg-Sáb</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleNext} className="rounded-full">
                            <ChevronRight className="size-5" />
                        </Button>
                    </Card>
                </section>

                <div className={cn(
                    "mt-4 p-8 rounded-[2rem] text-white shadow-xl flex flex-col items-center text-center relative overflow-hidden transition-all duration-500", 
                    finalBalance >= 0 ? "bg-primary shadow-primary/20" : "bg-destructive shadow-destructive/20"
                )}>
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10"><Banknote size={160} /></div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">
                        {finalBalance >= 0 ? "Saldo a Receber" : "Saldo Devedor (Admin)"}
                    </p>
                    {isLoading ? (
                        <Skeleton className="h-10 w-48 bg-white/20" />
                    ) : (
                        <h2 className="text-4xl font-black font-headline">
                            {Math.abs(finalBalance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h2>
                    )}
                    {finalBalance < 0 && !isLoading && (
                        <p className="text-[10px] font-bold bg-black/20 px-3 py-1 rounded-full mt-2">
                            Valor excedente recebido em dinheiro
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                    <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
                        <p className="text-[10px] font-black uppercase text-emerald-600">Ganhos (Sua Parte)</p>
                        {isLoading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                            <p className="text-lg font-bold text-emerald-700">
                                {stats.totalEarned.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        )}
                    </Card>
                    <Card className="p-4 bg-amber-500/10 border-amber-500/20">
                        <p className="text-[10px] font-black uppercase text-amber-600">Recebido em Dinheiro</p>
                        {isLoading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                            <p className="text-lg font-bold text-amber-700">
                                {stats.receivedInCash.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        )}
                    </Card>
                </div>

                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-widest">Histórico Detalhado</h3>
                        {!isLoading && (
                            <span className="text-[10px] font-bold text-muted-foreground">{deliveries?.length || 0} viagens</span>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                        {isLoading ? (
                            Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
                        ) : deliveries && deliveries.length > 0 ? (
                            deliveries.map((d) => (
                                <Card key={d.id} className={cn("p-4 rounded-2xl border-l-4 shadow-sm", d.paymentMethod === 'cash' ? "border-l-amber-500 bg-amber-50/30" : "border-l-emerald-500")}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("size-10 rounded-xl flex items-center justify-center", d.paymentMethod === 'cash' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600")}>
                                                {d.paymentMethod === 'cash' ? <Banknote size={20} /> : <CheckCircle size={20} />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold leading-none truncate max-w-[140px]"><ClientName clientId={d.clientId} /></p>
                                                <p className="text-[9px] text-muted-foreground uppercase mt-1">{format(d.createdAt.toDate(), "dd MMM 'às' HH:mm", { locale: ptBR })}</p>
                                                <Badge variant="outline" className="mt-1 text-[8px] uppercase">{d.paymentMethod === 'cash' ? 'Dinheiro' : d.paymentMethod === 'pix' ? 'Pix' : 'Crediário'}</Badge>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase">Sua Parte</p>
                                            <p className="text-base font-black text-primary">+{(userProfile?.deliveryRate || 6).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                            {d.paymentMethod === 'cash' && <p className="text-[8px] font-bold text-destructive">Coletou: {d.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-muted/10">
                                <AlertCircle className="size-10 text-muted-foreground/20 mx-auto mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">Nenhuma entrega finalizada nesta semana.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
