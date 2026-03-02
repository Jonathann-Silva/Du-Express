
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Calendar, CheckCircle, TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Delivery } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientName } from '@/components/info/ClientName';

type FilterType = 'today' | 'week' | 'month';

const filterButtons: { label: string, type: FilterType }[] = [
    { label: 'Hoje', type: 'today' },
    { label: 'Esta Semana', type: 'week' },
    { label: 'Este Mês', type: 'month' },
];

export default function CourierEarningsPage() {
    const [activeFilter, setActiveFilter] = useState<FilterType>('month');
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const { dateRangeStart, dateRangeEnd, periodLabel } = useMemo(() => {
        const now = new Date();
        switch (activeFilter) {
            case 'today':
                return {
                    dateRangeStart: startOfDay(now),
                    dateRangeEnd: endOfDay(now),
                    periodLabel: format(now, "d 'de' MMMM", { locale: ptBR })
                };
            case 'week':
                const weekStart = startOfWeek(now, { weekStartsOn: 1 });
                return {
                    dateRangeStart: weekStart,
                    dateRangeEnd: endOfWeek(now, { weekStartsOn: 1 }),
                    periodLabel: `${format(weekStart, 'dd/MM')} - ${format(endOfWeek(now, { weekStartsOn: 1 }), 'dd/MM')}`
                };
            case 'month':
            default:
                const monthStart = startOfMonth(now);
                return {
                    dateRangeStart: monthStart,
                    dateRangeEnd: endOfMonth(now),
                    periodLabel: format(now, "MMMM 'de' yyyy", { locale: ptBR })
                };
        }
    }, [activeFilter]);

    const earningsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'deliveries'),
            where('courierId', '==', user.uid),
            where('status', '==', 'finished'),
            where('createdAt', '>=', dateRangeStart),
            where('createdAt', '<=', dateRangeEnd),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user, dateRangeStart, dateRangeEnd]);
    
    const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
    const [deliveriesLoading, setDeliveriesLoading] = useState(true);

    useEffect(() => {
        if (earningsQuery) {
            setDeliveriesLoading(true);
            getDocs(earningsQuery)
                .then(snapshot => {
                    const deliveriesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery));
                    setDeliveries(deliveriesData);
                })
                .catch(console.error)
                .finally(() => setDeliveriesLoading(false));
        } else {
            setDeliveries([]);
            setDeliveriesLoading(false);
        }
    }, [earningsQuery]);

    const totalEarnings = useMemo(() => {
        if (!deliveries) return 0;
        return deliveries.reduce((acc, delivery) => acc + delivery.price, 0);
    }, [deliveries]);

    const isLoading = userLoading || deliveriesLoading;

    return (
        <>
            <header className="flex items-center justify-between px-4 pt-6 pb-2 bg-background sticky top-0 z-10 shrink-0">
                <Button asChild variant="ghost" size="icon" className="rounded-full">
                    <Link href="/courier">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="text-lg font-bold tracking-tight font-headline">Histórico de Ganhos</h1>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Calendar />
                </Button>
            </header>

            <main className="flex-1 overflow-y-auto px-4 pb-24">
                <div className="mt-4 p-6 rounded-xl bg-primary/10 dark:bg-primary/5 border border-primary/20 flex flex-col items-center text-center">
                    <p className="text-sm font-medium text-primary uppercase tracking-wider mb-1">Total Ganho</p>
                    {isLoading ? (
                        <Skeleton className="h-10 w-48 my-1" />
                    ) : (
                        <h2 className="text-4xl font-extrabold text-foreground tracking-tight mb-1 font-headline">
                            {totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h2>
                    )}
                    <p className="text-muted-foreground text-xs mt-2">Período: {periodLabel}</p>
                </div>

                <div className="mt-6 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {filterButtons.map(({ label, type }) => (
                         <Button 
                            key={type}
                            className="whitespace-nowrap rounded-full px-5 h-10" 
                            variant={activeFilter === type ? 'default' : 'secondary'} 
                            size="sm"
                            onClick={() => setActiveFilter(type)}
                        >
                            {label}
                        </Button>
                    ))}
                    <Button className="whitespace-nowrap rounded-full px-5 h-10" variant="secondary" size="sm" disabled>Personalizado</Button>
                </div>

                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest font-headline">Entregas Concluídas</h3>
                        <span className="text-xs font-medium text-muted-foreground">{isLoading ? '...' : `${deliveries?.length || 0} Pedidos`}</span>
                    </div>

                    <div className="space-y-3">
                        {isLoading && Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                        
                        {!isLoading && deliveries && deliveries.length > 0 && deliveries.map((delivery) => (
                            <Card key={delivery.id} className="p-4 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                            <CheckCircle className="text-green-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">
                                                <ClientName clientId={delivery.clientId} />
                                            </p>
                                            <p className="text-xs text-muted-foreground">{format((delivery.createdAt as Timestamp).toDate(), "dd MMM, yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter opacity-60">Seu Ganho</p>
                                        <p className="text-base font-bold text-foreground">+{delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-tighter">Finalizado</p>
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {!isLoading && (!deliveries || deliveries.length === 0) && (
                            <div className="text-center py-10 border rounded-xl">
                                <Wallet className="mx-auto text-muted-foreground size-12 mb-4" />
                                <p className="font-semibold">Nenhum ganho neste período</p>
                                <p className="text-muted-foreground text-sm mt-1">Conclua entregas para ver seus ganhos aqui.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
