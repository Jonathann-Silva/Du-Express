'use client';

import { useState, useMemo, useEffect } from 'react';
import { Filter, Search, ChevronRight, User, Package, CheckCircle, Truck, XCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Delivery } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { CourierName } from '@/components/info/CourierName';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


type FilterType = 'last7days' | 'last30days' | 'finished' | 'refused';

const filterButtons: { label: string, type: FilterType }[] = [
  { label: 'Últimos 7 Dias', type: 'last7days' },
  { label: 'Últimos 30 Dias', type: 'last30days' },
  { label: 'Concluídos', type: 'finished' },
  { label: 'Cancelados', type: 'refused' },
];

export default function ClientHistoryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('last7days');
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const deliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;

    const collectionRef = collection(firestore, 'deliveries');
    let q = query(collectionRef, where('clientId', '==', user.uid));

    const now = new Date();

    switch (activeFilter) {
      case 'last7days':
        q = query(q, where('createdAt', '>=', subDays(now, 7)));
        break;
      case 'last30days':
        q = query(q, where('createdAt', '>=', subDays(now, 30)));
        break;
      case 'finished':
        q = query(q, where('status', '==', 'finished'));
        break;
      case 'refused':
        q = query(q, where('status', '==', 'refused'));
        break;
    }

    return q;

  }, [firestore, user?.uid, activeFilter]);

  const [unsortedDeliveries, setUnsortedDeliveries] = useState<Delivery[] | null>(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);

    useEffect(() => {
        if (deliveriesQuery) {
            setDeliveriesLoading(true);
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

  const deliveries = useMemo(() => {
    if (!unsortedDeliveries) return null;
    return unsortedDeliveries.sort((a, b) => (b.createdAt as Timestamp).toDate().getTime() - (a.createdAt as Timestamp).toDate().getTime());
  }, [unsortedDeliveries]);

  const isLoading = userLoading || deliveriesLoading;

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Histórico</h1>
          <Button variant="outline" size="icon" className="rounded-full">
            <Filter className="size-5" />
          </Button>
        </div>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
            <Input className="h-11 pl-10 pr-4 rounded-xl text-sm" placeholder="Buscar destino ou ID" />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden">
          {filterButtons.map(({ label, type }) => (
            <Button
              key={type}
              size="sm"
              variant={activeFilter === type ? 'default' : 'secondary'}
              onClick={() => setActiveFilter(type)}
              className="rounded-full shrink-0"
            >
              {label}
            </Button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-2 space-y-4 pb-24">
        {isLoading && (
          <>
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </>
        )}
        {!isLoading && deliveries && deliveries.length > 0 && deliveries.map(delivery => <HistoryCard key={delivery.id} delivery={delivery} />)}
        {!isLoading && (!deliveries || deliveries.length === 0) && (
             <div className="text-center py-10 border rounded-2xl mt-4">
                <p className="font-semibold">Nenhum pedido encontrado</p>
                <p className="text-muted-foreground text-sm mt-1">Não há entregas que correspondam ao filtro selecionado.</p>
            </div>
        )}
      </main>
    </>
  );
}

function HistoryCard({ delivery }: { delivery: Delivery }) {
    const statusDetails: { label: string; className: string; icon: React.ReactNode; priceColor: string } = useMemo(() => {
    switch(delivery.status) {
      case 'finished':
        return { 
          label: 'Concluído', 
          className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', 
          icon: <CheckCircle className="size-8 text-green-500"/>,
          priceColor: 'text-primary'
        };
      case 'refused':
        return { 
          label: 'Cancelado', 
          className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', 
          icon: <XCircle className="size-8 text-red-500"/>,
          priceColor: 'text-muted-foreground'
        };
      default:
        return { 
          label: 'Em Andamento', 
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', 
          icon: <Truck className="size-8 text-blue-500"/>,
          priceColor: 'text-primary'
        };
    }
  }, [delivery.status]);

  return (
    <Card className="p-4 rounded-xl shadow-sm transition-all active:scale-[0.98]">
      <div className="flex justify-between items-start">
        <div>
          <Badge variant="secondary" className={statusDetails.className}>
            {statusDetails.label}
          </Badge>
          <h3 className="text-base font-bold leading-tight mt-1 font-headline truncate max-w-[200px]">{delivery.dropoff}</h3>
          <p className="text-muted-foreground text-xs font-medium">
            {delivery.createdAt ? format((delivery.createdAt as Timestamp).toDate(), "dd 'de' MMM, yyyy '•' HH:mm", { locale: ptBR }) : 'Data indisponível'}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold leading-none", statusDetails.priceColor)}>
            {delivery.price > 0 ? delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '--'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t">
        <div className={cn("h-16 w-24 rounded-lg overflow-hidden shrink-0 border flex items-center justify-center bg-muted", delivery.status === 'refused' && "grayscale")}>
            {statusDetails.icon}
        </div>
        <div className="flex-1 min-w-0">
          {delivery.status !== 'refused' && delivery.courierId ? (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="size-3" />
                <span className="truncate">Entregador: <CourierName courierId={delivery.courierId} /></span>
              </div>
              {delivery.observations && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Package className="size-3" />
                    <span className="truncate">Obs: {delivery.observations}</span>
                </div>
              )}
            </>
          ) : (delivery.status === 'refused' && 
             <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 mt-0.5 shrink-0 text-red-500" />
                <p className="italic">{delivery.observations || 'O administrador recusou esta solicitação.'}</p>
             </div>
          )}
        </div>
        <ChevronRight className="text-muted-foreground size-5" />
      </div>
    </Card>
  );
}
