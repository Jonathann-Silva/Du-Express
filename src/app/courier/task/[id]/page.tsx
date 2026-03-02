
'use client';

import { ArrowLeft, Store, MapPin, Info, Loader2, Package, Map as MapIcon, Banknote, CreditCard } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, writeBatch, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import type { Delivery } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ClientName } from '@/components/info/ClientName';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { geocodeAddress, type Coords } from '@/lib/geocoding';

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { 
  ssr: false,
  loading: () => <div className="bg-muted animate-pulse w-full h-full" /> 
});

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const deliveryId = params.id as string;
  
  const firestore = useFirestore();
  const { user: courierUser, userProfile } = useUser();

  const [isAccepting, setIsAccepting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coords | null>(null);

  const deliveryRef = useMemo(() => (
    firestore && deliveryId ? doc(firestore, 'deliveries', deliveryId) : null
  ), [firestore, deliveryId]);

  const { data: delivery, loading } = useDoc<Delivery>(deliveryRef);

  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coords | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(true);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location denied", err)
      );
    }
  }, []);

  useEffect(() => {
    if (delivery) {
      const runGeocoding = async () => {
        setIsGeocoding(true);
        setGeocodingError(null);
        try {
          const [pCoords, dCoords] = await Promise.all([
            geocodeAddress(delivery.pickup),
            geocodeAddress(delivery.dropoff),
          ]);

          if (!pCoords || !dCoords) {
              setGeocodingError("Não foi possível encontrar as coordenadas para um dos endereços.");
          }

          setPickupCoords(pCoords);
          setDropoffCoords(dCoords);

        } catch (error) {
          console.error("Geocoding process failed", error);
          setGeocodingError("Ocorreu um erro ao buscar as localizações no mapa.");
        } finally {
            setIsGeocoding(false);
        }
      };

      runGeocoding();
    }
  }, [delivery]);

  const mapStops = useMemo(() => {
    if (!pickupCoords || !dropoffCoords) return [];
    return [
      { id: 'pickup', lat: pickupCoords.lat, lng: pickupCoords.lng, label: 'Coleta', type: 'pickup' as const },
      { id: 'dropoff', lat: dropoffCoords.lat, lng: dropoffCoords.lng, label: 'Entrega', type: 'dropoff' as const }
    ];
  }, [pickupCoords, dropoffCoords]);


  const handleAcceptTask = async () => {
    if (!firestore || !delivery || !courierUser) return;
    
    setIsAccepting(true);

    const dRef = doc(firestore, "deliveries", delivery.id);
    const clientNotifRef = doc(collection(firestore, 'notifications'));
    const batch = writeBatch(firestore);

    // 1. Update the delivery document with courierId and set status to 'accepted'
    // Adicionado acceptedAt para controle de tempo limite
    batch.update(dRef, { 
      courierId: courierUser.uid,
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });

    // 2. Create a notification for the client
    batch.set(clientNotifRef, {
      userId: delivery.clientId,
      title: "Seu pedido foi aceito!",
      description: `${courierUser.displayName || 'Nosso entregador'} está a caminho para retirar seu pedido.`,
      createdAt: serverTimestamp(),
      read: false,
      icon: 'package',
      link: '/client'
    });

    try {
        await batch.commit();
        toast({
            title: "Tarefa Aceita!",
            description: "Você tem uma nova entrega. Boa sorte!",
        });
        // Redirect to the active delivery page
        router.push(`/courier/delivery/${delivery.id}`);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: dRef.path,
            operation: 'update',
            requestResourceData: { status: 'accepted', courierId: courierUser.uid },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erro ao aceitar",
            description: "Não foi possível aceitar a tarefa. Verifique suas permissões.",
        });
    } finally {
        setIsAccepting(false);
    }
  };

  const handleRefuseTask = () => {
      router.back();
  };

  if (loading) {
      return (
          <>
            <header className="flex items-center bg-background p-4 pt-6 justify-between sticky top-0 z-10 shrink-0">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-6 w-40" />
                <div className="size-10" />
            </header>
            <main className="flex-1 overflow-y-auto px-4 pb-48">
                <Skeleton className="w-full aspect-[16/9] rounded-xl mt-4" />
                <Skeleton className="h-32 w-full mt-8 rounded-2xl" />
                <Skeleton className="h-48 w-full mt-8 rounded-2xl" />
            </main>
          </>
      )
  }

  if (!delivery) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <Package className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold">Tarefa não encontrada</h2>
            <p className="text-muted-foreground">Esta tarefa pode já ter sido pega por outro entregador ou cancelada.</p>
            <Button asChild className="mt-6">
                <Link href="/courier">Voltar para Tarefas</Link>
            </Button>
        </div>
      );
  }

  const courierRate = userProfile?.deliveryRate || 6;
  const isCollect = delivery.paymentMethod === 'collect';

  return (
    <>
      <header className="flex items-center bg-background p-4 pt-6 justify-between sticky top-0 z-10 shrink-0">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/courier">
            <ArrowLeft />
          </Link>
        </Button>
        <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center font-headline">Detalhes da Tarefa</h2>
        <div className="size-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-48">
        
        {isCollect && (
            <div className="mt-4 p-4 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-500/20 flex items-center gap-4">
                <div className="size-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Banknote className="size-7" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none opacity-80">Atenção Entregador</p>
                    <h4 className="text-base font-bold mt-1">RECEBER DINHEIRO OU PIX</h4>
                    <p className="text-[10px] mt-0.5 opacity-90">Este cliente não usa crediário. Você deve cobrar no destino.</p>
                </div>
            </div>
        )}

        <div className="mt-4 relative group">
          <div className="w-full bg-muted aspect-[16/9] rounded-xl overflow-hidden relative">
            {(loading || isGeocoding) && (
                <div className="bg-muted w-full h-full flex flex-col items-center justify-center text-center">
                    <Loader2 className="size-8 text-muted-foreground animate-spin mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Carregando mapa e rota...</p>
                </div>
            )}
            {!(loading || isGeocoding) && geocodingError && (
                <div className="bg-destructive/10 w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <MapIcon className="size-8 text-destructive mb-2" />
                    <p className="text-sm font-semibold text-destructive">{geocodingError}</p>
                </div>
            )}
            {!(loading || isGeocoding) && !geocodingError && pickupCoords && dropoffCoords && (
              <DeliveryMap stops={mapStops} currentLocation={currentLocation} />
            )}
          </div>
        </div>

        <div className="mt-8 text-center bg-primary/10 dark:bg-primary/5 py-8 rounded-2xl border border-primary/20">
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest mb-1">Ganhos Estimados</p>
          <h1 className="text-primary text-5xl font-extrabold tracking-tighter leading-none font-headline">
              {courierRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h1>
        </div>

        <div className="mt-8 space-y-6 relative">
          <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-border z-0" />
          
          <div className="flex gap-4 relative z-10">
            <div className="flex-none flex flex-col items-center">
              <div className="size-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30">
                <Store className="size-5" />
              </div>
            </div>
            <div className="flex-1 pt-1">
              <p className="text-primary text-[10px] font-bold uppercase tracking-wider">Retirada (<ClientName clientId={delivery.clientId} />)</p>
              <h3 className="text-foreground font-bold text-lg leading-tight font-headline">{delivery.pickup}</h3>
              {delivery.observations && (
                <div className="mt-2 bg-muted/50 p-2 rounded-lg border flex items-start gap-2">
                    <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground italic">"{delivery.observations}"</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-4 relative z-10">
            <div className="flex-none flex flex-col items-center">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <MapPin className="size-5" />
              </div>
            </div>
            <div className="flex-1 pt-1">
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Entrega</p>
              <h3 className="text-foreground font-bold text-lg leading-tight font-headline">{delivery.dropoff}</h3>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pb-10 z-20">
        <div className="flex flex-col gap-3">
          <Button 
            className="w-full py-6 text-base font-bold rounded-xl"
            onClick={handleAcceptTask}
            disabled={isAccepting}
          >
            {isAccepting ? <Loader2 className="animate-spin" /> : 'Aceitar Tarefa'}
          </Button>
          <Button variant="secondary" className="w-full py-6 text-base font-bold rounded-xl" onClick={handleRefuseTask} disabled={isAccepting}>
            Recusar
          </Button>
        </div>
      </div>
    </>
  );
}
