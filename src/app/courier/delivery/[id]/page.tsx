
'use client';

import { ArrowLeft, Phone, MessageCircle, Info, CheckCircle, MapPin, Loader2, Package, Map as MapIcon, Banknote, Smartphone, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp, collection, writeBatch } from 'firebase/firestore';
import type { Delivery, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientName } from '@/components/info/ClientName';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { geocodeAddress, type Coords } from '@/lib/geocoding';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { 
  ssr: false,
  loading: () => <div className="bg-muted animate-pulse w-full h-full" /> 
});

export default function ActiveDeliveryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const deliveryId = params.id as string;

  const firestore = useFirestore();
  const { user: courierUser } = useUser();

  const [isConfirming, setIsConfirming] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number, heading?: number | null } | null>(null);
  const lastLocationUpdate = useRef<number>(0);
  
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [pixStep, setPixStep] = useState<'choice' | 'qrcode' | 'confirmed'>('choice');
  const [isCheckingPix, setIsCheckingPix] = useState(false);

  const deliveryRef = useMemo(() => (
    firestore && deliveryId ? doc(firestore, 'deliveries', deliveryId) : null
  ), [firestore, deliveryId]);

  const { data: delivery, loading: loadingDelivery } = useDoc<Delivery>(deliveryRef);

  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coords | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(true);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);

  useEffect(() => {
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCurrentLocation({ 
            lat: pos.coords.latitude, 
            lng: pos.coords.longitude,
            heading: pos.coords.heading
          });
        },
        (err) => console.warn("Erro GPS:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

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
          setGeocodingError("Erro ao localizar endereços.");
        } finally {
            setIsGeocoding(false);
        }
      };
      runGeocoding();
    }
  }, [delivery]);

  const mapStops = useMemo(() => {
    if (!pickupCoords || !dropoffCoords || !delivery) return [];
    if (delivery.status === 'accepted') {
      return [{ id: 'pickup', lat: pickupCoords.lat, lng: pickupCoords.lng, label: 'Coleta', type: 'pickup' as const }];
    }
    return [{ id: 'dropoff', lat: dropoffCoords.lat, lng: dropoffCoords.lng, label: 'Entrega', type: 'dropoff' as const }];
  }, [pickupCoords, dropoffCoords, delivery]);

  const handleConfirmDelivery = async (finalMethod?: 'pix' | 'cash') => {
    if (!firestore || !delivery || !courierUser) return;
    setIsConfirming(true);
    const batch = writeBatch(firestore);
    const updateData: any = { status: 'finished', finishedAt: serverTimestamp() };
    if (finalMethod) updateData.paymentMethod = finalMethod;
    batch.update(doc(firestore, 'deliveries', delivery.id), updateData);
    batch.set(doc(collection(firestore, 'notifications')), {
        userId: delivery.clientId,
        title: 'Pedido Entregue!',
        description: `Seu pedido para ${delivery.dropoff} foi concluído.`,
        createdAt: serverTimestamp(),
        read: false,
        icon: 'wallet'
    });
    try {
        await batch.commit();
        toast({ title: "Entrega Finalizada!" });
        router.push('/courier');
    } catch (e) {
        toast({ variant: "destructive", title: "Erro ao confirmar" });
    } finally {
        setIsConfirming(false);
    }
  };
  
  const handleUpdateStatus = async () => {
    if (!firestore || !delivery) return;
    try {
      await updateDoc(doc(firestore, 'deliveries', delivery.id), { status: 'in-progress' });
      toast({ title: "Retirada Confirmada!" });
    } catch(e) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  if (loadingDelivery || isGeocoding) {
    return <div className="h-full flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary size-10" /></div>;
  }

  const isPickedUp = delivery?.status === 'in-progress';

  return (
    <div className="bg-card h-full">
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center bg-card/90 backdrop-blur-md p-4 justify-between border-b">
          <Button asChild variant="secondary" size="icon" className="rounded-full"><Link href="/courier"><ArrowLeft /></Link></Button>
          <div className="flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest font-headline">{isPickedUp ? 'Em Trânsito' : 'Indo Coletar'}</h2>
          </div>
          <Button variant="outline" size="icon" className="rounded-full bg-primary/10 text-primary border-primary/20"><Phone /></Button>
        </header>

        <div className="relative flex-1 overflow-hidden flex flex-col h-full">
          <div className="absolute inset-0 z-0">
            <DeliveryMap stops={mapStops} currentLocation={currentLocation} enable3D={true} />
          </div>

          <div className="relative z-10 mt-auto flex flex-col">
            <div className="h-12 w-full bg-gradient-to-t from-card to-transparent" />
            <div className="bg-card rounded-t-3xl px-6 pt-2 pb-6 shadow-2xl border-t">
              <div className="flex justify-center mb-4"><div className="w-12 h-1.5 rounded-full bg-muted" /></div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold font-headline leading-tight"><ClientName clientId={delivery!.clientId} /></h3>
                  <p className="text-muted-foreground font-medium flex items-center gap-1"><MapPin className="size-4" /> {isPickedUp ? delivery!.dropoff : delivery!.pickup}</p>
                </div>
              </div>
              <Button className="w-full text-lg py-7 rounded-2xl font-extrabold shadow-xl" onClick={isPickedUp ? (delivery!.paymentMethod === 'collect' ? () => setIsPaymentDialogOpen(true) : () => handleConfirmDelivery()) : handleUpdateStatus} disabled={isConfirming}>
                {isPickedUp ? 'FINALIZAR ENTREGA' : 'CONFIRMAR RETIRADA'}
                <CheckCircle className="size-6 ml-3" />
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-3xl p-6">
            <DialogHeader><DialogTitle className="text-2xl font-black text-center">Pagamento via Pix</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center py-6">
                <div className="p-4 bg-white rounded-2xl shadow-inner border"><Image src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=Pedido-${delivery!.id}`} alt="Pix" width={200} height={200} /></div>
                <h3 className="text-3xl font-black text-[#32BCAD] mt-6">{delivery!.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                <Button className="w-full mt-8 h-14 rounded-2xl bg-[#32BCAD] font-bold" onClick={() => handleConfirmDelivery('pix')}>CONCLUIR ENTREGA</Button>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
