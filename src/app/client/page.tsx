
'use client';

import { useMemo, useEffect, useState } from 'react';
import { CheckCircle, Package, Plus, Timer, XCircle, ShieldCheck, AlertOctagon, CreditCard, ChevronRight, Loader2, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, query, where, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationsPopover } from '@/components/notifications';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import type { Delivery, AppStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CourierName } from '@/components/info/CourierName';
import { cn, checkClientBlockStatus } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
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

const TIMEOUT_MINUTES = 20;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

export default function ClientHomePage() {
  const { user, userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [deliveryToCancel, setDeliveryToCancel] = useState<Delivery | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Status do Admin
  const statusDocRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'status', 'main');
  }, [firestore, user?.uid]);

  const { data: appStatus, loading: statusLoading } = useDoc<AppStatus>(statusDocRef);
  const isAdminOnline = appStatus?.adminOnline;

  const inProgressQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'deliveries'), where('clientId', '==', user.uid), where('status', '==', 'in-progress'));
  }, [firestore, user?.uid]);

  const pendingQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'deliveries'), where('clientId', '==', user.uid), where('status', '==', 'pending'));
  }, [firestore, user?.uid]);

  const allDeliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'deliveries'), where('clientId', '==', user.uid));
  }, [firestore, user?.uid]);

  const { data: inProgressDeliveries, loading: loadingInProgress } = useCollection<Delivery>(inProgressQuery);
  const { data: pendingDeliveries, loading: loadingPending } = useCollection<Delivery>(pendingQuery);
  const { data: allDeliveries, loading: loadingRecent } = useCollection<Delivery>(allDeliveriesQuery);

  // Lógica de Bloqueio Financeiro
  const unpaidDeliveries = useMemo(() => {
    return allDeliveries?.filter(d => d.status === 'finished' && !d.paidByClient) || [];
  }, [allDeliveries]);

  const blockStatus = useMemo(() => checkClientBlockStatus(unpaidDeliveries), [unpaidDeliveries]);

  // Lógica de cancelamento automático por tempo para o Cliente
  useEffect(() => {
    if (!firestore || !pendingDeliveries) return;

    const now = new Date().getTime();
    pendingDeliveries.forEach(req => {
      if (req.status === 'pending' && req.createdAt) {
        const creationTime = req.createdAt.toDate().getTime();
        const diff = now - creationTime;

        if (diff > TIMEOUT_MS) {
          const docRef = doc(firestore, 'deliveries', req.id);
          const updateData = { 
            status: 'refused', 
            observations: 'Cancelado automaticamente: O administrador não aceitou o pedido em 20 minutos.' 
          };
          
          updateDoc(docRef, updateData).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
          });
        }
      }
    });
  }, [pendingDeliveries, firestore]);

  const recentDeliveries = useMemo(() => {
    if (!allDeliveries) return null;
    return [...allDeliveries]
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
      .slice(0, 3);
  }, [allDeliveries]);

  const handleRequestCancellation = async () => {
    if (!firestore || !deliveryToCancel || !userProfile) return;
    
    setIsCancelling(true);
    const docRef = doc(firestore, 'deliveries', deliveryToCancel.id);
    const updateData = { cancelRequested: true };

    try {
      const batch = writeBatch(firestore);
      batch.update(docRef, updateData);

      // Notifica o admin
      const adminNotifRef = doc(collection(firestore, 'notifications'));
      batch.set(adminNotifRef, {
        userId: 'admin',
        title: 'Cancelamento Solicitado',
        description: `A loja ${userProfile.displayName} solicitou o cancelamento de um pedido.`,
        createdAt: serverTimestamp(),
        read: false,
        icon: 'alert'
      });

      await batch.commit();
      
      toast({
        title: "Solicitação Enviada",
        description: "Aguardando confirmação do administrador.",
      });
      setDeliveryToCancel(null);
    } catch (serverError: any) {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: updateData,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        title: "Erro ao solicitar",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const isLoading = userLoading || loadingInProgress || loadingPending || loadingRecent;
  
  return (
    <div className="flex flex-col h-full bg-background outline-none" tabIndex={-1}>
      <header className="flex items-center justify-between px-6 pt-8 pb-4 sticky top-0 z-10 bg-background/80 backdrop-blur-md outline-none">
        <Link href="/client/settings" className="flex items-center gap-3 group">
          <Avatar className="size-12 border-2 border-primary group-hover:border-primary/50 transition-colors">
            {userProfile?.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName || 'Client'} />}
            <AvatarFallback>{userProfile?.displayName?.charAt(0) || 'C'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Bem-vindo de volta,</p>
            {userLoading ? <Skeleton className="h-5 w-32 mt-1" /> : <h2 className="text-lg font-bold leading-tight font-headline">{userProfile?.displayName || 'Cliente'}</h2>}
          </div>
        </Link>
        <div className="flex gap-2">
          <NotificationsPopover />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 outline-none">
        
        {/* Banner de Bloqueio ou Aviso Financeiro */}
        {!isLoading && blockStatus.isBlocked && (
          <section className="px-6 py-2">
            <Link href="/client/finance">
              <Card className="bg-destructive border-none shadow-lg text-destructive-foreground overflow-hidden">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="size-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <AlertOctagon className="size-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase tracking-tight leading-none">Acesso Bloqueado</p>
                    <p className="text-[10px] opacity-90 mt-1">O prazo de pagamento venceu. Regularize seu saldo para solicitar novas entregas.</p>
                  </div>
                  <ChevronRight className="size-5 opacity-50" />
                </CardContent>
              </Card>
            </Link>
          </section>
        )}

        {!isLoading && !blockStatus.isBlocked && blockStatus.isGracePeriod && blockStatus.hasDebt && (
          <section className="px-6 py-2">
            <Link href="/client/finance">
              <Card className="bg-amber-500 border-none shadow-lg text-white overflow-hidden">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="size-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <CreditCard className="size-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase tracking-tight leading-none">Aviso de Pagamento</p>
                    <p className="text-[10px] opacity-90 mt-1">O ciclo semanal fechou. Você tem até quarta-feira para pagar sem bloqueio.</p>
                  </div>
                  <ChevronRight className="size-5 opacity-50" />
                </CardContent>
              </Card>
            </Link>
          </section>
        )}

        {/* Mini Card de Status do Admin */}
        <section className="px-6 py-2">
          <Card className="bg-muted/30 border-none shadow-none rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-background flex items-center justify-center border border-border shadow-sm">
                  <ShieldCheck className={cn("size-4", isAdminOnline ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">Logística Lucas-Expresso</p>
                  <p className="text-xs font-bold mt-0.5">Admin Central</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-full border border-border shadow-sm">
                <span className={cn("size-1.5 rounded-full", isAdminOnline ? "bg-green-500 animate-pulse" : "bg-slate-400")}></span>
                <span className={cn("text-[10px] font-black uppercase tracking-tighter", isAdminOnline ? "text-green-600" : "text-slate-500")}>
                  {statusLoading ? '...' : (isAdminOnline ? 'Admin Online' : 'Admin Offline')}
                </span>
              </div>
            </div>
          </Card>
        </section>

        <section className="px-6 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 font-headline">
            Resumo de Entregas
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="rounded-xl border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <Package className="text-primary size-7" />
                  <div className="text-[10px] font-bold py-0.5 px-2 rounded-full bg-primary text-primary-foreground">
                    ATIVO
                  </div>
                </div>
                {isLoading ? <Skeleton className="h-8 w-10 mt-2" /> : <p className="text-3xl font-bold mt-2 font-headline">{inProgressDeliveries?.length || 0}</p>}
                <p className="text-sm font-medium text-muted-foreground">Em Trânsito</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl bg-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <Timer className="text-muted-foreground size-7" />
                </div>
                {isLoading ? <Skeleton className="h-8 w-10 mt-2" /> : <p className="text-3xl font-bold mt-2 text-muted-foreground font-headline">{pendingDeliveries?.length || 0}</p>}
                <p className="text-sm font-medium text-muted-foreground">Pendente</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="px-6 py-4">
          {isLoading ? (
            <Button className="w-full font-bold py-6 rounded-xl text-base opacity-70" disabled>
              <Loader2 className="animate-spin size-5" />
              Verificando status...
            </Button>
          ) : blockStatus.isBlocked ? (
            <Button className="w-full font-bold py-6 rounded-xl text-base" variant="destructive" disabled>
              <Plus className="size-5" />
              Solicitar Nova Entrega
            </Button>
          ) : (
            <Button asChild className="w-full font-bold py-6 rounded-xl text-base">
              <Link href="/client/request">
                <Plus className="size-5" />
                Solicitar Nova Entrega
              </Link>
            </Button>
          )}
          
          {!isLoading && blockStatus.isBlocked && (
            <div className="mt-3 p-3 bg-destructive/10 rounded-xl border border-destructive/20">
              <p className="text-center text-xs text-destructive font-bold leading-tight">
                ACESSO BLOQUEADO POR PENDÊNCIA FINANCEIRA.<br/>
                <span className="font-normal opacity-80">Regularize seu saldo para voltar a solicitar entregas.</span>
              </p>
            </div>
          )}
        </section>
        
        <section className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold font-headline">Últimos Pedidos</h3>
            <Button asChild variant="link" className="text-sm font-semibold text-primary">
              <Link href="/client/history">Ver Histórico</Link>
            </Button>
          </div>
          <div className="space-y-4">
            {isLoading && (
              <>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </>
            )}
            {!isLoading && recentDeliveries?.map(order => (
              <RecentOrderCard key={order.id} delivery={order} onCancel={setDeliveryToCancel} />
            ))}
            {!isLoading && (!recentDeliveries || recentDeliveries.length === 0) && (
              <div className="text-center py-10 border rounded-2xl">
                  <p className="font-semibold">Nenhum pedido recente</p>
                  <p className="text-muted-foreground text-sm mt-1">Suas entregas recentes aparecerão aqui.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <AlertDialog open={!!deliveryToCancel} onOpenChange={(open) => !open && setDeliveryToCancel(null)}>
        <AlertDialogContent className="rounded-3xl max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar Cancelamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O administrador será notificado e precisará confirmar o cancelamento deste pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="rounded-xl" disabled={isCancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleRequestCancellation();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
              disabled={isCancelling}
            >
              {isCancelling ? <Loader2 className="animate-spin size-4" /> : 'Confirmar Solicitação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const statusConfig = {
  'pending': { label: 'PENDENTE', icon: <Timer className="text-amber-500" />, className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
  'accepted': { label: 'ACEITO', icon: <Package className="text-blue-500" />, className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  'in-progress': { label: 'EM TRÂNSITO', icon: <Package className="text-primary" />, className: 'bg-primary/10 text-primary' },
  'finished': { label: 'CONCLUÍDO', icon: <CheckCircle className="text-green-500" />, className: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  'refused': { label: 'RECUSADO', icon: <XCircle className="text-red-500" />, className: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
};


function RecentOrderCard({ delivery, onCancel }: { delivery: Delivery, onCancel?: (delivery: Delivery) => void }) {
  const currentStatus = delivery.cancelRequested 
    ? { label: 'CANC. SOLICITADO', icon: <AlertTriangle className="text-red-500 size-5" />, className: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
    : (statusConfig[delivery.status] || statusConfig.pending);

  const isFinished = delivery.status === 'finished';
  const isRefused = delivery.status === 'refused';
  const isPending = delivery.status === 'pending';
  
  const timeText = isFinished && delivery.finishedAt 
    ? formatDistanceToNow(delivery.finishedAt.toDate(), { addSuffix: true, locale: ptBR })
    : (delivery.createdAt 
        ? formatDistanceToNow(delivery.createdAt.toDate(), { addSuffix: true, locale: ptBR })
        : 'agora');

  const hourText = isFinished && (delivery.finishedAt || delivery.createdAt)
    ? ` • Entregue às ${format((delivery.finishedAt || delivery.createdAt).toDate(), 'HH:mm')}`
    : '';

  // Verifica se foi cancelado por tempo
  const isTimeOutCancellation = isRefused && delivery.observations?.includes('20 minutos');

  return (
    <Card className="p-4 rounded-xl relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={cn('size-10 rounded-lg flex items-center justify-center', currentStatus.className)}>
            {currentStatus.icon}
          </div>
          <div>
            <h4 className="font-bold text-sm font-headline max-w-[150px] truncate">{delivery.dropoff}</h4>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={cn('px-2 py-1 rounded text-[10px] font-bold', currentStatus.className)}>
            {currentStatus.label}
          </div>
          {isPending && !delivery.courierId && !delivery.cancelRequested && (
            <Button 
              variant="outline" 
              size="icon" 
              className="size-7 rounded-full text-destructive border-destructive/20 hover:bg-destructive/10"
              onClick={() => onCancel?.(delivery)}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <Separator className="my-3"/>
      <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            {timeText}{hourText}
          </div>
          <div className="flex flex-col items-end gap-1">
            {isRefused ? (
              <span className="text-red-500 font-bold uppercase text-[10px] text-right max-w-[180px]">
                {isTimeOutCancellation ? 'Não aceita no prazo' : (delivery.cancelRequested ? 'Cancelamento Confirmado' : 'Recusada pelo Admin')}
              </span>
            ) : (
              <>
                {delivery.courierId && (
                   <div className="font-medium text-muted-foreground flex items-center gap-1">
                     Entregador: <span className="font-bold text-foreground"><CourierName courierId={delivery.courierId} /></span>
                   </div>
                )}
                {isFinished && (
                   <span className="font-bold text-primary">
                    {delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                   </span>
                )}
                {!delivery.courierId && !isFinished && !isRefused && (
                  <span className="text-muted-foreground italic">
                    {delivery.cancelRequested ? 'Aguardando Admin...' : 'Aguardando entregador...'}
                  </span>
                )}
              </>
            )}
          </div>
      </div>
    </Card>
  );
}
