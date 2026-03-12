'use client';

import { useState, useMemo, useEffect } from 'react';
import { CircleDot, MapPin, Package, Bike, Wallet, Truck, CheckCircle, XCircle, Loader2, Banknote, ChevronRight, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deliveryStatuses } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Delivery, UserProfile, DeliveryStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationsPopover } from '@/components/notifications';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, limit, doc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow, startOfDay, startOfWeek, addDays, subDays, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ClientName } from '@/components/info/ClientName';

const TIMEOUT_MINUTES = 20;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

const statusDisplayConfig: Record<DeliveryStatus, { icon: React.ReactNode; iconBg: string; title: string }> = {
  pending: {
    icon: <Package className="text-amber-500 size-5" />,
    iconBg: 'bg-amber-500/10',
    title: 'Pedidos Pendentes'
  },
  accepted: {
    icon: <Bike className="text-blue-500 size-5" />,
    iconBg: 'bg-blue-500/10',
    title: 'Pedidos Aceitos'
  },
  'in-progress': {
    icon: <Truck className="text-emerald-500 size-5" />,
    iconBg: 'bg-emerald-500/10',
    title: 'Pedidos Em Trânsito'
  },
  finished: {
    icon: <CheckCircle className="text-slate-500 size-5" />,
    iconBg: 'bg-slate-500/10',
    title: 'Pedidos Finalizados'
  },
  refused: {
    icon: <XCircle className="text-red-500 size-5" />,
    iconBg: 'bg-red-500/10',
    title: 'Pedidos Recusados'
  }
};

const emptyStateMessages: Record<DeliveryStatus, { title: string; description: string }> = {
  pending: { title: 'Nenhum pedido pendente!', description: 'Novas solicitações aparecerão aqui em tempo real.' },
  accepted: { title: 'Nenhum pedido aceito', description: 'Pedidos que foram aceitos aparecerão aqui.' },
  'in-progress': { title: 'Nenhum pedido em trânsito', description: 'As entregas em andamento serão exibidas aqui.' },
  finished: { title: 'Nenhum pedido finalizado', description: 'Entregas concluídas recentemente aparecerão aqui.' },
  refused: { title: 'Nenhum pedido recusado', description: 'Entregas recusadas serão listadas aqui.' },
};

