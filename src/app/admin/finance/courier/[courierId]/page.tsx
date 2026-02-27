'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, MoreHorizontal, CheckCircle, XCircle, ChevronLeft, ChevronRight, Bike, Wallet, MapPin, Package, CreditCard, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, collection, query, where, orderBy, getDocs, Timestamp, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { UserProfile, Delivery } from '@/lib/types';
import { format, startOfWeek, addDays, subDays, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ClientName } from '@/components/info/ClientName';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { FinanceGuard } from "@/components/FinanceGuard";

export default function CourierFinanceDetailsPage() {
  const params = useParams();
  const courierId = params.courierId as string;
  const { userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPaying, setIsPaying] = useState(false);

  const { weekStart, weekEnd } = useMemo(() => {
    const dateForWeekCalc = getDay(currentDate) === 0 ? subDays(currentDate, 1) : currentDate;
    const start = startOfWeek(dateForWeekCalc, { weekStartsOn: 1 }); // Monday
    const end = addDays(start, 5); // Saturday

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { weekStart: start, weekEnd: end };
  }, [currentDate]);

  const courierRef = useMemo(() => {
    if (!firestore || !courierId || !userProfile || userProfile.role !== 'admin') return null;
    return doc(firestore, 'users', courierId);
  }, [firestore, courierId, userProfile]);

  const { data: courier, loading: courierLoading } = useDoc<UserProfile>(courierRef);

  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);

  const fetchDeliveries = async () => {
    if (!firestore || !courierId || !userProfile || userProfile.role !== 'admin') return;
    setDeliveriesLoading(true);
    const q = query(
        collection(firestore, 'deliveries'), 
        where('courierId', '==', courierId),
        where('status', '==', 'finished'),
        where('createdAt', '>=', weekStart),
        where('createdAt', '<=', weekEnd),
        orderBy('createdAt', 'desc')
    );

    getDocs(q)
        .then(snapshot => {
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery));
            setDeliveries(data);
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: 'deliveries',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setDeliveries([]);
        })
        .finally(() => {
            setDeliveriesLoading(false);
        });
  };

  useEffect(() => {
    fetchDeliveries();
  }, [firestore, courierId, userProfile, weekStart, weekEnd]);

  const unpaidDeliveries = useMemo(() => {
    return deliveries?.filter(d => !d.paid) || [];
  }, [deliveries]);

  const totalUnpaid = useMemo(() => {
    return unpaidDeliveries.reduce((sum, d) => sum + d.price, 0);
  }, [unpaidDeliveries]);

  const totalEarned = useMemo(() => {
    if (!deliveries) return 0;
    return deliveries.reduce((sum, d) => sum + d.price, 0);
  }, [deliveries]);

  const handlePayDeliveries = async () => {
    if (!firestore || !courierId || unpaidDeliveries.length === 0) return;
    
    setIsPaying(true);
    const batch = writeBatch(firestore);
    
    unpaidDeliveries.forEach(delivery => {
        const dRef = doc(firestore, 'deliveries', delivery.id);
        batch.update(dRef, { paid: true });
    });

    const notifRef = doc(collection(firestore, 'notifications'));
    batch.set(notifRef, {
        userId: courierId,
        title: 'Pagamento Realizado!',
        description: `O repasse referente à semana de ${format(weekStart, 'dd/MM')} foi enviado.`,
        createdAt: serverTimestamp(),
        read: false,
        icon: 'wallet'
    });

    batch.commit()
        .then(() => {
            toast({
                title: "Pagamento Confirmado!",
                description: `${unpaidDeliveries.length} entregas marcadas como pagas.`,
            });
            fetchDeliveries();
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: 'deliveries/batch',
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsPaying(false);
        });
  };

  const isLoading = userLoading || courierLoading || deliveriesLoading;

  const handleNextWeek = () => setCurrentDate(current => addDays(current, 7));
  const handlePrevWeek = () => setCurrentDate(current => subDays(current, 7));

  return (
    <FinanceGuard>
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/finance/weekly-payouts">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-lg font-bold tracking-tight font-headline">Extrato do Entregador</h1>
           <Button variant="ghost" size="icon">
            <MoreHorizontal />
          </Button>
        </div>
        <div className="flex items-center gap-4">
            {isLoading ? <Skeleton className="size-14 rounded-xl" /> : (
                <Avatar className="size-14 rounded-xl border-2 border-primary/10">
                    <AvatarImage src={courier?.photoURL || ''} alt={courier?.displayName || ''} />
                    <AvatarFallback className="text-xl font-bold bg-muted text-muted-foreground">
                        {courier?.displayName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            )}
            <div>
                {isLoading ? (
                    <>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-32 mt-1" />
                    </>
                ) : (
                    <>
                        <h2 className="text-lg font-bold">{courier?.displayName}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{courier?.userType || 'Entregador'}</p>
                    </>
                )}
            </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-48">
        <section className="mb-6">
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
        </section>

        <Tabs defaultValue="extrato" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="extrato" className="font-bold">Extrato</TabsTrigger>
                <TabsTrigger value="pagar" className="font-bold relative">
                    Pagar
                    {unpaidDeliveries.length > 0 && (
                        <span className="absolute -top-1 -right-1 size-4 bg-red-500 text-[10px] text-white flex items-center justify-center rounded-full">
                            {unpaidDeliveries.length}
                        </span>
                    )}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="extrato" className="space-y-6">
                <section className="grid grid-cols-2 gap-3">
                    <Card className="p-4 bg-primary/10 border-primary/20">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Total da Semana</p>
                        {isLoading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                            <p className="text-lg font-bold text-primary">
                                {totalEarned.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        )}
                    </Card>
                    <Card className="p-4 bg-muted/50 border">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Entregas</p>
                        {isLoading ? <Skeleton className="h-6 w-10 mt-1" /> : (
                            <p className="text-lg font-bold">
                                {deliveries?.length || 0}
                            </p>
                        )}
                    </Card>
                </section>

                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Histórico de Entregas</h2>
                    </div>
                    <div className="space-y-3">
                        {isLoading && Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                        {!isLoading && deliveries?.map(delivery => (
                            <DeliveryCardItem key={delivery.id} delivery={delivery} />
                        ))}
                        {!isLoading && (!deliveries || deliveries.length === 0) && (
                            <EmptyState />
                        )}
                    </div>
                </section>
            </TabsContent>

            <TabsContent value="pagar" className="space-y-6">
                <section className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
                    <CreditCard className="size-10 text-amber-600 mx-auto mb-3" />
                    <p className="text-sm font-bold text-amber-800 uppercase tracking-tight">Valor Pendente de Repasse</p>
                    <h2 className="text-4xl font-black text-amber-600 mt-1">
                        {totalUnpaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h2>
                    <p className="text-xs text-amber-700/70 mt-2">{unpaidDeliveries.length} entregas aguardando acerto</p>
                </section>

                <section className="space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Itens a Pagar</h3>
                    {unpaidDeliveries.length > 0 ? (
                        unpaidDeliveries.map(delivery => (
                            <DeliveryCardItem key={delivery.id} delivery={delivery} hideStatus />
                        ))
                    ) : (
                        <div className="text-center py-10 border-2 border-dashed rounded-3xl bg-emerald-500/5 border-emerald-500/20">
                            <CheckCircle className="size-10 text-emerald-500 mx-auto mb-3" />
                            <p className="font-bold text-emerald-700 text-sm">Tudo em dia!</p>
                            <p className="text-xs text-emerald-600/70 mt-1">Não há pagamentos pendentes para esta semana.</p>
                        </div>
                    )}
                </section>

                {unpaidDeliveries.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent pb-8 z-40 max-w-md mx-auto pointer-events-none">
                        <Button 
                            className="w-full py-7 rounded-2xl text-base font-bold shadow-2xl shadow-primary/30 gap-2 pointer-events-auto"
                            onClick={handlePayDeliveries}
                            disabled={isPaying}
                        >
                            {isPaying ? <Loader2 className="animate-spin" /> : <Wallet className="size-5" />}
                            {isPaying ? 'Processando...' : `Confirmar Pagamento (${totalUnpaid.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})})`}
                        </Button>
                    </div>
                )}
            </TabsContent>
        </Tabs>
      </main>
    </FinanceGuard>
  );
}

function DeliveryCardItem({ delivery, hideStatus = false }: { delivery: Delivery, hideStatus?: boolean }) {
    return (
        <Card className={`p-4 rounded-2xl border-l-4 ${delivery.paid ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`size-8 rounded-lg ${delivery.paid ? 'bg-emerald-500/10' : 'bg-amber-500/10'} flex items-center justify-center`}>
                        {delivery.paid ? <CheckCircle className="size-4 text-emerald-600" /> : <Package className="size-4 text-amber-600" />}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <p className="font-black text-foreground">{delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    {!hideStatus && (
                        <Badge variant={delivery.paid ? 'default' : 'outline'} className={delivery.paid ? 'bg-emerald-500 text-white' : 'text-amber-600 border-amber-200'}>
                            {delivery.paid ? 'Pago' : 'Pendente'}
                        </Badge>
                    )}
                </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Package className="size-3 text-primary" />
                    <span className="font-bold"><ClientName clientId={delivery.clientId} /></span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" />
                    <span className="truncate">{delivery.dropoff}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                    <span>{format((delivery.createdAt as Timestamp).toDate(), "dd/MM/yyyy 'às' HH:mm", {locale: ptBR})}</span>
                </div>
            </div>
        </Card>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-muted/20">
            <Bike className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-bold text-muted-foreground">Nenhuma entrega no período</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Use o seletor acima para navegar nas semanas.</p>
        </div>
    );
}
