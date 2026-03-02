'use client';

import { ArrowLeft, User, Wallet, Map, ArrowRight, Loader2, CircleDot, Building, MapPin, AlertCircle, Ban, CreditCard, Banknote, CheckCircle2, ShieldAlert } from "lucide-react";
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
import { useState, useMemo, useEffect } from "react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn, checkClientBlockStatus } from "@/lib/utils";
import type { Delivery, PaymentMethod } from "@/lib/types";


export default function RequestDeliveryPage() {
  const { user, userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  // States para detecção automática de endereço
  const [dropoffStreet, setDropoffStreet] = useState("");
  const [dropoffNumber, setDropoffNumber] = useState("");

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

  // Lógica de Detecção Automática de Condomínio
  const isAutoDetectedCondo = useMemo(() => {
    const cleanStreet = dropoffStreet.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const cleanNum = dropoffNumber.trim();

    const isSabaia = (cleanStreet === "rua sabia da praia" || cleanStreet === "sabia da praia") && cleanNum === "855";
    const isTicoTico = (cleanStreet === "rua tico tico rei" || cleanStreet === "tico tico rei") && cleanNum === "840";

    return isSabaia || isTicoTico;
  }, [dropoffStreet, dropoffNumber]);

  useEffect(() => {
    if (isAutoDetectedCondo && userProfile?.condoRateGoldemItalian) {
      if (selectedPrice !== userProfile.condoRateGoldemItalian) {
        setSelectedPrice(userProfile.condoRateGoldemItalian);
        toast({
          title: "Condomínio Detectado",
          description: "Taxa Cond. Goldem / Italian Ville aplicada automaticamente.",
        });
      }
    }
  }, [isAutoDetectedCondo, userProfile, selectedPrice, toast]);

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

    if (paymentMethod === null) {
        toast({
            variant: "destructive",
            title: "Selecione o pagamento",
            description: "Por favor, escolha uma opção de pagamento.",
        });
        return;
    }

    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const pickup_street = formData.get("pickup_street") as string;
    const pickup_number = formData.get("pickup_number") as string;
    const pickup_neighborhood = formData.get("pickup_neighborhood") as string;
    const observations = formData.get("observations") as string;
    const dropoff_neighborhood = formData.get("dropoff_neighborhood") as string;

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
        pickup = `${pickup_street || ''}, ${pickup_number || ''} - ${pickup_neighborhood || ''}`.replace(/^, /, '').replace(/ - $/, '');
    }

    const dropoff = `${dropoffStreet}, ${dropoffNumber} - ${dropoff_neighborhood || ''}`;

    const newDelivery = {
      pickup: pickup,
      dropoff: dropoff,
      price: selectedPrice,
      status: "pending" as const,
      clientId: user.uid,
      createdAt: serverTimestamp(),
      observations: observations || "",
      paidByClient: false,
      paymentMethod: paymentMethod
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
              description: `${userProfile.displayName} solicitou uma entrega para ${dropoff_neighborhood || 'um novo destino'}.`,
              createdAt: serverTimestamp(),
              read: false,
              icon: 'package',
              link: '/admin'
            }).catch(() => {});
          });
        } catch (queryError) {
          console.error("Admin query error", queryError);
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
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 py-4 border-b flex items-center justify-between">
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
        <form onSubmit={handleRequest} className="px-4 py-6 space-y-8 max-w-md mx-auto">
          
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest font-headline">1. Tipo de Entrega</h2>
              {isAutoDetectedCondo && (
                <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                  <ShieldAlert className="size-3" />
                  TAXA OBRIGATÓRIA
                </div>
              )}
            </div>
            
            {userLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : (
                <RadioGroup 
                    value={selectedPrice?.toString() || ""} 
                    onValueChange={(val) => {
                      // Se for condomínio detectado, impede a troca manual para taxas menores
                      if (!isAutoDetectedCondo) {
                        setSelectedPrice(parseFloat(val));
                      }
                    }} 
                    className="grid grid-cols-1 gap-3"
                >
                    {rates.length > 0 ? rates.map((rate) => {
                        const isSelected = selectedPrice === rate.value;
                        const isDisabled = isAutoDetectedCondo && !isSelected;

                        return (
                          <div key={rate.id} className="relative">
                              <RadioGroupItem value={rate.value!.toString()} id={rate.id} className="peer sr-only" disabled={isDisabled} />
                              <Label 
                                  htmlFor={rate.id} 
                                  className={cn(
                                      "flex flex-col p-4 rounded-2xl border-2 transition-all relative overflow-hidden",
                                      isSelected 
                                          ? "border-primary bg-primary/5 shadow-md" 
                                          : (isDisabled ? "opacity-40 cursor-not-allowed border-muted bg-muted/10" : "border-muted bg-card hover:bg-muted/30 cursor-pointer")
                                  )}
                              >
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="font-bold text-sm flex items-center gap-2">
                                          <MapPin className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                                          {rate.label}
                                      </span>
                                      <span className="text-base font-black text-primary">
                                          {rate.value!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-medium">{rate.description}</span>
                                  {isSelected && (
                                      <CheckCircle2 className="absolute -right-1 -bottom-1 size-8 text-primary opacity-10" />
                                  )}
                              </Label>
                          </div>
                        );
                    }) : (
                         <Card className="bg-amber-500/10 border-amber-500/20 text-center p-6 rounded-2xl">
                            <AlertCircle className="size-8 text-amber-500 mx-auto mb-2" />
                            <p className="text-sm font-bold text-amber-700">Nenhuma taxa configurada.</p>
                            <p className="text-[10px] text-amber-600 mt-1">Sua conta ainda não possui valores de entrega definidos. Fale com a central.</p>
                        </Card>
                    )}
                </RadioGroup>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 font-headline">2. Opção de Pagamento</h2>
            <RadioGroup value={paymentMethod || ""} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-1 gap-3">
                <div className="relative">
                    <RadioGroupItem value="credit" id="pay-credit" className="peer sr-only" />
                    <Label 
                        htmlFor="pay-credit" 
                        className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                            paymentMethod === 'credit' ? "border-primary bg-primary/5 shadow-sm" : "border-muted bg-card"
                        )}
                    >
                        <div className={cn("size-10 rounded-xl flex items-center justify-center", paymentMethod === 'credit' ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                            <CreditCard className="size-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-sm">Crediário</p>
                            <p className="text-[10px] text-muted-foreground font-medium">Cobrança semanal automática no app</p>
                        </div>
                    </Label>
                </div>
                <div className="relative">
                    <RadioGroupItem value="collect" id="pay-collect" className="peer sr-only" />
                    <Label 
                        htmlFor="pay-collect" 
                        className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                            paymentMethod === 'collect' ? "border-primary bg-primary/5 shadow-sm" : "border-muted bg-card"
                        )}
                    >
                        <div className={cn("size-10 rounded-xl flex items-center justify-center", paymentMethod === 'collect' ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                            <Banknote className="size-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-sm">Receber no Local</p>
                            <p className="text-[10px] text-muted-foreground font-medium">Motoboy cobra em dinheiro ou pix na entrega</p>
                        </div>
                    </Label>
                </div>
            </RadioGroup>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 font-headline">3. Detalhes da Coleta</h2>
            <Card className="p-5 rounded-2xl border-none shadow-sm bg-muted/30">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pickup_street" className="text-xs font-bold text-muted-foreground ml-1">Rua de Coleta (Opcional)</Label>
                  <div className="relative">
                    <CircleDot className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                    <Input id="pickup_street" name="pickup_street" placeholder={userProfile?.address ? "Usar endereço salvo" : "Rua de Coleta, 456"} className="pl-10 h-12 rounded-xl bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pickup_number" className="text-xs font-bold text-muted-foreground ml-1">Número</Label>
                    <Input id="pickup_number" name="pickup_number" placeholder="Ex: Loja 3" className="h-12 rounded-xl bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pickup_neighborhood" className="text-xs font-bold text-muted-foreground ml-1">Bairro</Label>
                    <Input id="pickup_neighborhood" name="pickup_neighborhood" placeholder="Centro" className="h-12 rounded-xl bg-background" />
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 font-headline">4. Detalhes do Destino</h2>
            <Card className="p-5 rounded-2xl border-none shadow-sm bg-muted/30">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dropoff_street" className="text-xs font-bold text-muted-foreground ml-1">Endereço de Entrega</Label>
                  <div className="relative">
                    <Map className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                    <Input 
                      id="dropoff_street" 
                      name="dropoff_street" 
                      placeholder="Rua Principal" 
                      className="pl-10 h-12 rounded-xl bg-background" 
                      required 
                      value={dropoffStreet}
                      onChange={(e) => {
                        // Aceita apenas letras e espaços (inclui acentos latinos), removendo números e símbolos
                        const filteredValue = e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, "");
                        setDropoffStreet(filteredValue);
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dropoff_number" className="text-xs font-bold text-muted-foreground ml-1">Número</Label>
                    <Input 
                      id="dropoff_number" 
                      name="dropoff_number" 
                      placeholder="Ex: 123" 
                      className="h-12 rounded-xl bg-background" 
                      required
                      value={dropoffNumber}
                      onChange={(e) => setDropoffNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dropoff_neighborhood" className="text-xs font-bold text-muted-foreground ml-1">Bairro</Label>
                    <Input id="dropoff_neighborhood" name="dropoff_neighborhood" placeholder="Centro" className="h-12 rounded-xl bg-background" required/>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="observations" className="text-xs font-bold text-muted-foreground ml-1">Observações (Apto, Bloco, etc)</Label>
                  <Textarea id="observations" name="observations" placeholder="Ex: Apto 4B, Bloco 2, deixar na portaria..." className="rounded-xl bg-background min-h-[100px] resize-none" />
                </div>
              </div>
            </Card>
          </section>

          <div className="pt-6">
            <Button 
                type="submit" 
                disabled={isSubmitting || userLoading || selectedPrice === null || paymentMethod === null || blockStatus.isBlocked} 
                className="w-full h-16 text-lg font-black rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95"
            >
                {isSubmitting ? <Loader2 className="animate-spin size-6" /> : (
                    <>
                        SOLICITAR ENTREGA
                        <ArrowRight className="size-6 ml-3" />
                    </>
                )}
            </Button>
            <p className="text-center text-[10px] text-muted-foreground mt-4 px-8 uppercase font-bold tracking-widest opacity-60">
              Ao confirmar, a central Lucas-Expresso enviará o motoboy mais próximo.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}