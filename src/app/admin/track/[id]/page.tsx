'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bike, MapPin, Package, Phone, User, Loader2, Navigation as NavIcon } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { doc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useUser, useFirestore, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientName } from '@/components/info/ClientName';
import { geocodeAddress, type Coords } from '@/lib/geocoding';
import type { Delivery, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { 
  ssr: false,
  loading: () => <div className="bg-muted animate-pulse w-full h-full" /> 
});

export default function AdminTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryId = params.id as string;
  const firestore = useFirestore();

  const deliveryRef = useMemo(() => (
    firestore && deliveryId ? doc(firestore, 'deliveries', deliveryId) : null
  ), [firestore, deliveryId]);

  const { data: delivery, loading: loadingDelivery } = useDoc<Delivery>(deliveryRef);

  const courierRef = useMemo(() => (
    firestore && delivery?.courierId ? doc(firestore, 'users', delivery.courierId) : null
  ), [firestore, delivery?.courierId]);

  const { data: courier, loading: loadingCourier } = useDoc<UserProfile>(courierRef);

  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coords | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(true);

  useEffect(() => {
    if (delivery) {
      const runGeocoding = async () => {
        setIsGeocoding(true);
        try {
          const [pCoords, dCoords] = await Promise.all([
            geocodeAddress(delivery.pickup),
            geocodeAddress(delivery.dropoff),
          ]);
          setPickupCoords(pCoords);
          setDropoffCoords(dCoords);
        } catch (error) {
          console.error("Erro no geocodificador:", error);
        } finally {
          setIsGeocoding(false);
        }
      };
      runGeocoding();
    }
  }, [delivery]);

  const mapStops = useMemo(() => {
    if (!pickupCoords || !dropoffCoords || !delivery) return [];
    return [
      { id: 'pickup', lat: pickupCoords.lat, lng: pickupCoords.lng, label: 'Coleta', type: 'pickup' as const },
      { id: 'dropoff', lat: dropoffCoords.lat, lng: dropoffCoords.lng, label: 'Entrega', type: 'dropoff' as const }
    ];
  }, [pickupCoords, dropoffCoords, delivery]);

  const courierLocation = useMemo(() => courier?.lastLocation ? { lat: courier.lastLocation.lat, lng: courier.lastLocation.lng } : null, [courier]);

  if (loadingDelivery || (delivery?.courierId && loadingCourier)) {
    return (
      <div className="h-full bg-background flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="size-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold font-headline">Buscando sinal do GPS...</h2>
        <p className="text-muted-foreground text-sm mt-2">Conectando à frota da Lucas-Expresso.</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Package className="size-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Entrega não encontrada</h2>
        <p className="text-muted-foreground mb-6">Esta solicitação pode ter sido finalizada ou cancelada.</p>
        <Button asChild className="rounded-xl px-8"><Link href="/admin/deliveries">Voltar para Entregas</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center bg-background/90 backdrop-blur-md p-4 justify-between border-b shadow-sm">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <div className="text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest font-headline">Rastreador ao Vivo</h2>
        </div>
        <div className="size-10" />
      </header>

      <div className="absolute inset-0 z-0 bg-muted">
        {!isGeocoding && pickupCoords && dropoffCoords && (
          <DeliveryMap stops={mapStops} currentLocation={courierLocation} />
        )}
        {isGeocoding && (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-muted-foreground" />
            </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-background/80 to-transparent pb-10">
        <Card className="rounded-3xl shadow-2xl border-t bg-card/95 backdrop-blur-md overflow-hidden">
          <div className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold font-headline leading-tight">
                  <ClientName clientId={delivery.clientId} />
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="size-3 text-red-500" /> {delivery.dropoff}
                </p>
              </div>
              <Badge className={cn(
                "uppercase text-[10px] font-bold tracking-tighter",
                delivery.status === 'in-progress' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
              )}>
                {delivery.status === 'in-progress' ? 'Em Trânsito' : 'Aguardando Coleta'}
              </Badge>
            </div>

            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-2xl border border-border/50">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 shrink-0">
                <Bike className="text-primary size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Entregador</p>
                <h4 className="font-bold text-base truncate">{courier?.displayName || 'Aguardando Atribuição'}</h4>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  {courier?.lastLocation ? (
                    <>
                      <NavIcon className="size-2.5 text-primary" />
                      Sinal GPS {formatDistanceToNow(courier.lastLocation.updatedAt.toDate(), { addSuffix: true, locale: ptBR })}
                    </>
                  ) : (
                    <span className="text-red-400 italic font-medium">
                      {delivery.courierId ? 'Sem sinal de GPS no momento' : 'Nenhum entregador no pedido'}
                    </span>
                  )}
                </p>
              </div>
              {courier && (
                <Button size="icon" variant="outline" className="rounded-full bg-primary/5 text-primary border-primary/20 shrink-0">
                  <Phone className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
