'use client';

import { useState, useMemo, useEffect } from 'react';
import { Filter, Search, ChevronRight, User, Package, CheckCircle, Truck, XCircle, Info, ChevronLeft, Calendar, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Delivery } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { format, startOfWeek, addDays, subDays, getDay, subWeeks, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { CourierName } from '@/components/info/CourierName';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


type FilterType = 'all' | 'finished' | 'refused';

const filterButtons: { label: string, type: FilterType }[] = [
  { label: 'Todos', type: 'all' },
  { label: 'Concluídos', type: 'finished' },
  { label: 'Cancelados', type: 'refused' },
];

export default function ClientHistoryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

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

  const deliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;

    const collectionRef = collection(firestore, 'deliveries');
    let q = query(
        collectionRef, 
        where('clientId', '==', user.uid),
        where('createdAt', '>=', Timestamp.fromDate(weekStart)),
        where('createdAt', '<=', Timestamp.fromDate(weekEnd)),
        orderBy('createdAt', 'desc')
    );

    return q;
  }, [firestore, user?.uid, weekStart, weekEnd]);

  const [unsortedDeliveries, setUnsortedDeliveries] = useState<Delivery[] | null>(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);

    useEffect(() => {
        if (deliveriesQuery) {
            setDeliveriesLoading(true);
            setUnsortedDeliveries(null); // Limpa para mostrar skeleton
            getDocs(deliveriesQuery)
                .then(snapshot => {
                    const deliveriesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery));
                    setUnsortedDeliveries(deliveriesData);
                })
                .catch(async (serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: 'deliveries',
                        operation: 'list',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    setUnsortedDeliveries([]);
                })
                .finally(() => setDeliveriesLoading(false));
        } else {
            setUnsortedDeliveries([]);
            setDeliveriesLoading(false);
        }
    }, [deliveriesQuery]);

  const filteredDeliveries = useMemo(() => {
    if (!unsortedDeliveries) return null;
    
    return unsortedDeliveries.filter(d => {
        const matchesStatus = activeFilter === 'all' || d.status === activeFilter;
        const matchesSearch = !searchQuery || d.dropoff.toLowerCase().includes(searchQuery.toLowerCase()) || d.id.includes(searchQuery);
        return matchesStatus && matchesSearch;
    });
  }, [unsortedDeliveries, activeFilter, searchQuery]);

  const isLoading = userLoading || deliveriesLoading;

  return (
    <div className="flex flex-col h-full bg-background outline-none">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 pt-6 pb-2 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Histórico</h1>
          <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest bg-primary/5 text-primary border-primary/20">
            {filteredDeliveries?.length || 0} Registros
          </Badge>
        </div>

        {/* Seletor Semanal */}
        <section className="mb-4">
            <Card className="p-1.5 bg-muted/50 border shadow-none rounded-xl flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="rounded-lg h-10 w-10">
                    <ChevronLeft className="size-5" />
                </Button>
                <div className="text-center">
                    <p className="text-xs font-bold">{periodLabel}</p>
                    <p className="text-[9px] uppercase font-black text-primary tracking-widest leading-none mt-0.5">Ciclo Semanal Seg-Sáb</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleNextWeek} className="rounded-lg h-10 w-10">
                    <ChevronRight className="size-5" />
                </Button>
            </Card>
        </section>

        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input 
                className="h-10 pl-9 pr-4 rounded-xl text-sm bg-muted/30 border-none" 
                placeholder="Buscar destino ou ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden">
            {filterButtons.map(({ label, type }) => (
              <Button
                key={type}
                size="sm"
                variant={activeFilter === type ? 'default' : 'secondary'}
                onClick={() => setActiveFilter(type)}
                className="rounded-full shrink-0 text-[11px] font-bold h-8 px-4"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {isLoading && (
          <>
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </>
        )}
        {!isLoading && filteredDeliveries && filteredDeliveries.length > 0 ? (
            filteredDeliveries.map(delivery => <HistoryCard key={delivery.id} delivery={delivery} />)
        ) : !isLoading && (
             <div className="text-center py-16 border-2 border-dashed rounded-[2rem] bg-muted/10">
                <Calendar className="mx-auto text-muted-foreground/20 size-12 mb-4" />
                <p className="font-bold text-muted-foreground">Nenhum registro nesta semana</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Tente navegar para outras semanas ou mude o filtro.</p>
            </div>
        )}
      </main>
    </div>
  );
}

function HistoryCard({ delivery }: { delivery: Delivery }) {
    const statusDetails: { label: string; className: string; icon: React.ReactNode; priceColor: string } = useMemo(() => {
    switch(delivery.status) {
      case 'finished':
        return { 
          label: 'CONCLUÍDO', 
          className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', 
          icon: <CheckCircle className="size-8 text-emerald-500"/>,
          priceColor: 'text-primary'
        };
      case 'refused':
        return { 
          label: 'CANCELADO', 
          className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', 
          icon: <XCircle className="size-8 text-red-500"/>,
          priceColor: 'text-muted-foreground'
        };
      default:
        return { 
          label: 'EM ANDAMENTO', 
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', 
          icon: <Truck className="size-8 text-blue-500"/>,
          priceColor: 'text-primary'
        };
    }
  }, [delivery.status]);

  return (
    <Card className="p-4 rounded-2xl shadow-sm transition-all active:scale-[0.98] border-none bg-card/50 backdrop-blur-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <Badge className={cn("text-[9px] font-black tracking-tighter px-2 py-0.5", statusDetails.className)}>
            {statusDetails.label}
          </Badge>
          <h3 className="text-base font-bold leading-tight mt-2 font-headline truncate max-w-[200px]">{delivery.dropoff}</h3>
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-0.5">
            {delivery.createdAt ? format((delivery.createdAt as Timestamp).toDate(), "dd 'de' MMM '•' HH:mm", { locale: ptBR }) : 'Data indisponível'}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("text-xl font-black leading-none", statusDetails.priceColor)}>
            {delivery.price > 0 ? delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '--'}
          </p>
          {delivery.status === 'finished' && (
             <span className={cn(
                "text-[8px] font-black uppercase px-1 rounded mt-1 inline-block",
                delivery.paidByClient ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
             )}>
                {delivery.paidByClient ? 'Liquidado' : 'Em Aberto'}
             </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-dashed">
        <div className={cn("h-14 w-20 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center bg-muted/30", delivery.status === 'refused' && "grayscale")}>
            {statusDetails.icon}
        </div>
        <div className="flex-1 min-w-0">
          {delivery.status !== 'refused' && delivery.courierId ? (
            <>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                <User className="size-3 text-primary" />
                <span className="truncate">Entregador: <span className="text-foreground font-bold"><CourierName courierId={delivery.courierId} /></span></span>
              </div>
              {delivery.observations && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 bg-muted/20 p-1.5 rounded-lg border border-dashed">
                    <Package className="size-3 shrink-0" />
                    <span className="truncate italic">Obs: {delivery.observations}</span>
                </div>
              )}
            </>
          ) : (delivery.status === 'refused' && 
             <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-red-50/50 p-2 rounded-xl border border-red-100">
                <Info className="size-3.5 mt-0.5 shrink-0 text-red-500" />
                <p className="italic leading-tight">{delivery.observations || 'O administrador recusou esta solicitação.'}</p>
             </div>
          )}
          {!delivery.courierId && delivery.status === 'pending' && (
             <div className="flex items-center gap-2 text-[11px] text-amber-600 font-bold italic">
                <Truck className="size-3 animate-bounce" />
                <span>Aguardando atribuição...</span>
             </div>
          )}
        </div>
        <ChevronRight className="text-muted-foreground/30 size-5" />
      </div>
    </Card>
  );
}
