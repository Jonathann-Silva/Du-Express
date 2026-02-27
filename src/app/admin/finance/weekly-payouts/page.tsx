'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Banknote, Bike, ChevronLeft, ChevronRight, Wallet, ChevronRight as ChevronIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Delivery, UserProfile } from '@/lib/types';
import { format, startOfWeek, addDays, subDays, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FinanceGuard } from "@/components/FinanceGuard";

type CourierPayout = {
    courierId: string;
    courierName: string;
    courierPhoto?: string | null;
    totalAmount: number;
    deliveryCount: number;
};

export default function WeeklyPayoutsPage() {
    const { userProfile, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const [currentDate, setCurrentDate] = useState(new Date());

    const { weekStart, weekEnd } = useMemo(() => {
        const day = getDay(currentDate);
        const referenceDate = day === 0 ? subDays(currentDate, 1) : currentDate;
        const start = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Segunda
        const end = addDays(start, 5); // Sábado
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { weekStart: start, weekEnd: end };
    }, [currentDate]);

    const [payouts, setPayouts] = useState<CourierPayout[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchWeeklyData() {
            if (!firestore || !userProfile || userProfile.role !== 'admin') return;
            setLoading(true);

            try {
                // 1. Buscar entregas finalizadas no período
                const deliveriesQuery = query(
                    collection(firestore, 'deliveries'),
                    where('status', '==', 'finished'),
                    where('createdAt', '>=', weekStart),
                    where('createdAt', '<=', weekEnd)
                );
                const deliveriesSnapshot = await getDocs(deliveriesQuery);
                const deliveries = deliveriesSnapshot.docs.map(doc => doc.data() as Delivery);

                // 2. Buscar todos os entregadores cadastrados
                const couriersQuery = query(collection(firestore, 'users'), where('role', '==', 'courier'));
                const couriersSnapshot = await getDocs(couriersQuery);
                const couriersMap = new Map(couriersSnapshot.docs.map(doc => [doc.id, doc.data() as UserProfile]));

                // 3. Agrupar ganhos por entregador
                const groupMap = new Map<string, { amount: number; count: number }>();
                deliveries.forEach(d => {
                    if (d.courierId) {
                        const current = groupMap.get(d.courierId) || { amount: 0, count: 0 };
                        groupMap.set(d.courierId, {
                            amount: current.amount + d.price,
                            count: current.count + 1
                        });
                    }
                });

                // 4. Mapear todos os entregadores, mesmo os que não tiveram entregas
                const result: CourierPayout[] = Array.from(couriersMap.entries()).map(([id, profile]) => {
                    const stats = groupMap.get(id) || { amount: 0, count: 0 };
                    return {
                        courierId: id,
                        courierName: profile?.displayName || 'Entregador Desconhecido',
                        courierPhoto: profile?.photoURL,
                        totalAmount: stats.amount,
                        deliveryCount: stats.count
                    };
                }).sort((a, b) => {
                    // Ordenar por valor descendente, depois por nome
                    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
                    return a.courierName.localeCompare(b.courierName);
                });

                setPayouts(result);
            } catch (error) {
                console.error("Error fetching weekly payouts:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchWeeklyData();
    }, [firestore, userProfile, weekStart, weekEnd]);

    const totalWeekly = useMemo(() => {
        return payouts?.reduce((sum, p) => sum + p.totalAmount, 0) || 0;
    }, [payouts]);

    const handleNextWeek = () => setCurrentDate(current => addDays(current, 7));
    const handlePrevWeek = () => setCurrentDate(current => subDays(current, 7));

    const isLoading = userLoading || loading;

    return (
        <FinanceGuard>
            <div className="flex flex-col h-full bg-background">
                <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b">
                    <div className="flex items-center gap-3 mb-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/admin">
                                <ArrowLeft />
                            </Link>
                        </Button>
                        <h1 className="text-lg font-bold tracking-tight font-headline">Repasses Semanais</h1>
                    </div>
                    <Card className="p-3 bg-muted/50 border">
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
                                <ChevronLeft className="size-5" />
                            </Button>
                            <div className="text-center">
                                <p className="text-sm font-bold">{format(weekStart, "d 'de' MMM", { locale: ptBR })} - {format(weekEnd, "d 'de' MMM, yyyy", { locale: ptBR })}</p>
                                <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Ciclo Seg-Sáb</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleNextWeek}>
                                <ChevronRight className="size-5" />
                            </Button>
                        </div>
                    </Card>
                </header>

                <main className="flex-1 p-4 overflow-y-auto pb-32">
                    <section className="mb-8">
                        <div className="flex flex-col items-center justify-center p-8 bg-primary/5 rounded-3xl border border-primary/10">
                            <Banknote className="size-10 text-primary mb-3" />
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Geral da Semana</p>
                            {isLoading ? <Skeleton className="h-10 w-40" /> : (
                                <h2 className="text-4xl font-black text-foreground">
                                    {totalWeekly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </h2>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-2 font-medium">Soma de todos os repasses para entregadores</p>
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-widest">Lista de Entregadores</h3>
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{payouts?.length || 0} cadastrados</span>
                        </div>

                        <div className="space-y-3">
                            {isLoading ? (
                                <>
                                    <Skeleton className="h-24 w-full rounded-2xl" />
                                    <Skeleton className="h-24 w-full rounded-2xl" />
                                    <Skeleton className="h-24 w-full rounded-2xl" />
                                </>
                            ) : payouts && payouts.length > 0 ? (
                                payouts.map((payout) => (
                                    <Link key={payout.courierId} href={`/admin/finance/courier/${payout.courierId}`} className="block active:scale-[0.98] transition-all">
                                        <Card className="p-4 rounded-2xl shadow-sm border-l-4 border-l-primary hover:border-primary transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="size-12 rounded-xl">
                                                    {payout.courierPhoto && <AvatarImage src={payout.courierPhoto} alt={payout.courierName} />}
                                                    <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                                                        {payout.courierName.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-base truncate">{payout.courierName}</h4>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Bike className="size-3" />
                                                        <span>{payout.deliveryCount} entregas feitas</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className={`text-lg font-black ${payout.totalAmount > 0 ? 'text-primary' : 'text-muted-foreground opacity-50'}`}>
                                                            {payout.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </p>
                                                        <p className="text-[9px] uppercase font-bold text-muted-foreground">Repasse</p>
                                                    </div>
                                                    <ChevronIcon className="text-muted-foreground/30 group-hover:text-primary transition-colors size-5" />
                                                </div>
                                            </div>
                                        </Card>
                                    </Link>
                                ))
                            ) : (
                                <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-muted/20">
                                    <Wallet className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="font-bold text-muted-foreground">Nenhum motoboy cadastrado</p>
                                    <p className="text-sm text-muted-foreground/60 mt-1">Vá em 'Usuários' para adicionar entregadores.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </main>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent pb-8 max-w-md mx-auto pointer-events-none">
                    <Button className="w-full py-7 rounded-2xl text-base font-bold shadow-2xl shadow-primary/30 pointer-events-auto">
                        Exportar Relatório PIX
                    </Button>
                </div>
            </div>
        </FinanceGuard>
    );
}
