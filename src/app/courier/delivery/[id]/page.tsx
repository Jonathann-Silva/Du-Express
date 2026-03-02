
'use client';

import { ArrowLeft, Phone, MessageCircle, Info, CheckCircle, MapPin, Loader2, Package, Map as MapIcon, Banknote, Smartphone, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useDoc, useUser } from '@/firebase';
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
  const [currentLocation, setCurrentLocation] = useState<Coords | null>(null);
  
  // Estados para o modal de pagamento Pix
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [pixStep, setPixStep] = useState<'choice' | 'qrcode' | 'confirmed'>('choice');
  const [isCheckingPix, setIsCheckingPix] = useState(false);

  const deliveryRef = useMemo(() => (
    firestore && deliveryId ? doc(firestore, 'deliveries', deliveryId) : null
  ), [firestore, deliveryId]);

  const { data: delivery, loading: loadingDelivery } = useDoc<Delivery>(deliveryRef);

  const clientRef = useMemo(() => (
    firestore && delivery?.clientId ? doc(firestore, 'users', delivery.clientId) : null
  ), [firestore, delivery?.clientId]);

  const { data: client, loading: loadingClient } = useDoc<UserProfile>(clientRef);
  
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coords | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(true);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location permission denied", err)
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
    if (!pickupCoords || !dropoffCoords || !delivery) return [];
    
    if (delivery.status === 'accepted') {
      return [
        { id: 'pickup', lat: pickupCoords.lat, lng: pickupCoords.lng, label: 'Coleta', type: 'pickup' as const },
        { id: 'dropoff', lat: dropoffCoords.lat, lng: dropoffCoords.lng, label: 'Entrega', type: 'dropoff' as const }
      ];
    }
    
    return [
      { id: 'dropoff', lat: dropoffCoords.lat, lng: dropoffCoords.lng, label: 'Entrega', type: 'dropoff' as const }
    ];
  }, [pickupCoords, dropoffCoords, delivery]);


  const handleConfirmDelivery = async (finalMethod?: 'pix' | 'cash') => {
    if (!firestore || !delivery || !client || !courierUser) return;

    setIsConfirming(true);

    const deliveryDocRef = doc(firestore, 'deliveries', delivery.id);
    const clientNotifRef = doc(collection(firestore, 'notifications'));
    const batch = writeBatch(firestore);

    const updateData: any = { 
      status: 'finished',
      finishedAt: serverTimestamp()
    };

    if (finalMethod) {
      updateData.paymentMethod = finalMethod;
    }

    batch.update(deliveryDocRef, updateData);

    batch.set(clientNotifRef, {
        userId: delivery.clientId,
        title: 'Sua entrega foi finalizada!',
        description: `O pedido para ${delivery.dropoff} foi concluído com sucesso.`,
        createdAt: serverTimestamp(),
        read: false,
        icon: 'wallet',
        link: '/client/history'
    });
    
    try {
        await batch.commit();
        toast({
            title: "Entrega Finalizada!",
            description: "Você completou a tarefa. Ótimo trabalho!",
        });
        router.push('/courier');
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: deliveryDocRef.path,
            operation: 'update',
            requestResourceData: { status: 'finished' },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erro ao confirmar",
            description: "Não foi possível finalizar a entrega. Verifique as permissões.",
        });
    } finally {
        setIsConfirming(false);
    }
  };
  
  const handleUpdateStatus = async () => {
    if (!firestore || !delivery || delivery.status === 'in-progress' ) return;
    
    const deliveryDocRef = doc(firestore, 'deliveries', delivery.id);
    
    try {
      await updateDoc(deliveryDocRef, { status: 'in-progress' });
      toast({
        title: "Status Atualizado!",
        description: "A entrega está agora marcada como 'Em Trânsito'.",
      });
    } catch(e) {
      console.error(e);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da entrega.",
        variant: "destructive"
      });
    }
  };

  const simulatePixConfirmation = () => {
    setIsCheckingPix(true);
    setTimeout(() => {
      setIsCheckingPix(false);
      setPixStep('confirmed');
      toast({ title: "Pix Confirmado!", description: "Recebemos a notificação de pagamento." });
    }, 3000);
  };

  const isLoading = loadingDelivery || loadingClient;
  const isPickedUp = delivery?.status === 'in-progress';

  if (isLoading) {
    return (
        <div className="bg-card h-full">
            <header className="absolute top-0 left-0 right-0 z-20 flex items-center bg-card/90 backdrop-blur-md p-4 justify-between border-b">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-col items-center gap-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="size-10 rounded-full" />
            </header>
            <div className="relative flex-1 overflow-hidden flex flex-col h-full">
                <div className="absolute inset-0 z-0 bg-muted"></div>
                <div className="relative z-10 mt-auto flex flex-col">
                    <div className="h-12 w-full bg-gradient-to-t from-card to-transparent" />
                    <div className="bg-card rounded-t-3xl px-6 pt-2 pb-6 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] border-t">
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-1.5 rounded-full bg-muted" />
                        </div>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-8 w-48" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                            <Skeleton className="size-10 rounded-full ml-4" />
                        </div>
                        <Skeleton className="h-16 w-full mb-6" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                    </div>
                </div>
            </div>
        </div>
    );
  }

  if (!delivery) {
    return (
        <div className="bg-card h-full flex flex-col items-center justify-center text-center p-4">
            <Package className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold">Entrega não encontrada</h2>
            <p className="text-muted-foreground">Esta entrega pode ter sido cancelada ou não existe mais.</p>
            <Button asChild className="mt-6">
                <Link href="/courier">Voltar para Tarefas</Link>
            </Button>
        </div>
    );
  }
  
  const buttonAction = isPickedUp 
    ? (delivery.paymentMethod === 'collect' ? () => setIsPaymentDialogOpen(true) : () => handleConfirmDelivery()) 
    : handleUpdateStatus;

  const buttonDisabled = isConfirming;
  let buttonContent;

  if (isPickedUp) {
    buttonContent = (
      <>
        {isConfirming && <Loader2 className="mr-2 animate-spin"/>}
        {isConfirming ? 'Finalizando...' : 'FINALIZAR ENTREGA'}
        {!isConfirming && <CheckCircle className="size-6 ml-3" />}
      </>
    );
  } else {
    buttonContent = (
      <>
        CONFIRMAR RETIRADA
        <CheckCircle className="size-6 ml-3" />
      </>
    );
  }


  return (
    <div className="bg-card h-full">
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center bg-card/90 backdrop-blur-md p-4 justify-between border-b">
          <Button asChild variant="secondary" size="icon" className="rounded-full">
            <Link href="/courier">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest font-headline">{isPickedUp ? 'Em Trânsito' : 'Coleta Pendente'}</h2>
          </div>
          <Button variant="outline" size="icon" className="rounded-full bg-primary/10 text-primary border-primary/20">
            <Phone />
          </Button>
        </header>

        <div className="relative flex-1 overflow-hidden flex flex-col h-full">
          <div className="absolute inset-0 z-0">
            {(isGeocoding) && (
                <div className="bg-muted w-full h-full flex flex-col items-center justify-center text-center">
                    <Loader2 className="size-8 text-muted-foreground animate-spin mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Carregando mapa...</p>
                </div>
            )}
            {!(isGeocoding) && geocodingError && (
                <div className="bg-destructive/10 w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <MapIcon className="size-8 text-destructive mb-2" />
                    <p className="text-sm font-semibold text-destructive">{geocodingError}</p>
                </div>
            )}
            {!(isGeocoding) && !geocodingError && pickupCoords && dropoffCoords && (
              <DeliveryMap stops={mapStops} currentLocation={currentLocation} />
            )}
          </div>

          <div className="relative z-10 mt-auto flex flex-col">
            <div className="h-12 w-full bg-gradient-to-t from-card to-transparent" />
            
            <div className="bg-card rounded-t-3xl px-6 pt-2 pb-6 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] border-t">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1.5 rounded-full bg-muted" />
              </div>
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold font-headline leading-tight">
                    <ClientName clientId={delivery.clientId} />
                  </h3>
                  <p className="text-muted-foreground font-medium flex items-center gap-1">
                    <MapPin className="size-4" /> {isPickedUp ? delivery.dropoff : delivery.pickup}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="icon" className="rounded-full">
                    <MessageCircle />
                  </Button>
                </div>
              </div>

              {delivery.observations && (
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-1">
                    <Info className="text-primary size-4" />
                    <span className="text-primary font-bold text-xs uppercase tracking-wider">Observações do Cliente</span>
                    </div>
                    <p className="text-sm leading-relaxed font-medium">
                        "{delivery.observations}"
                    </p>
                </div>
              )}

              <Button 
                className="w-full text-lg py-7 rounded-2xl font-extrabold"
                onClick={buttonAction}
                disabled={buttonDisabled}
              >
                {buttonContent}
              </Button>
            </div>
          </div>
        </div>

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
                    : 'Peça ao cliente para escanear o código abaixo.'}
              </DialogDescription>
            </DialogHeader>

            {pixStep === 'choice' && (
                <div className="grid grid-cols-2 gap-4 py-6">
                <Button 
                    variant="outline" 
                    className="flex flex-col items-center gap-3 h-32 rounded-2xl border-2 hover:border-emerald-500 hover:bg-emerald-50 hover:text-foreground transition-all"
                    onClick={() => handleConfirmDelivery('cash')}
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
                    <div className="p-4 bg-white rounded-2xl shadow-inner border relative overflow-hidden">
                        <Image 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=LucasExpresso-Pedido-${delivery?.id}`}
                            alt="QR Code Pix"
                            width={200}
                            height={200}
                            className="rounded-lg"
                        />
                        {isCheckingPix && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                                <Loader2 className="size-10 text-[#32BCAD] animate-spin" />
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-6 text-center w-full">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Valor a Cobrar</p>
                        <h3 className="text-3xl font-black text-[#32BCAD] font-headline">
                            {delivery?.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        
                        <div className="mt-8 space-y-3">
                            <Button 
                                className="w-full h-14 rounded-2xl bg-[#32BCAD] hover:bg-[#2aa395] font-bold gap-2 shadow-lg shadow-[#32BCAD]/20"
                                onClick={simulatePixConfirmation}
                                disabled={isCheckingPix}
                            >
                                {isCheckingPix ? <Loader2 className="animate-spin size-5" /> : <RefreshCw className="size-5" />}
                                {isCheckingPix ? 'Verificando Notificação...' : 'Verificar Recebimento'}
                            </Button>
                            <p className="text-[10px] text-muted-foreground italic leading-tight">
                                A entrega será liberada automaticamente após a confirmação do Mercado Pago.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {pixStep === 'confirmed' && (
                <div className="flex flex-col items-center py-10 text-center animate-in zoom-in-95">
                    <div className="size-20 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-6">
                        <CheckCircle size={48} />
                    </div>
                    <h3 className="text-2xl font-black font-headline text-emerald-600">Pagamento Confirmado!</h3>
                    <p className="text-sm text-muted-foreground mt-2">O Pix foi identificado com sucesso.</p>
                    
                    <Button 
                        className="w-full mt-8 h-14 rounded-2xl font-black text-base"
                        onClick={() => handleConfirmDelivery('pix')}
                    >
                        CONCLUIR ENTREGA
                    </Button>
                </div>
            )}

            <Button variant="ghost" className="w-full text-muted-foreground font-bold" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
          </DialogContent>
        </Dialog>
    </div>
  );
}
