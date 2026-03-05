
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Bike, Wallet, CheckCircle, CircleDot, Loader2, Map, MapPin, ShieldCheck, Banknote, CreditCard, Smartphone, QrCode, Search, RefreshCw, AlertTriangle, Timer } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { collection, query, where, doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { startOfDay } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { NotificationsPopover } from '@/components/notifications';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Delivery, AppStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ClientName } from '@/components/info/ClientName';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CourierDashboard() {
  const { user, userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  // Estado para forçar re-render do timer a cada 10 segundos
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Estados para o modal de pagamento
  const [taskToFinish, setTaskToFinish] = useState<Delivery | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [pixStep, setPixStep] = useState<'choice' | 'qrcode' | 'confirmed'>('choice');
  const [isCheckingPix, setIsCheckingPix] = useState(false);

  // Status do Admin
  const statusDocRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'status', 'main');
  }, [firestore, user]);

  const { data: appStatus, loading: statusLoading } = useDoc<AppStatus>(statusDocRef);
  const isAdminOnline = appStatus?.adminOnline;

  // Busca regras de tempo limite
  const rulesRef = useMemo(() => (
    firestore ? doc(firestore, 'settings', 'rules') : null
  ), [firestore]);
  
  const { data: rulesSetting } = useDoc<{ deliveryTimeLimit?: number }>(rulesRef);
  const timeLimitMin = rulesSetting?.deliveryTimeLimit || 60; // Padrão 60 min

  const handleStatusChange = async (isOnline: boolean) => {
    if (!firestore || !user) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
        await setDoc(userDocRef, { status: isOnline ? 'online' : 'offline' }, { merge: true });
        toast({ title: isOnline ? 'Você está Online' : 'Você está Offline' });
    } catch (error) {
        toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };
  
  const isOnline = userProfile?.status === 'online';

  const dailyStatsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    const todayStart = startOfDay(new Date());
    return query(
      collection(firestore, 'deliveries'), 
      where('courierId', '==', user.uid), 
      where('status', '==', 'finished'), 
      where('createdAt', '>=', todayStart)
    );
  }, [firestore, user]);

  const { data: dailyFinishedDeliveries } = useCollection<Delivery>(dailyStatsQuery);

  const { dailyEarnings, dailyTasksCount } = useMemo(() => {
    if (!dailyFinishedDeliveries || !userProfile) return { dailyEarnings: 0, dailyTasksCount: 0 };
    const courierRate = userProfile.deliveryRate || 6;
    const earnings = dailyFinishedDeliveries.length * courierRate;
    return { dailyEarnings: earnings, dailyTasksCount: dailyFinishedDeliveries.length };
  }, [dailyFinishedDeliveries, userProfile]);

  const myTasksQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'deliveries'), 
      where('courierId', '==', user.uid), 
      where('status', 'in', ['accepted', 'in-progress'])
    );
  }, [firestore, user]);

  const { data: rawTasks, loading: loadingTasks } = useCollection<Delivery>(myTasksQuery);

  const myTasks = useMemo(() => {
    if (!rawTasks) return [];
    return [...rawTasks].sort((a, b) => {
      // Cálculo de atraso para ordenação prioritária
      const startA = a.acceptedAt?.toDate?.()?.getTime() || a.createdAt?.toDate?.()?.getTime() || 0;
      const isDelayedA = startA && ((now - startA) / (1000 * 60) > timeLimitMin);

      const startB = b.acceptedAt?.toDate?.()?.getTime() || b.createdAt?.toDate?.()?.getTime() || 0;
      const isDelayedB = startB && ((now - startB) / (1000 * 60) > timeLimitMin);

      // Prioridade 1: Entregas em atraso no topo
      if (isDelayedA && !isDelayedB) return -1;
      if (!isDelayedA && isDelayedB) return 1;

      // Prioridade 2: Mais recentes primeiro (dentro de cada grupo)
      return startB - startA;
    });
  }, [rawTasks, now, timeLimitMin]);

  const coletasPendentes = useMemo(() => myTasks.filter(t => t.status === 'accepted'), [myTasks]);
  const entregasEmAndamento = useMemo(() => myTasks.filter(t => t.status === 'in-progress'), [myTasks]);

  const handleConfirmPickup = async (taskId: string) => {
    if (!firestore) return;
    setIsUpdating(taskId);
    const taskRef = doc(firestore, 'deliveries', taskId);
    try {
      await setDoc(taskRef, { status: 'in-progress' }, { merge: true });
      toast({ title: "Coleta Confirmada!" });
    } catch (e) {
      toast({ title: "Erro na coleta", variant: "destructive" });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleFinishClick = (task: Delivery) => {
    if (task.paymentMethod === 'collect') {
      setTaskToFinish(task);
      setPixStep('choice');
      setIsPaymentDialogOpen(true);
    } else {
      handleFinishDelivery(task);
    }
  };

  const handleFinishDelivery = async (task: Delivery, finalMethod?: 'pix' | 'cash') => {
    if (!firestore || !user) return;
    setIsUpdating(task.id);
    const taskRef = doc(firestore, 'deliveries', task.id);
    const clientNotifRef = doc(collection(firestore, 'notifications'));
    const batch = writeBatch(firestore);

    const updateData: any = { 
      status: 'finished',
      finishedAt: serverTimestamp()
    };

    if (finalMethod) {
      updateData.paymentMethod = finalMethod;
    }

    batch.update(taskRef, updateData);
    
    batch.set(clientNotifRef, {
        userId: task.clientId,
        title: 'Pedido Entregue!',
        description: `Sua entrega para ${task.dropoff} foi finalizada.`,
        createdAt: serverTimestamp(),
        read: false,
        icon: 'wallet',
        link: '/client/history'
    });

    try {
      await batch.commit();
      toast({ title: "Entrega Finalizada!" });
      setIsPaymentDialogOpen(false);
      setTaskToFinish(null);
    } catch (e) {
      toast({ title: "Erro ao finalizar", variant: "destructive" });
    } finally {
      setIsUpdating(null);
    }
  };

  // Simulação de verificação de pagamento Pix
  const simulatePixConfirmation = () => {
    setIsCheckingPix(true);
    setTimeout(() => {
      setIsCheckingPix(false);
      setPixStep('confirmed');
      toast({ title: "Pix Recebido!", description: "Notificação do Mercado Pago: Pagamento confirmado." });
    }, 3000);
  };

  return (
    <>
      <header className="flex items-center justify-between px-6 pt-8 pb-4 bg-background shrink-0">
        <Link href="/courier/profile" className="flex items-center gap-3 group">
          <Avatar className="size-10 border-2 border-primary/20 rounded-full">
            {userProfile?.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName || ''} />}
            <AvatarFallback className="font-bold bg-primary/10 text-primary">
                {userProfile?.displayName?.charAt(0) || 'C'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xs text-muted-foreground">Logado como:</h1>
            <p className="text-sm font-bold font-headline">{userProfile?.displayName || 'Entregador'}</p>
          </div>
        </Link>
        <NotificationsPopover />
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-24 outline-none">
        {/* Mini Card de Status do Admin */}
        <section className="py-2">
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

        <Card className="p-5 rounded-xl mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-headline">Seu Status</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{isOnline ? 'Disponível para entregas' : 'Indisponível'}</p>
            </div>
            <Switch checked={isOnline} onCheckedChange={handleStatusChange} />
          </div>
        </Card>
        
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Link href="/courier/earnings" className="block active:scale-[0.98] transition-transform">
            <Card className="rounded-xl p-4 hover:border-primary/50 transition-colors h-full">
              <Wallet className="size-4 text-primary mb-2" />
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Ganhos Hoje</p>
              <p className="text-xl font-bold">{dailyEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </Card>
          </Link>
          <Card className="rounded-xl p-4">
            <Bike className="size-4 text-primary mb-2" />
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Concluídas</p>
            <p className="text-xl font-bold">{dailyTasksCount}</p>
          </Card>
        </div>

        <div className="mt-8">
          <Tabs defaultValue="coletas" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="coletas" className="font-bold">Coletas ({coletasPendentes.length})</TabsTrigger>
              <TabsTrigger value="entregas" className="font-bold">Em Trânsito ({entregasEmAndamento.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="coletas" className="space-y-4">
              {loadingTasks ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
              ) : coletasPendentes.length > 0 ? (
                coletasPendentes.map((task) => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onAction={() => handleConfirmPickup(task.id)}
                    isUpdating={isUpdating === task.id}
                    courierRate={userProfile?.deliveryRate || 6}
                    timeLimit={timeLimitMin}
                    now={now}
                  />
                ))
              ) : (
                <div className="text-center py-10 border rounded-2xl text-muted-foreground bg-muted/20">
                  <p className="text-sm">Nenhuma coleta pendente</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="entregas" className="space-y-4">
              {entregasEmAndamento.length > 0 ? (
                entregasEmAndamento.map((task) => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onAction={() => handleFinishClick(task)}
                    isUpdating={isUpdating === task.id}
                    courierRate={userProfile?.deliveryRate || 6}
                    timeLimit={timeLimitMin}
                    now={now}
                  />
                ))
              ) : (
                <div className="text-center py-10 border rounded-2xl text-muted-foreground bg-muted/20">
                  <p className="text-sm">Nenhuma entrega em trânsito</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Modal de confirmação de pagamento do cliente */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => {
          setIsPaymentDialogOpen(open);
          if (!open) {
              setPixStep('choice');
              setIsCheckingPix(false);
          }
      }}>
        <DialogContent className="max-w-[90vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl font-black text-center text-foreground">
                {pixStep === 'choice' ? 'Forma de Pagamento' : 'Pagamento via Pix'}
            </DialogTitle>
            <DialogDescription className="text-center">
                {pixStep === 'choice' 
                    ? 'O pedido foi marcado para recebimento manual. Como o cliente irá pagar?' 
                    : 'Apresente o código abaixo ao cliente para receber o valor.'}
            </DialogDescription>
          </DialogHeader>

          {pixStep === 'choice' && (
            <div className="grid grid-cols-2 gap-4 py-6">
              <Button 
                variant="outline" 
                className="flex flex-col items-center gap-3 h-32 rounded-2xl border-2 hover:border-emerald-500 hover:bg-emerald-50 hover:text-foreground transition-all"
                onClick={() => taskToFinish && handleFinishDelivery(taskToFinish, 'cash')}
              >
                <div className="size-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                  <Banknote size={28} />
                </div>
                <span className="font-bold text-foreground">Dinheiro</span>
              </Button>
              <Button 
                variant="outline" 
                className="flex flex-col items-center gap-3 h-32 rounded-2xl border-2 hover:border-[#32BCAD] hover:bg-[#32BCAD]/5 hover:text-foreground transition-all"
                onClick={() => setPixStep('qrcode')}
              >
                <div className="size-12 rounded-xl bg-[#32BCAD] text-white flex items-center justify-center">
                  <Smartphone size={28} />
                </div>
                <span className="font-bold text-foreground">Pix</span>
              </Button>
            </div>
          )}

          {pixStep === 'qrcode' && (
              <div className="flex flex-col items-center py-6">
                  <div className="p-4 bg-white rounded-2xl shadow-inner border border-muted relative">
                      <Image 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=LucasExpresso-Pedido-${taskToFinish?.id}-Valor-${taskToFinish?.price}`}
                        alt="QR Code Pix"
                        width={200}
                        height={200}
                        className="rounded-lg"
                      />
                      {isCheckingPix && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                              <Loader2 className="size-10 text-[#32BCAD] animate-spin" />
                          </div>
                      )}
                  </div>
                  
                  <div className="mt-6 text-center w-full">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Valor a Cobrar</p>
                      <h3 className="text-3xl font-black text-[#32BCAD] font-headline">
                        {taskToFinish?.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </h3>
                      
                      <div className="mt-8 space-y-3">
                          <Button 
                            className="w-full h-14 rounded-2xl bg-[#32BCAD] hover:bg-[#2aa395] font-bold gap-2 shadow-lg shadow-[#32BCAD]/20"
                            onClick={simulatePixConfirmation}
                            disabled={isCheckingPix}
                          >
                            {isCheckingPix ? <Loader2 className="animate-spin size-5" /> : <RefreshCw className="size-5" />}
                            {isCheckingPix ? 'Verificando...' : 'Verificar Pagamento'}
                          </Button>
                          <p className="text-[10px] text-muted-foreground italic">
                              O sistema verificará a notificação do Mercado Pago automaticamente.
                          </p>
                      </div>
                  </div>
              </div>
          )}

          {pixStep === 'confirmed' && (
              <div className="flex flex-col items-center py-10 text-center animate-in zoom-in-95 duration-300">
                  <div className="size-20 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-6 shadow-xl shadow-emerald-500/20">
                      <CheckCircle size={48} />
                  </div>
                  <h3 className="text-2xl font-black font-headline text-emerald-600">Pagamento Confirmado!</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-[200px]">O Pix foi recebido com sucesso na conta da central.</p>
                  
                  <Button 
                    className="w-full mt-8 h-14 rounded-2xl font-black text-base shadow-xl"
                    onClick={() => taskToFinish && handleFinishDelivery(taskToFinish, 'pix')}
                  >
                    FINALIZAR ENTREGA AGORA
                  </Button>
              </div>
          )}

          <Button variant="ghost" className="w-full text-muted-foreground font-bold" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskCard({ task, onAction, isUpdating, courierRate, timeLimit, now }: { task: Delivery, onAction: () => void, isUpdating: boolean, courierRate: number, timeLimit: number, now: number }) {
  const isAccepted = task.status === 'accepted';
  const isCollect = task.paymentMethod === 'collect';

  // Lógica de cálculo de atraso reativa ao tempo real
  const isDelayed = useMemo(() => {
    // Tenta usar o horário de aceite, se não tiver (ex: tarefas legadas), usa o de criação
    const startTime = task.acceptedAt?.toDate().getTime() || task.createdAt?.toDate().getTime();
    if (!startTime) return false;
    
    const diffMin = (now - startTime) / (1000 * 60);
    return diffMin > timeLimit;
  }, [task.acceptedAt, task.createdAt, timeLimit, now]);

  return (
    <Card className={cn(
        "p-4 rounded-xl shadow-sm border-l-4 overflow-hidden transition-all",
        isDelayed ? "border-l-red-600 bg-red-50/30" : "border-l-primary"
    )}>
      <div className="flex justify-between items-start mb-4">
        <Badge variant="secondary" className="uppercase text-[10px] font-bold">
          {isAccepted ? 'Aguardando Coleta' : 'Em Trânsito'}
        </Badge>
        <div className="text-right">
            <p className={cn("text-lg font-bold", isDelayed ? "text-red-600" : "text-primary")}>
                {courierRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            {isDelayed && (
                <div className="flex items-center gap-1 text-[10px] font-black text-red-600 uppercase animate-pulse">
                    <Timer className="size-3" />
                    ENTREGA EM ATRASO
                </div>
            )}
        </div>
      </div>

      {isCollect && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2">
            <Banknote className="size-4 text-amber-600" />
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-tighter">
                COBRAR CLIENTE: DINHEIRO OU PIX
            </p>
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div className="flex gap-2 items-start">
          <CircleDot className="size-4 text-primary mt-1 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase truncate">Loja: <ClientName clientId={task.clientId} /></p>
            <p className="text-sm font-medium truncate">{task.pickup}</p>
          </div>
        </div>
        <div className="flex gap-2 items-start">
          <MapPin className="size-4 text-red-500 mt-1 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Destino:</p>
            <p className="text-sm font-medium truncate">{task.dropoff}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild className="flex-1 rounded-lg">
          <Link href={`/courier/navigation`}>
            <Map className="mr-2 size-4" /> Ver no Mapa
          </Link>
        </Button>
        <Button size="sm" className={cn("flex-1 rounded-lg font-bold", isDelayed && "bg-red-600 hover:bg-red-700")} onClick={onAction} disabled={isUpdating}>
          {isUpdating ? <Loader2 className="animate-spin" /> : (isAccepted ? 'Confirmar Retirada' : 'Finalizar Entrega')}
        </Button>
      </div>
    </Card>
  );
}
