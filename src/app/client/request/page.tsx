'use client';

import { ArrowLeft, User, Wallet, Map, ArrowRight, Loader2, CircleDot, Building, MapPin, AlertCircle, Ban } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn, checkClientBlockStatus } from "@/lib/utils";
import type { Delivery } from "@/lib/types";


export default function RequestDeliveryPage() {
  const { user, userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  // Busca faturas para verificar bloqueio
  const deliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'deliveries'),
      where('clientId', '==', user.uid),
      where('status', '==', 'finished'),
      where('paidByClient', '==', false)
    );
  }, [firestore, user?.uid]);

  const { data: unpaidDeliveries, loading: loadingUnpaid } = useCollection<Delivery>(deliveriesQuery);

  const blockStatus = useMemo(() => {
    return checkClientBlockStatus(unpaidDeliveries || []);
  }, [unpaidDeliveries]);

  const rates = useMemo(() => {
    if (!userProfile) return [];
    
    return [
      { id: 'rate-normal', value: userProfile.deliveryRate, label: 'Entrega Padrão (Arapongas)', description: 'Endereços comerciais e residenciais.' },
      { id: 'rate-condo-gi', value: userProfile.condoRateGoldemItalian, label: 'Cond. Goldem / Italian Ville', description: 'Taxa especial para estes condomínios.' },
      { id: 'rate-condo-mr', value: userProfile.condoRateMonteRey, label: 'Cond. Monte Rey / Bem Viver', description: 'Taxa especial para estes condomínios.' },
      { id: 'rate-aricanduva', value: userProfile.rateAricanduva, label: 'Aricanduva', description: 'Entrega para o distrito de Aricanduva.' },
      { id: 'rate-apucarana', value: userProfile.rateApucarana, label: 'Apucarana', description: 'Entrega intermunicipal para Apucarana.' },
      { id: 'rate-sabaudia', value: userProfile.rateSabaudia, label: 'Sabáudia', description: 'Entrega intermunicipal para Sabáudia.' },
      { id: 'rate-rolandia', value: userProfile.rateRolandia, label: 'Rolândia', description: 'Entrega intermunicipal para Rolândia.' },
      { id: 'rate-londrina', value: userProfile.rateLondrina, label: 'Londrina', description: 'Entrega intermunicipal para Londrina.' },
    ].filter(r => r.value != null && r.value > 0);
  }, [userProfile]);

  useEffect(() => {
    if (rates.length > 0 && selectedPrice === null) {
        setSelectedPrice(rates[0].value!);
    }
  }, [rates, selectedPrice]);

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blockStatus.isBlocked) {
        toast({
            variant: "destructive",
            title: "Conta Bloqueada",
            description: "Você possui pendências financeiras da semana anterior. Por favor, regularize seu saldo.",
        });
        return;
    }

    if (!user || !userProfile || !firestore) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Você precisa estar logado para solicitar uma entrega.",
      });
      return;
    }
    
    if (selectedPrice === null) {
        toast({
            variant: "destructive",
            title: "Selecione uma taxa",
            description: "Por favor, escolha um tipo de entrega.",
        });
        return;
    }

    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const pickup_street = formData.get("pickup_street") as string;
    const pickup_number = formData.get("pickup_number") as string;
    const pickup_neighborhood = formData.get("pickup_neighborhood") as string;
    const dropoff_street = formData.get("dropoff_street") as string;
    const dropoff_number = formData.get("dropoff_number") as string;
    const dropoff_neighborhood = formData.get("dropoff_neighborhood") as string;
    const observations = formData.get("observations") as string;

    let pickup: string;
    if (!pickup_street && !pickup_number && !pickup_neighborhood) {
        if (userProfile.address) {
            pickup = userProfile.address;
        } else {
            toast({
                variant: "destructive",
                title: "Endereço de Coleta Faltando",
                description: "Por favor, preencha o endereço de coleta ou cadastre um endereço no seu perfil.",
            });
            setIsSubmitting(false);
            return;
        }
    } else {
        pickup = `${pickup_street}, ${pickup_number} - ${pickup_neighborhood}`;
    }

    const dropoff = `${dropoff_street}, ${dropoff_number} - ${dropoff_neighborhood}`;

    const newDelivery = {
      pickup: pickup,
      dropoff: dropoff,
      price: selectedPrice,
      status: "pending" as const,
      clientId: user.uid,
      createdAt: serverTimestamp(),
      observations: observations,
      paidByClient: false
    };

    const deliveriesCollectionRef = collection(firestore, "deliveries");
    const notificationsCollectionRef = collection(firestore, 'notifications');

    addDoc(deliveriesCollectionRef, newDelivery)
      .then(async () => {
        toast({
          title: "Pedido Enviado!",
          description: `Seu pedido de entrega foi enviado com sucesso.`,
        });
        router.push("/client");

        // Notificação para o Próprio Cliente
        addDoc(notificationsCollectionRef, {
          userId: user.uid,
          title: 'Pedido Recebido!',
          description: 'Sua solicitação de entrega foi recebida e está aguardando um entregador.',
          createdAt: serverTimestamp(),
          read: false,
          icon: 'package',
          link: '/client'
        }).catch(() => {});

        // BUSCAR ADMINS E NOTIFICAR
        try {
          const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'admin'));
          const adminsSnapshot = await getDocs(adminsQuery);
          
          adminsSnapshot.docs.forEach(adminDoc => {
            addDoc(notificationsCollectionRef, {
              userId: adminDoc.id,
              title: '📦 Novo Pedido!',
              description: `${userProfile.displayName} solicitou uma entrega para ${dropoff_neighborhood}.`,
              createdAt: serverTimestamp(),
              read: false,
              icon: 'package',
              link: '/admin'
            }).catch(() => {});
          });
        } catch (queryError) {
          const permissionError = new FirestorePermissionError({
            path: 'users',
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: deliveriesCollectionRef.path,
          operation: 'create',
          requestResourceData: newDelivery,
        });
        errorEmitter.emit('permission-error', permissionError);

        toast({
          variant: "destructive",
          title: "Falha ao enviar pedido",
          description: "Ocorreu um erro ao enviar seu pedido. Tente novamente.",
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (blockStatus.isBlocked) {
    return (
        <div className="flex flex-col h-full bg-background items-center justify-center p-8 text-center">
            <div className="size-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                <Ban className="size-12 text-destructive" />
            </div>
            <h2 className="text-2xl font-black font-headline text-foreground">Solicitações Bloqueadas</h2>
            <p className="text-muted-foreground mt-4 leading-tight">
                Você possui pendências financeiras da semana anterior que venceram na última quarta-feira.
            </p>
            <div className="w-full mt-8 p-4 bg-muted/50 rounded-2xl border border-dashed text-left">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Resumo da Dívida</p>
                <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium">Valor em aberto:</span>
                    <span className="text-xl font-black text-destructive">{blockStatus.debtAmount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
            </div>
            <Button asChild className="w-full mt-8 py-7 rounded-2xl text-base font-bold shadow-xl shadow-primary/20">
                <Link href="/client/finance">Ir para Pagamento</Link>
            </Button>
            <Button asChild variant="ghost" className="mt-2 w-full">
                <Link href="/client">Voltar ao Início</Link>
            </Button>
        </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold tracking-tight font-headline">Nova Entrega</h1>
        <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
          <User className="text-primary size-4" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <form onSubmit={handleRequest} className="px-4 py-6 space-y-6 max-w-md mx-auto">
          
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest px-1 font-headline">Tipo de Entrega</h2>
            
            {userLoading ? <Skeleton className="h-32 w-full" /> : (
                <RadioGroup value={selectedPrice?.toString()} onValueChange={(value) => setSelectedPrice(parseFloat(value))} className="grid grid-cols-1 gap-3">
                    {rates.length > 0 ? rates.map((rate) => (
                        <div key={rate.id}>
                            <RadioGroupItem value={rate.value!.toString()} id={rate.id} className="sr-only" />
                            <Label htmlFor={rate.id} className={cn(
                                "flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer",
                                selectedPrice === rate.value ? "border-primary bg-primary/5" : "border-transparent bg-muted/60 hover:bg-muted"
                            )}>
                                <span className="font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <MapPin className="size-3.5 text-primary" />
                                        {rate.label}
                                    </span>
                                    <span>{rate.value!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </span>
                                <span className="text-xs text-muted-foreground mt-1">{rate.description}</span>
                            </Label>
                        </div>
                    )) : (
                         <Card className="bg-amber-500/10 border-amber-500/20 text-center p-4">
                            <p className="text-sm font-semibold text-amber-600">Nenhuma taxa de entrega configurada.</p>
                            <p className="text-xs text-amber-500">Por favor, entre em contato com o administrador.</p>
                        </Card>
                    )}
                </RadioGroup>
            )}
          </section>
          
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest px-1 font-headline">Detalhes da Coleta</h2>
            <Card className="p-4 rounded-xl">
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pickup_street">Endereço de Coleta (Opcional)</Label>
                  <div className="relative">
                    <CircleDot className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                    <Input id="pickup_street" name="pickup_street" placeholder="Rua de Coleta, 456" className="pl-10 py-6" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pickup_number">Número</Label>
                    <Input id="pickup_number" name="pickup_number" placeholder="Loja 3" className="py-6" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pickup_neighborhood">Bairro</Label>
                    <Input id="pickup_neighborhood" name="pickup_neighborhood" placeholder="Comercial" className="py-6" />
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest px-1 font-headline">Detalhes do Destino</h2>
            <Card className="p-4 rounded-xl">
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dropoff_street">Endereço de Entrega</Label>
                  <div className="relative">
                    <Map className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                    <Input id="dropoff_street" name="dropoff_street" placeholder="Rua Principal, 123" className="pl-10 py-6" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dropoff_number">Número</Label>
                    <Input id="dropoff_number" name="dropoff_number" placeholder="Ex: 123" className="py-6" required/>
                    <p className="text-[10px] text-muted-foreground mt-1">Insira apenas o número para melhor precisão no GPS.</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dropoff_neighborhood">Bairro</Label>
                    <Input id="dropoff_neighborhood" name="dropoff_neighborhood" placeholder="Centro" className="py-6" required/>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="observations">Observações (Apto, Bloco, etc)</Label>
                  <Textarea id="observations" name="observations" placeholder="Ex: Apto 4B, Bloco 2, deixar na portaria..." />
                </div>
              </div>
            </Card>
          </section>

          <div className="pt-4">
            <Button type="submit" disabled={isSubmitting || userLoading || selectedPrice === null || blockStatus.isBlocked} className="w-full py-6 text-base font-bold rounded-xl">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirmar Solicitação de Entrega'}
                {!isSubmitting && <ArrowRight className="size-5 ml-2" />}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4 px-6">
              Ao confirmar, um novo pedido será criado e os administradores notificados.
            </p>
          </div>
        </form>
      </main>
    </>
  );
}