export default function AdminDashboard() {
  const adminPortrait = PlaceHolderImages.find(p => p.id === 'admin-portrait');
  const [deliveryToRefuse, setDeliveryToRefuse] = useState<Delivery | null>(null);
  const [isRefusing, setIsRefusing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DeliveryStatus>('pending');
  const { user, userProfile, loading: userLoading } = useUser();
  const { toast } = useToast();
  
  const firestore = useFirestore();

  // Queries para os Cards
  const deliveriesQuery = useMemo(() => {
    if (!firestore || !user || userProfile?.role !== 'admin') return null;
    return query(collection(firestore, 'deliveries'), where('status', '==', activeFilter), limit(20));
  }, [firestore, user, userProfile, activeFilter]);

  const dailyEarningsQuery = useMemo(() => {
    if (!firestore || !userProfile || userProfile.role !== 'admin') return null;
    const todayStart = startOfDay(new Date());
    return query(collection(firestore, 'deliveries'), where('status', '==', 'finished'), where('createdAt', '>=', todayStart));
  }, [firestore, userProfile]);

  // Lógica para Pagamentos da Semana (Segunda a Sábado)
  const weeklyRange = useMemo(() => {
    const now = new Date();
    const day = getDay(now);
    const referenceDate = day === 0 ? subDays(now, 1) : now;
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const end = addDays(start, 5);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, []);

  const weeklyPaymentsQuery = useMemo(() => {
    if (!firestore || !userProfile || userProfile.role !== 'admin') return null;
    return query(
      collection(firestore, 'deliveries'), 
      where('status', '==', 'finished'), 
      where('createdAt', '>=', weeklyRange.start),
      where('createdAt', '<=', weeklyRange.end)
    );
  }, [firestore, userProfile, weeklyRange]);

  const { data: rawRequests, loading: loadingRequests } = useCollection<Delivery>(deliveriesQuery);
  const { data: finishedDeliveries, loading: loadingEarnings } = useCollection<Delivery>(dailyEarningsQuery);
  const { data: weeklyFinished, loading: loadingWeekly } = useCollection<Delivery>(weeklyPaymentsQuery);
  
  // Lógica de cancelamento automático por tempo
  useEffect(() => {
    if (!firestore || !rawRequests || activeFilter !== 'pending') return;

    const now = new Date().getTime();
    rawRequests.forEach(req => {
      if (req.status === 'pending' && req.createdAt) {
        const creationTime = req.createdAt.toDate().getTime();
        const diff = now - creationTime;

        if (diff > TIMEOUT_MS) {
          const docRef = doc(firestore, 'deliveries', req.id);
          updateDoc(docRef, { 
            status: 'refused', 
            observations: 'Cancelado automaticamente: O administrador não aceitou o pedido em 20 minutos.' 
          }).catch(console.error);
        }
      }
    });
  }, [rawRequests, firestore, activeFilter]);

  const requests = useMemo(() => {
    if (!rawRequests) return [];
    return [...rawRequests].sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
  }, [rawRequests]);

  const dailyEarnings = useMemo(() => {
    if (!finishedDeliveries) return 0;
    return finishedDeliveries.reduce((sum, delivery) => sum + delivery.price, 0);
  }, [finishedDeliveries]);

  const weeklyTotal = useMemo(() => {
    if (!weeklyFinished) return 0;
    return weeklyFinished.reduce((sum, delivery) => sum + delivery.price, 0);
  }, [weeklyFinished]);

  const handleAcceptDirectly = async (delivery: Delivery) => {
    if (!firestore || !user?.uid) return;
    setIsActionLoading(delivery.id);
    
    const deliveryRef = doc(firestore, 'deliveries', delivery.id);
    const clientNotifRef = doc(collection(firestore, 'notifications'));
    const batch = writeBatch(firestore);

    batch.update(deliveryRef, {
      courierId: user.uid,
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });

    batch.set(clientNotifRef, {
      userId: delivery.clientId,
      title: 'Seu pedido foi aceito!',
      description: 'O administrador aceitou seu pedido e está preparando a coleta.',
      createdAt: serverTimestamp(),
      read: false,
      icon: 'package',
      link: '/client'
    });

    try {
      await batch.commit();
      toast({ title: "Pedido Aceito!" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao aceitar", variant: "destructive" });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleUpdateStatus = async (delivery: Delivery, newStatus: DeliveryStatus) => {
    if (!firestore) return;
    setIsActionLoading(delivery.id);
    const deliveryRef = doc(firestore, 'deliveries', delivery.id);
    
    try {
      await updateDoc(deliveryRef, { 
        status: newStatus,
        ...(newStatus === 'finished' ? { finishedAt: serverTimestamp() } : {})
      });
      toast({ title: newStatus === 'in-progress' ? "Viagem Iniciada!" : "Entrega Finalizada!" });
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleCancelAction = (delivery: Delivery, shouldCharge: boolean) => {
    if (!firestore) return;
    setIsRefusing(true);
    const deliveryRef = doc(firestore, 'deliveries', delivery.id);
    const clientNotifRef = doc(collection(firestore, 'notifications'));

    const batch = writeBatch(firestore);
    let baseReason = delivery.cancelRequested ? 'Cancelamento solicitado pela loja.' : 'Recusado pelo administrador.';
    
    if (shouldCharge) {
      const finalReason = `${baseReason} Cobrança de deslocamento aplicada pela central.`;
      batch.update(deliveryRef, { 
        status: 'finished', 
        observations: finalReason,
        finishedAt: serverTimestamp()
      });
      
      batch.set(clientNotifRef, {
        userId: delivery.clientId,
        title: 'Entrega Cancelada (Com Taxa)',
        description: finalReason,
        createdAt: serverTimestamp(),
        read: false,
        icon: 'alert',
        link: '/client/history'
      });
    } else {
      const finalReason = `${baseReason} Sem cobrança de taxa de corrida.`;
      batch.update(deliveryRef, { 
        status: 'refused', 
        observations: finalReason,
        price: 0 
      });

      batch.set(clientNotifRef, {
        userId: delivery.clientId,
        title: 'Entrega Recusada/Cancelada',
        description: finalReason,
        createdAt: serverTimestamp(),
        read: false,
        icon: 'alert',
        link: '/client/history'
      });
    }

    batch.commit().then(() => {
      toast({ title: shouldCharge ? "Cancelado com Cobrança" : "Cancelado sem Cobrança" });
      setDeliveryToRefuse(null);
    }).catch(serverError => {
      const permissionError = new FirestorePermissionError({
        path: deliveryRef.path,
        operation: 'update',
        requestResourceData: { status: shouldCharge ? 'finished' : 'refused' }
      });
      errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
      setIsRefusing(false);
    });
  };

  const isLoading = userLoading || loadingRequests;
  
  return (
    <div className="flex flex-col h-full bg-background outline-none" tabIndex={-1}>
      <header className="flex items-center justify-between px-6 pt-6 pb-4 bg-background z-10 shrink-0">
        <Link href="/admin/settings" className="flex items-center gap-3 group">
          <div className="size-12 overflow-hidden rounded-full border-2 border-primary/20 bg-primary/10 flex items-center justify-center group-hover:border-primary/50 transition-colors">
            {adminPortrait && <Image alt="Admin Portrait" className="w-full h-full object-cover" src={adminPortrait.imageUrl} width={48} height={48} data-ai-hint={adminPortrait.imageHint} />}
          </div>
          <div>
            <h1 className="text-xs font-medium text-muted-foreground">Lucas Expresso</h1>
            <p className="text-lg font-bold text-foreground leading-none font-headline">Painel Admin</p>
          </div>
        </Link>
        <NotificationsPopover />
      </header>

      <main className="flex-1 overflow-y-auto pb-28 outline-none">
        <section className="grid grid-cols-2 gap-4 px-6 mt-4">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <Wallet className="text-primary size-6 mb-2" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ganhos Hoje</p>
              {loadingEarnings ? <Skeleton className="h-6 w-20 mt-1" /> : <p className="text-xl font-bold">{dailyEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
            </CardContent>
          </Card>
          
          <Link href="/admin/finance/history" className="block active:scale-[0.98] transition-transform">
            <Card className="rounded-2xl shadow-sm bg-primary/5 border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="p-5">
                <TrendingUp className="text-primary size-6 mb-2" />
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Faturamento Semana</p>
                {loadingWeekly ? <Skeleton className="h-6 w-20 mt-1" /> : <p className="text-xl font-bold text-primary">{weeklyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/admin/finance/weekly-payouts" className="col-span-2 block active:scale-[0.98] transition-transform">
            <Card className="rounded-2xl shadow-sm bg-muted/30 border-muted-foreground/10 hover:border-muted-foreground/20 transition-colors">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="text-muted-foreground size-5" />
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pagamentos Semana (Seg-Sáb)</p>
                  </div>
                  {loadingWeekly ? <Skeleton className="h-8 w-32 mt-1" /> : <p className="text-2xl font-black text-foreground">{weeklyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Total Bruto</p>
                    <p className="text-xs font-semibold text-muted-foreground">{weeklyFinished?.length || 0} entregas</p>
                  </div>
                  <ChevronRight className="text-muted-foreground/40 size-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>

        <section className="px-6 py-6">
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            {deliveryStatuses.map((status) => (
              <Button
                key={status.key}
                variant={activeFilter === status.key ? 'default' : 'outline'}
                onClick={() => setActiveFilter(status.key as DeliveryStatus)}
                className="rounded-full shrink-0"
              >
                {status.name}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : requests.length > 0 ? (
              requests.map((req) => (
                <Card key={req.id} className={cn("p-4 rounded-2xl shadow-sm transition-all", req.cancelRequested && "border-red-500 bg-red-50/10")}>
                  {req.cancelRequested && (
                    <div className="mb-3 p-2 bg-red-500/10 border border-red-200 rounded-lg flex items-center gap-2 animate-pulse">
                      <AlertTriangle className="size-4 text-red-600" />
                      <p className="text-[10px] font-black text-red-600 uppercase">O Cliente solicitou o cancelamento</p>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", statusDisplayConfig[req.status]?.iconBg)}>
                        {statusDisplayConfig[req.status]?.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm leading-tight"><ClientName clientId={req.clientId} /></h4>
                        <div className="flex items-center gap-1.5 mt-1">
                            {req.paymentMethod === 'credit' ? (
                                <Badge variant="outline" className="text-[8px] uppercase px-1.5 h-4 text-muted-foreground">Crediário</Badge>
                            ) : (
                                <Badge className="bg-emerald-500 text-white text-[8px] uppercase px-1.5 h-4">Receber</Badge>
                            )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {req.createdAt ? formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
                    </Badge>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <CircleDot className="text-primary size-4" />
                      <p className="text-xs truncate">{req.pickup}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="text-red-500 size-4" />
                      <p className="text-xs truncate">{req.dropoff}</p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold">R${req.price.toFixed(2)}</p>
                    <div className="flex gap-2 flex-1 justify-end">
                      {isActionLoading === req.id ? (
                        <Button disabled size="sm" className="w-24"><Loader2 className="animate-spin size-4" /></Button>
                      ) : (
                        <>
                          {req.status === 'pending' && (
                            <>
                              <Button 
                                variant={req.cancelRequested ? "destructive" : "outline"} 
                                size="sm" 
                                onClick={() => setDeliveryToRefuse(req)}
                              >
                                {req.cancelRequested ? 'Confirmar Cancelamento' : 'Recusar'}
                              </Button>
                              <Button size="sm" onClick={() => handleAcceptDirectly(req)} disabled={req.cancelRequested}>Aceitar</Button>
                            </>
                          )}
                          {req.status === 'accepted' && (
                            <>
                              <Button variant="outline" asChild size="sm"><Link href={`/admin/track/${req.id}`}>Mapa</Link></Button>
                              <Button size="sm" onClick={() => handleUpdateStatus(req, 'in-progress')}>Iniciar Viagem</Button>
                            </>
                          )}
                          {req.status === 'in-progress' && (
                            <>
                              <Button variant="outline" asChild size="sm"><Link href={`/admin/track/${req.id}`}>Rastrear</Link></Button>
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleUpdateStatus(req, 'finished')}>Finalizar</Button>
                            </>
                          )}
                          {req.status === 'finished' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Concluído</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 border rounded-2xl">
                <p className="font-semibold">{emptyStateMessages[activeFilter].title}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <AlertDialog open={!!deliveryToRefuse} onOpenChange={(isOpen) => !isOpen && setDeliveryToRefuse(null)}>
        <AlertDialogContent className="rounded-3xl max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deliveryToRefuse?.cancelRequested ? 'Confirmar Cancelamento?' : 'Recusar este Pedido?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              {deliveryToRefuse?.cancelRequested 
                ? 'A loja solicitou o cancelamento. Deseja cobrar a corrida por conta de deslocamento?' 
                : 'Você está recusando o pedido da loja. Como deseja prosseguir com a cobrança?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex flex-col gap-3 py-4">
            <Button 
              variant="destructive" 
              className="h-14 rounded-2xl font-bold text-base shadow-lg shadow-destructive/20 active:scale-95 transition-all"
              onClick={() => deliveryToRefuse && handleCancelAction(deliveryToRefuse, true)}
              disabled={isRefusing}
            >
              {isRefusing ? <Loader2 className="animate-spin" /> : 'Confirmar e COBRAR valor'}
            </Button>
            
            <Button 
              variant="outline" 
              className="h-14 rounded-2xl font-bold text-base border-destructive/30 text-destructive hover:bg-destructive/5 active:scale-95 transition-all"
              onClick={() => deliveryToRefuse && handleCancelAction(deliveryToRefuse, false)}
              disabled={isRefusing}
            >
              {isRefusing ? <Loader2 className="animate-spin" /> : 'Confirmar SEM cobrar nada'}
            </Button>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="w-full rounded-2xl h-12 font-medium" disabled={isRefusing}>
              Voltar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}