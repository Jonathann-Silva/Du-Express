
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, CheckCircle, Store, MapPin, Loader2, Navigation as NavIcon, Package, Banknote, Smartphone, RefreshCw, Timer } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Delivery, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { geocodeAddress, type Coords } from '@/lib/geocoding';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientName } from '@/components/info/ClientName';
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

type OptimizedStop = {
    deliveryId: string;
    address: string;
    type: 'pickup' | 'dropoff';
    status: Delivery['status'];
    coords?: Coords;
    acceptedAt?: any;
    createdAt?: any;
};

export default function MultiDeliveryNavigation() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [currentPos, setCurrentPos] = useState<Coords | null>(null);
    const [stops, setStops] = useState<OptimizedStop[]>([]);
    const [isGeocoding, setIsGeocoding] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(interval);
    }, []);

    // Estados para o modal de pagamento Pix
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [taskToFinish, setTaskToFinish] = useState<Delivery | null>(null);
    const [pixStep, setPixStep] = useState<'choice' | 'qrcode' | 'confirmed'>('choice');
    const [isCheckingPix, setIsCheckingPix] = useState(false);

    const activeTasksQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'deliveries'),
            where('courierId', '==', user.uid),
            where('status', 'in', ['accepted', 'in-progress'])
        );
    }, [firestore, user]);

    const { data: deliveries, loading: loadingTasks } = useCollection<Delivery>(activeTasksQuery);

    // Busca regras de tempo limite
    const rulesRef = useMemo(() => (
        firestore ? doc(firestore, 'settings', 'rules') : null
    ), [firestore]);
    const { data: rulesSetting } = useDoc<{ deliveryTimeLimit?: number }>(rulesRef);
    const timeLimitMin = rulesSetting?.deliveryTimeLimit || 60;

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => console.warn("Location denied")
            );
        }
    }, []);

    useEffect(() => {
        if (!deliveries) return;

        const buildRoute = async () => {
            setIsGeocoding(true);
            const newStops: OptimizedStop[] = [];

            const pickups = deliveries.filter(d => d.status === 'accepted');
            const dropoffs = deliveries.filter(d => d.status === 'in-progress');

            for (const d of pickups) {
                const coords = await geocodeAddress(d.pickup);
                newStops.push({ 
                    deliveryId: d.id, 
                    address: d.pickup, 
                    type: 'pickup', 
                    status: d.status, 
                    coords: coords || undefined,
                    acceptedAt: d.acceptedAt,
                    createdAt: d.createdAt
                });
            }

            for (const d of dropoffs) {
                const coords = await geocodeAddress(d.dropoff);
                newStops.push({ 
                    deliveryId: d.id, 
                    address: d.dropoff, 
                    type: 'dropoff', 
                    status: d.status, 
                    coords: coords || undefined,
                    acceptedAt: d.acceptedAt,
                    createdAt: d.createdAt
                });
            }

            setStops(newStops);
            setIsGeocoding(false);
        };

        buildRoute();
    }, [deliveries]);

    const handleAction = async (stop: OptimizedStop) => {
        const delivery = deliveries?.find(d => d.id === stop.deliveryId);
        if (!delivery) return;

        // Se for uma entrega (dropoff) e o pagamento for 'collect', abre o modal de pagamento
        if (stop.type === 'dropoff' && delivery.paymentMethod === 'collect') {
            setTaskToFinish(delivery);
            setPixStep('choice');
            setIsPaymentDialogOpen(true);
            return;
        }

        performStatusUpdate(delivery, stop.type === 'pickup' ? 'in-progress' : 'finished');
    };

    const performStatusUpdate = async (delivery: Delivery, nextStatus: Delivery['status'], finalMethod?: 'pix' | 'cash') => {
        if (!firestore) return;
        setIsUpdating(delivery.id);

        const deliveryRef = doc(firestore, 'deliveries', delivery.id);
        const batch = writeBatch(firestore);

        const updateData: any = { status: nextStatus };
        if (nextStatus === 'finished') {
            updateData.finishedAt = serverTimestamp();
            if (finalMethod) updateData.paymentMethod = finalMethod;
        }
        batch.update(deliveryRef, updateData);

        const clientNotifRef = doc(collection(firestore, 'notifications'));
        batch.set(clientNotifRef, {
            userId: delivery.clientId,
            title: nextStatus === 'in-progress' ? 'Seu pedido está em trânsito!' : 'Entrega concluída!',
            description: nextStatus === 'in-progress' ? 'O entregador coletou seu pedido e está a caminho.' : 'Seu pedido foi entregue com sucesso.',
            createdAt: serverTimestamp(),
            read: false,
            icon: nextStatus === 'in-progress' ? 'package' : 'wallet'
        });

        try {
            await batch.commit();
            toast({ title: nextStatus === 'in-progress' ? 'Coleta Confirmada' : 'Entrega Finalizada' });
            setIsPaymentDialogOpen(false);
            setTaskToFinish(null);
        } catch (e) {
            toast({ title: "Erro ao atualizar", variant: "destructive" });
        } finally {
            setIsUpdating(null);
        }
    };

    const simulatePixConfirmation = () => {
        setIsCheckingPix(true);
        setTimeout(() => {
            setIsCheckingPix(false);
            setPixStep('confirmed');
            toast({ title: "Pix Recebido!", description: "Status: Pagamento identificado via Mercado Pago." });
        }, 3000);
    };

    const mapStops = useMemo(() => stops.filter(s => s.coords).map(s => ({
        lng: s.coords!.lng,
        lat: s.coords!.lat,
        label: s.address,
        type: s.type,
        id: s.deliveryId
    })), [stops]);

    if (loadingTasks || isGeocoding) {
        return (
            <div className="h-full bg-background flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="size-12 text-primary animate-spin mb-4" />
                <h2 className="text-xl font-bold font-headline">Otimizando sua rota...</h2>
                <p className="text-muted-foreground text-sm mt-2">Calculando a melhor sequência para suas coletas e entregas.</p>
            </div>
        );
    }

    if (!deliveries || deliveries.length === 0) {
        return (
            <div className="h-full bg-background flex flex-col items-center justify-center p-6 text-center">
                <Package className="size-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold">Nenhuma tarefa ativa</h2>
                <Button asChild className="mt-6"><Link href="/courier">Voltar ao Painel</Link></Button>
            </div>
        );
    }

    return (
        <div className="h-full relative overflow-hidden bg-background">
            <header className="absolute top-0 left-0 right-0 z-20 flex items-center bg-background/90 backdrop-blur-md p-4 justify-between border-b shadow-sm">
                <Button asChild variant="ghost" size="icon" className="rounded-full">
                    <Link href="/courier"><ArrowLeft /></Link>
                </Button>
                <div className="text-center">
                    <h2 className="text-sm font-bold uppercase tracking-widest font-headline">Rota Otimizada</h2>
                    <p className="text-primary text-[10px] font-bold uppercase">{deliveries.length} Entregas Simultâneas</p>
                </div>
                <div className="size-10" />
            </header>

            <div className="absolute inset-0 z-0">
                <DeliveryMap stops={mapStops} currentLocation={currentPos} />
            </div>

            <div className={cn(
                "absolute bottom-0 left-0 right-0 z-20 bg-card rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] border-t transition-all duration-500",
                isExpanded ? "h-[65%]" : "h-24"
            )}>
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex flex-col items-center pt-3 pb-2"
                >
                    <div className="w-12 h-1.5 rounded-full bg-muted mb-2" />
                    {!isExpanded && <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ver Roteiro Completo</p>}
                </button>

                <div className="px-6 h-full overflow-y-auto pb-32">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-2xl font-black font-headline">Roteiro</h3>
                            <p className="text-sm text-muted-foreground font-medium">{stops.length} paradas restantes</p>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20">Modo Combo</Badge>
                    </div>

                    <div className="space-y-6 relative">
                        <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-muted z-0" />
                        
                        {stops.map((stop, idx) => {
                            const delivery = deliveries.find(d => d.id === stop.deliveryId);
                            
                            // Lógica de atraso reativa
                            const startTime = stop.acceptedAt?.toDate?.()?.getTime() || stop.createdAt?.toDate?.()?.getTime();
                            const isDelayed = startTime && ((now - startTime) / (1000 * 60) > timeLimitMin);

                            return (
                                <div key={`${stop.deliveryId}-${idx}`} className="flex gap-4 relative z-10">
                                    <div className="flex-none flex flex-col items-center">
                                        <div className={cn(
                                            "size-10 rounded-full flex items-center justify-center shadow-lg transition-colors",
                                            isDelayed ? "bg-red-600 text-white" : (stop.type === 'pickup' ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white")
                                        )}>
                                            {stop.type === 'pickup' ? <Store size={18} /> : <MapPin size={18} />}
                                        </div>
                                        <div className="mt-2 text-[10px] font-black opacity-30">{idx + 1}º</div>
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wider",
                                                    isDelayed ? "text-red-600 animate-pulse" : (stop.type === 'pickup' ? "text-primary" : "text-emerald-600")
                                                )}>
                                                    {isDelayed ? '⚠ ENTREGA EM ATRASO' : (stop.type === 'pickup' ? 'Coletar em:' : 'Entregar em:')}
                                                </p>
                                                <h4 className={cn("font-bold text-base leading-tight mt-0.5", isDelayed && "text-red-600")}>{stop.address}</h4>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter text-primary border-primary/20 bg-primary/5">
                                                {delivery?.clientId ? <ClientName clientId={delivery.clientId} /> : '...'}
                                            </Badge>
                                        </div>
                                        
                                        <Button 
                                            className={cn(
                                                "w-full mt-4 rounded-xl font-bold h-12 shadow-sm",
                                                isDelayed ? "bg-red-600 hover:bg-red-700" : (stop.type === 'pickup' ? "bg-primary" : "bg-emerald-600 hover:bg-emerald-700")
                                            )}
                                            onClick={() => handleAction(stop)}
                                            disabled={!!isUpdating && isUpdating === stop.deliveryId}
                                        >
                                            {isUpdating === stop.deliveryId ? (
                                                <Loader2 className="animate-spin" />
                                            ) : (
                                                <>
                                                    {stop.type === 'pickup' ? 'Confirmar Retirada' : 'Finalizar Entrega'}
                                                    <CheckCircle className="ml-2 size-4" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
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
                                : 'Apresente o QR Code para o cliente.'}
                        </DialogDescription>
                    </DialogHeader>

                    {pixStep === 'choice' && (
                        <div className="grid grid-cols-2 gap-4 py-6">
                            <Button 
                                variant="outline" 
                                className="flex flex-col items-center gap-3 h-32 rounded-2xl border-2 hover:border-emerald-500 hover:bg-emerald-50 hover:text-foreground transition-all"
                                onClick={() => taskToFinish && performStatusUpdate(taskToFinish, 'finished', 'cash')}
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
                            <div className="p-4 bg-white rounded-2xl shadow-inner border relative">
                                <Image 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=LucasExpresso-Pedido-${taskToFinish?.id}`}
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
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Valor</p>
                                <h3 className="text-3xl font-black text-[#32BCAD] font-headline">
                                    {taskToFinish?.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </h3>
                                <Button 
                                    className="w-full mt-8 h-14 rounded-2xl bg-[#32BCAD] hover:bg-[#2aa395] font-bold gap-2 shadow-lg shadow-[#32BCAD]/20"
                                    onClick={simulatePixConfirmation}
                                    disabled={isCheckingPix}
                                >
                                    {isCheckingPix ? <Loader2 className="animate-spin size-5" /> : <RefreshCw className="size-5" />}
                                    Verificar Notificação
                                </Button>
                            </div>
                        </div>
                    )}

                    {pixStep === 'confirmed' && (
                        <div className="flex flex-col items-center py-10 text-center animate-in zoom-in-95">
                            <div className="size-20 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-6">
                                <CheckCircle size={48} />
                            </div>
                            <h3 className="text-2xl font-black font-headline text-emerald-600">Pix Confirmado!</h3>
                            <Button 
                                className="w-full mt-8 h-14 rounded-2xl font-black text-base shadow-xl"
                                onClick={() => taskToFinish && performStatusUpdate(taskToFinish, 'finished', 'pix')}
                            >
                                FINALIZAR ENTREGA
                            </Button>
                        </div>
                    )}

                    <Button variant="ghost" className="w-full text-muted-foreground font-bold" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}
