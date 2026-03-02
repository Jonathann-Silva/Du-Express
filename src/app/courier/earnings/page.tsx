
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Calendar, CheckCircle, Wallet, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { 
    format, 
    startOfWeek, 
    startOfMonth, 
    endOfMonth, 
    startOfDay, 
    endOfDay, 
    addDays, 
    subDays, 
    addWeeks, 
    subWeeks, 
    addMonths, 
    subMonths 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Delivery } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientName } from '@/components/info/ClientName';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type FilterType = 'today' | 'week' | 'month';

const filterButtons: { label: string, type: FilterType }[] = [
    { label: 'Hoje', type: 'today' },
    { label: 'Esta Semana', type: 'week' },
    { label: 'Este Mês', type: 'month' },
];

export default function CourierEarningsPage() {
    const [activeFilter, setActiveFilter] = useState<FilterType>('week');
    const [currentDate, setCurrentDate] = useState(new Date());
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const { dateRangeStart, dateRangeEnd, periodLabel, subLabel } = useMemo(() => {
        const start = new Date(currentDate);
        switch (activeFilter) {
            case 'today':
                return {
                    dateRangeStart: startOfDay(start),
                    dateRangeEnd: endOfDay(start),
                    periodLabel: format(start, "d 'de' MMMM", { locale: ptBR }),
                    subLabel: 'Dia Selecionado'
                };
            case 'week':
                const weekStart = startOfWeek(start, { weekStartsOn: 1 });
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = addDays(weekStart, 5); // Sábado
                weekEnd.setHours(23, 59, 59, 999);
                return {
                    dateRangeStart: weekStart,
                    dateRangeEnd: weekEnd,
                    periodLabel: `${format(weekStart, 'dd/MM')} até ${format(weekEnd, 'dd/MM')}`,
                    subLabel: 'Semana Selecionada (Seg-Sáb)'
                };
            case 'month':
            default:
                const monthStart = startOfMonth(start);
                const monthEnd = endOfMonth(start);
                monthStart.setHours(0, 0, 0, 0);
                monthEnd.setHours(23, 59, 59, 999);
                return {
                    dateRangeStart: monthStart,
                    dateRangeEnd: monthEnd,
                    periodLabel: format(start, "MMMM 'de' yyyy", { locale: ptBR }),
                    subLabel: 'Mês Selecionado'
                };
        }
    }, [activeFilter, currentDate]);

    const handlePrev = () => {
        if (activeFilter === 'today') setCurrentDate(prev => subDays(prev, 1));
        if (activeFilter === 'week') setCurrentDate(prev => subWeeks(prev, 1));
        if (activeFilter === 'month') setCurrentDate(prev => subMonths(prev, 1));
    };

    const handleNext = () => {
        if (activeFilter === 'today') setCurrentDate(prev => addDays(prev, 1));
        if (activeFilter === 'week') setCurrentDate(prev => addWeeks(prev, 1));
        if (activeFilter === 'month') setCurrentDate(prev => addMonths(prev, 1));
    };

    const handleResetDate = () => setCurrentDate(new Date());

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
                const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery));
                setDeliveries(data);
            } catch (error: any) {
                console.error("Error fetching earnings:", error);
                if (error.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: 'deliveries',
                        operation: 'list',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                }
                setDeliveries([]);
            } finally {
                setDeliveriesLoading(false);
            }
        };

        fetchEarnings();
    }, [firestore, user?.uid, dateRangeStart, dateRangeEnd]);

    const totalEarnings = useMemo(() => {
        if (!deliveries) return 0;
        return deliveries.reduce((acc, delivery) => acc + (delivery.price || 0), 0);
    }, [deliveries]);

    const isLoading = userLoading || deliveriesLoading;

    return (
        <div className="flex flex-col h-full bg-background">
            <header className="flex items-center justify-between px-4 pt-6 pb-2 bg-background sticky top-0 z-10 shrink-0">
                <Button asChild variant="ghost" size="icon" className="rounded-full">
                    <Link href="/courier">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="text-lg font-bold tracking-tight font-headline">Histórico de Ganhos</h1>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={handleResetDate}>
                    <Calendar className={cn(format(currentDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd') && "text-primary")} />
                </Button>
            </header>

            <main className="flex-1 overflow-y-auto px-4 pb-24">
                {/* Filtros Rápidos */}
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {filterButtons.map(({ label, type }) => (
                         <Button 
                            key={type}
                            className={cn(
                                "whitespace-nowrap rounded-full px-5 h-10 font-bold",
                                activeFilter === type ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            )}
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                                setActiveFilter(type);
                                setCurrentDate(new Date());
                            }}
                        >
                            {label}
                        </Button>
                    ))}
                </div>

                {/* Seletor de Período */}
                <section className="mt-4">
                    <Card className="p-3 bg-muted/50 border shadow-none rounded-2xl">
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon" onClick={handlePrev} className="rounded-full hover:bg-background">
                                <ChevronLeft className="size-5" />
                            </Button>
                            <div className="text-center">
                                <p className="text-sm font-bold text-foreground">{periodLabel}</p>
                                <p className="text-[10px] uppercase font-black text-primary tracking-widest leading-none mt-0.5">{subLabel}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleNext} className="rounded-full hover:bg-background">
                                <ChevronRight className="size-5" />
                            </Button>
                        </div>
                    </Card>
                </section>

                {/* Card de Valor Total */}
                <div className="mt-4 p-8 rounded-[2rem] bg-primary/5 border border-primary/10 flex flex-col items-center text-center shadow-sm">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Total Ganho no Período</p>
                    {isLoading ? (
                        <Skeleton className="h-10 w-48 my-1" />
                    ) : (
                        <h2 className="text-4xl font-black text-foreground tracking-tight mb-1 font-headline">
                            {totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h2>
                    )}
                    <div className="mt-3 flex items-center gap-1.5 bg-background px-3 py-1 rounded-full border border-primary/10 shadow-sm">
                        <Wallet className="size-3 text-primary" />
                        <span className="text-[10px] font-black text-muted-foreground uppercase">{deliveries?.length || 0} entregas feitas</span>
                    </div>
                </div>

                {/* Lista de Entregas */}
                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest font-headline">Lista Detalhada</h3>
                    </div>

                    <div className="space-y-3">
                        {isLoading ? (
                            Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
                        ) : deliveries && deliveries.length > 0 ? (
                            deliveries.map((delivery) => (
                                <Card key={delivery.id} className="p-4 rounded-2xl border-l-4 border-l-emerald-500 shadow-sm hover:border-emerald-500/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                                <CheckCircle className="text-green-500 size-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">
                                                    <ClientName clientId={delivery.clientId} />
                                                </p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">{format((delivery.createdAt as Timestamp).toDate(), "dd MMM 'às' HH:mm", { locale: ptBR })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Seu Ganho</p>
                                            <p className="text-lg font-black text-primary leading-none">+{delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-16 border-2 border-dashed rounded-[2rem] bg-muted/20">
                                <Wallet className="mx-auto text-muted-foreground/20 size-16 mb-4" />
                                <p className="font-bold text-muted-foreground">Nenhum ganho registrado</p>
                                <p className="text-xs text-muted-foreground/60 mt-1 px-8">Navegue entre as datas para visualizar o histórico de períodos passados.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
