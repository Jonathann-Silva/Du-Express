'use client';

import { useState, useMemo } from 'react';
import { ArrowRightLeft, Clock, MapPin, MoreHorizontal, Plus, Search, XCircle, Loader2, ChevronRight } from 'lucide-react';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { format, isToday, isYesterday, compareDesc } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

import type { Delivery, AdminDeliveryStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientName } from '@/components/info/ClientName';
import { CourierInfo } from '@/components/info/CourierInfo';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AdminCreateDeliveryDialog } from '@/components/AdminCreateDeliveryDialog';
import { DeliverySummaryDialog } from '@/components/DeliverySummaryDialog';
import { useToast } from '@/hooks/use-toast';

type FilterStatus = AdminDeliveryStatus | 'all';

const statusMap: Record<AdminDeliveryStatus, { label: string; color: string; bgColor: string, pulseColor?: string }> = {
  pending: { label: 'Pendente', color: 'text-amber-500', bgColor: 'bg-amber-500/10', pulseColor: 'bg-amber-500' },
  accepted: { label: 'Aceito', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  'in-progress': { label: 'Em Trânsito', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  finished: { label: 'Finalizado', color: 'text-slate-500', bgColor: 'bg-slate-500/10' },
  refused: { label: 'Recusado', color: 'text-red-500', bgColor: 'bg-red-500/10' },
};

export default function AdminDeliveriesPage() {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [summaryDelivery, setSummaryDelivery] = useState<Delivery | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const { user, userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const deliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid || !userProfile || userProfile.role !== 'admin') return null;
    const deliveriesCollection = collection(firestore, 'deliveries');
    if (activeFilter === 'all') {
        return query(deliveriesCollection, orderBy('createdAt', 'desc'), limit(100));
    }
    return query(deliveriesCollection, where('status', '==', activeFilter), orderBy('createdAt', 'desc'), limit(100));
  }, [firestore, user?.uid, userProfile?.role, activeFilter]);

  const { data: deliveries, loading: loadingDeliveries } = useCollection<Delivery>(deliveriesQuery);

  const isLoading = userLoading || loadingDeliveries;
  
  const groupedAndSortedDeliveries = useMemo(() => {
    if (!deliveries) return [];

    const grouped = deliveries.reduce<Record<string, Delivery[]>>((acc, delivery) => {
      const dateString = format(delivery.createdAt.toDate(), 'yyyy-MM-dd');
      if (!acc[dateString]) {
        acc[dateString] = [];
      }
      acc[dateString].push(delivery);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([, deliveriesOnDate]) => {
        const groupDate = deliveriesOnDate[0].createdAt.toDate();
        let title: string;
        if (isToday(groupDate)) {
          title = 'Hoje';
        } else if (isYesterday(groupDate)) {
          title = 'Ontem';
        } else {
          title = format(groupDate, "d 'de' MMMM, yyyy", { locale: ptBR });
        }
        const sortedDeliveriesOnDate = deliveriesOnDate.sort((a,b) => compareDesc(a.createdAt.toDate(), b.createdAt.toDate()));
        return { title, deliveries: sortedDeliveriesOnDate, date: groupDate };
      })
      .sort((a, b) => compareDesc(a.date, b.date));
  }, [deliveries]);


  const filters: { label: string, status: FilterStatus }[] = [
    { label: 'Todos', status: 'all' },
    { label: 'Pendente', status: 'pending' },
    { label: 'Aceito', status: 'accepted' },
    { label: 'Em Progresso', status: 'in-progress' },
    { label: 'Finalizado', status: 'finished' },
    { label: 'Recusado', status: 'refused' },
  ];
  
  const handleUpdateStatus = async (delivery: Delivery, newStatus: string) => {
    if (!firestore || !user?.uid) return;
    setIsActionLoading(delivery.id);
    const deliveryRef = doc(firestore, 'deliveries', delivery.id);
    
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'accepted') {
        updateData.courierId = user.uid;
        updateData.acceptedAt = serverTimestamp();
      } else if (newStatus === 'finished') {
        updateData.finishedAt = serverTimestamp();
      }
      
      await updateDoc(deliveryRef, updateData);
      toast({ title: "Status Atualizado!" });
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setIsActionLoading(null);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight font-headline">Histórico Logístico</h1>
          <Button size="icon" className="rounded-full" onClick={() => setIsCreateModalOpen(true)}>
            <Plus />
          </Button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
          <Input className="h-11 pl-10 pr-4 rounded-xl text-sm" placeholder="Buscar pedido ou cliente..." />
        </div>
        <div className="flex gap-2 bg-muted p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden overflow-y-hidden">
          {filters.map(({ label, status }) => (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={cn(
                "flex-1 whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeFilter === status
                  ? 'bg-background shadow-sm text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32">
        {/* Botão de Histórico Financeiro entre filtro e cards */}
        <div className="mb-6">
          <Button variant="outline" className="w-full h-14 rounded-2xl text-xs font-black border-primary/20 text-primary bg-primary/5 gap-2 group" asChild>
            <Link href="/admin/finance/history">
              VER HISTÓRICO FINANCEIRO COMPLETO
              <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        {isLoading && (
            <div className="space-y-4">
                <Skeleton className="h-52 w-full rounded-xl" />
                <Skeleton className="h-52 w-full rounded-xl" />
                <Skeleton className="h-52 w-full rounded-xl" />
            </div>
        )}
        {!isLoading && groupedAndSortedDeliveries.length > 0 ? (
          <div className="space-y-8">
            {groupedAndSortedDeliveries.map(({ title, deliveries: groupDeliveries }) => (
              <section key={title}>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 mb-4">{title}</h2>
                <div className="space-y-4">
                  {groupDeliveries.map(delivery => (
                      <DeliveryCard 
                        key={delivery.id} 
                        delivery={delivery} 
                        onUpdateStatus={(s) => handleUpdateStatus(delivery, s)}
                        onSummaryClick={() => setSummaryDelivery(delivery)}
                        isActionLoading={isActionLoading === delivery.id}
                      />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : !isLoading && (
            <div className="text-center py-10 border rounded-2xl">
                <p className="font-semibold">Nenhum pedido encontrado</p>
                <p className="text-muted-foreground text-sm mt-1">Não há entregas com o status selecionado.</p>
            </div>
        )}
      </main>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl">
            <AdminCreateDeliveryDialog onClose={() => setIsCreateModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!summaryDelivery} onOpenChange={(isOpen) => !isOpen && setSummaryDelivery(null)}>
        {summaryDelivery && (
          <DialogContent className="max-w-md p-6 overflow-hidden rounded-[2rem]">
              <DeliverySummaryDialog delivery={summaryDelivery} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function DeliveryCard({ delivery, onUpdateStatus, onSummaryClick, isActionLoading }: { 
  delivery: Delivery, 
  onUpdateStatus: (s: string) => void, 
  onSummaryClick: () => void,
  isActionLoading: boolean
}) {
  const statusInfo = statusMap[delivery.status as AdminDeliveryStatus];
  
  if (!statusInfo) return null;
  
  const requestedTime = delivery.createdAt
    ? format(delivery.createdAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : '---';

  return (
    <Card className="p-4 rounded-xl shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold mt-1 font-headline">
              <ClientName clientId={delivery.clientId} />
          </h3>
          <p className="text-base font-black text-primary leading-none mt-1">
            {delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <Badge className={cn("text-[10px] font-bold uppercase gap-1", statusInfo.bgColor, statusInfo.color)}>
            {statusInfo.pulseColor && <span className={cn("size-1.5 rounded-full animate-pulse", statusInfo.pulseColor)}></span>}
            {statusInfo.label}
        </Badge>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                <MapPin className="text-muted-foreground size-4" />
            </div>
            <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium leading-none">Destino</p>
                <p className="text-sm font-semibold truncate">{delivery.dropoff}</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                <Clock className="text-muted-foreground size-4" />
            </div>
            <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium leading-none">Solicitado em</p>
                <p className="text-sm font-semibold">{requestedTime}</p>
            </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        {isActionLoading ? (
          <Button disabled className="flex-1"><Loader2 className="animate-spin size-4" /></Button>
        ) : (
          <>
            {delivery.status === 'pending' && (
                <Button className="flex-1 font-bold text-sm" onClick={() => onUpdateStatus('accepted')}>Aceitar Pedido</Button>
            )}
            {delivery.status === 'accepted' && (
                <>
                  <Button variant="secondary" className="flex-1 font-bold text-sm" asChild>
                      <Link href={`/admin/track/${delivery.id}`}>Ver Mapa</Link>
                  </Button>
                  <Button className="flex-1 font-bold text-sm" onClick={() => onUpdateStatus('in-progress')}>Iniciar Viagem</Button>
                </>
            )}
            {delivery.status === 'in-progress' && (
                <>
                  <Button variant="secondary" className="flex-1 font-bold text-sm" asChild>
                      <Link href={`/admin/track/${delivery.id}`}>Rastrear</Link>
                  </Button>
                  <Button className="flex-1 font-bold text-sm bg-emerald-600 hover:bg-emerald-700" onClick={() => onUpdateStatus('finished')}>Finalizar</Button>
                </>
            )}
            {delivery.status === 'finished' && (
                <Button variant="outline" className="flex-1 font-bold text-sm" onClick={onSummaryClick}>Ver Detalhes</Button>
            )}
            {delivery.status === 'refused' && (
                <div className='flex items-center gap-2 text-destructive font-semibold text-sm w-full justify-center bg-destructive/10 py-2 rounded-lg cursor-pointer' onClick={onSummaryClick}>
                  <XCircle className="size-5" /> Ver Motivo
                </div>
            )}
          </>
        )}
      </div>

    </Card>
  );
}
