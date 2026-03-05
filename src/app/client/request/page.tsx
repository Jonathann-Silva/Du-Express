'use client';

import { ArrowLeft, Wallet, Map, ArrowRight, Loader2, CircleDot, MapPin, AlertCircle, CreditCard, Banknote, CheckCircle2, ShieldAlert, Smartphone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn, checkClientBlockStatus } from "@/lib/utils";
import type { Delivery, PaymentMethod } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sendPushNotification } from "@/services/push-notification";


export default function RequestDeliveryPage() {
  const { user, userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  const [dropoffStreet, setDropoffStreet] = useState("");
  const [dropoffNumber, setDropoffNumber] = useState("");

  const deliveriesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'deliveries'),
      where('clientId', '==', user.uid),
      where('status', '==', 'finished')
    );
  }, [firestore, user?.uid]);

  const { data: finishedDeliveries } = useCollection<Delivery>(deliveriesQuery);

  const unpaidDeliveries = useMemo(() => {
    return finishedDeliveries?.filter(d => d.paidByClient === false || d.paidByClient === undefined) || [];
  }, [finishedDeliveries]);

  const blockStatus = useMemo(() => {
    return checkClientBlockStatus(unpaidDeliveries);
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

  const selectedPrice = useMemo(() => {
    const rate = rates.find(r => r.id === selectedRateId);
    return rate ? rate.value : null;
  }, [selectedRateId, rates]);

  const isAutoDetectedGoldem = useMemo(() => {
    const cleanStreet = dropoffStreet.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const cleanNum = dropoffNumber.trim();
    const isSabaia = (cleanStreet === "rua sabia da praia" || cleanStreet === "sabia da praia") && cleanNum === "855";
    const isTicoTico = (cleanStreet === "rua tico tico rei" || cleanStreet === "tico tico rei") && cleanNum === "840";
    return isSabaia || isTicoTico;
  }, [dropoffStreet, dropoffNumber]);

  const isAutoDetectedMonteRey = useMemo(() => {
    const cleanStreet = dropoffStreet.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const cleanNum = dropoffNumber.trim().replace(/\./g, "");
    const monteReyStreets = ["bieja flor verde e branco", "beija flor verde e branco", "tapicuru preto", "bem te vi pirata", "formigueiro bico longo", "sabia norte americano", "bacurau pigmeu", "rolinha comum", "jandaia de testa vermelha", "choca de coroa preta", "barbudinho", "coruja de carapaca", "falso mutum", "barbudo de coroa escarlate", "batuira de bico torto", "papa formiga de escamas", "curiango comum", "japim xexeu", "soco pintado", "lavadeira preta e branca", "macarico grande de perna amarela", "gaturamo alcaide", "frango dagua azul", "papa taoca do sul", "pula pula assobiador", "dancarino perereca", "formigueiro de dorso ruivo", "choca bate rabo", "balanca rabo canela", "andorinha ribeirinha"];
    const isInList = monteReyStreets.some(s => cleanStreet.includes(s));
    const isTicoTicoCampo = (cleanStreet.includes("tico tico do campo")) && cleanNum === "1711";
    return isInList || isTicoTicoCampo;
  }, [dropoffStreet, dropoffNumber]);

  useEffect(() => {
    if (isAutoDetectedGoldem && userProfile?.condoRateGoldemItalian) {
      if (selectedRateId !== 'rate-condo-gi') {
        setSelectedRateId('rate-condo-gi');
        toast({ title: "Condomínio Detectado", description: "Taxa Cond. Goldem / Italian Ville aplicada automaticamente." });
      }
    } else if (isAutoDetectedMonteRey && userProfile?.condoRateMonteRey) {
      if (selectedRateId !== 'rate-condo-mr') {
        setSelectedRateId('rate-condo-mr');
        toast({ title: "Condomínio Detectado", description: "Taxa Cond. Monte Rey / Bem Viver aplicada automaticamente." });
      }
    }
  }, [isAutoDetectedGoldem, isAutoDetectedMonteRey, userProfile, selectedRateId, toast]);

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blockStatus.isBlocked) {
        toast({ variant: "destructive", title: "Conta Bloqueada", description: "Você possui pendências vencidas. Regularize seu saldo." });
        return;
    }
    if (!user || !userProfile || !firestore) return;
    if (selectedPrice === null || paymentMethod === null) {
        toast({ variant: "destructive", title: "Campos Incompletos", description: "Selecione a taxa e o método de pagamento." });
        return;
    }

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const pickup_street = formData.get("pickup_street") as string;
    const pickup_number = formData.get("pickup_number") as string;
    const pickup_neighborhood = formData.get("pickup_neighborhood") as string;
    const observations = formData.get("observations") as string;
    const dropoff_neighborhood = formData.get("dropoff_neighborhood") as string;

    let pickup = pickup_street ? `${pickup_street}, ${pickup_number} - ${pickup_neighborhood}` : (userProfile.address || 'Endereço da Loja');
    const dropoff = `${dropoffStreet}, ${dropoffNumber} - ${dropoff_neighborhood}`;

    const newDelivery = {
      pickup,
      dropoff,
      price: selectedPrice,
      status: "pending" as const,
      clientId: user.uid,
      createdAt: serverTimestamp(),
      observations: observations || "",
      paidByClient: paymentMethod === 'collect', 
      paymentMethod: paymentMethod
    };

    try {
      const docRef = await addDoc(collection(firestore, "deliveries"), newDelivery);
      
      const adminSnap = await getDocs(query(collection(firestore, 'users'), where('role', '==', 'admin'), limit(1)));
      const adminData = adminSnap.docs[0]?.data();
      
      if (adminData?.pushSubscription) {
        await sendPushNotification(adminData.pushSubscription, {
          title: 'Lucas Expresso',
          body: `📦 Novo Pedido: ${userProfile.displayName} solicitou entrega para ${dropoff}.`,
          url: '/admin'
        });
      }

      toast({ title: "Pedido Enviado!" });
      router.push("/client");
    } catch (serverError: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'deliveries', operation: 'create', requestResourceData: newDelivery }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (blockStatus.isBlocked) {
    return (
        <div className="flex flex-col h-full bg-background items-center justify-center p-8 text-center outline-none">
            <div className="size-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6"><AlertCircle className="size-12 text-destructive" /></div>
            <h2 className="text-2xl font-black font-headline">Acesso Bloqueado</h2>
            <p className="text-muted-foreground mt-4">Regularize sua pendência de {blockStatus.debtAmount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para voltar a solicitar entregas.</p>
            <Button asChild className="w-full mt-8 py-7 rounded-2xl font-bold shadow-xl"><Link href="/client/finance">Ir para Pagamento</Link></Button>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background outline-none">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 py-4 border-b flex items-center justify-between">
        <Button variant="ghost" size="icon" asChild><Link href="/client"><ArrowLeft /></Link></Button>
        <h1 className="text-lg font-semibold tracking-tight font-headline">Nova Entrega</h1>
        <Avatar className="size-8 border border-primary/30">
          {userProfile?.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName || ''} />}
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">{userProfile?.displayName?.charAt(0) || 'C'}</AvatarFallback>
        </Avatar>
      </header>

      <main className="flex-1 overflow-y-auto pb-32 outline-none">
        <form onSubmit={handleRequest} className="px-4 py-6 space-y-8 max-w-md mx-auto">
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest font-headline">1. Tipo de Entrega</h2>
              {(isAutoDetectedGoldem || isAutoDetectedMonteRey) && <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse"><ShieldAlert className="size-3" /> TAXA OBRIGATÓRIA</div>}
            </div>
            <RadioGroup value={selectedRateId || ""} onValueChange={(val) => !isAutoDetectedGoldem && !isAutoDetectedMonteRey && setSelectedRateId(val)} className="grid gap-3">
                {rates.map((rate) => {
                    const isSelected = selectedRateId === rate.id;
                    const isDisabled = (isAutoDetectedGoldem || isAutoDetectedMonteRey) && !isSelected;
                    return (
                      <div key={rate.id} className="relative">
                          <RadioGroupItem value={rate.id} id={rate.id} className="sr-only" disabled={isDisabled} />
                          <Label htmlFor={rate.id} className={cn("flex flex-col p-4 rounded-2xl border-2 transition-all relative overflow-hidden", isSelected ? "border-primary bg-primary/5 shadow-md" : (isDisabled ? "opacity-40 cursor-not-allowed border-muted bg-muted/10" : "border-muted bg-card hover:bg-muted/30 cursor-pointer"))}>
                              <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-sm flex items-center gap-2"><MapPin className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")} /> {rate.label}</span>
                                  <span className="text-base font-black text-primary">{rate.value!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-medium">{rate.description}</span>
                              {isSelected && <CheckCircle2 className="absolute -right-1 -bottom-1 size-8 text-primary opacity-10" />}
                          </Label>
                      </div>
                    );
                })}
            </RadioGroup>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 font-headline">2. Opção de Pagamento</h2>
            <RadioGroup value={paymentMethod || ""} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-2 gap-3">
                {[
                    { id: 'pay-credit', value: 'credit', label: 'Crediário', desc: 'Cobrança semanal', icon: CreditCard, color: 'bg-primary' },
                    { id: 'pay-collect', value: 'collect', label: 'Receber', desc: 'Dinheiro ou Pix', icon: Banknote, color: 'bg-emerald-500' }
                ].map(opt => (
                    <div key={opt.id} className="relative">
                        <RadioGroupItem value={opt.value} id={opt.id} className="sr-only" />
                        <Label htmlFor={opt.id} className={cn("flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all cursor-pointer", paymentMethod === opt.value ? "border-primary bg-primary/5 shadow-sm" : "border-muted bg-card")}>
                            <div className={cn("size-12 rounded-2xl flex items-center justify-center text-white mb-2 shadow-lg", paymentMethod === opt.value ? opt.color : "bg-muted text-muted-foreground")}>
                                <opt.icon className="size-6" />
                            </div>
                            <p className="font-bold text-sm leading-tight">{opt.label}</p>
                            <p className="text-[9px] text-muted-foreground font-medium mt-1 leading-tight">{opt.desc}</p>
                        </Label>
                    </div>
                ))}
            </RadioGroup>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 font-headline">3. Coleta (Opcional)</h2>
            <Card className="p-5 rounded-2xl border-none shadow-sm bg-muted/30 space-y-4">
                <p className="text-[10px] text-muted-foreground italic">Deixe em branco para usar o endereço cadastrado da sua loja.</p>
                <div className="space-y-1.5">
                  <Label htmlFor="pickup_street" className="text-xs font-bold text-muted-foreground ml-1">Rua de Coleta</Label>
                  <Input id="pickup_street" name="pickup_street" placeholder="Rua da loja ou outro local" className="h-12 rounded-xl bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label htmlFor="pickup_number" className="text-xs font-bold text-muted-foreground ml-1">Número</Label><Input id="pickup_number" name="pickup_number" placeholder="Ex: 123" className="h-12 rounded-xl bg-background" /></div>
                  <div className="space-y-1.5"><Label htmlFor="pickup_neighborhood" className="text-xs font-bold text-muted-foreground ml-1">Bairro</Label><Input id="pickup_neighborhood" name="pickup_neighborhood" placeholder="Centro" className="h-12 rounded-xl bg-background" /></div>
                </div>
            </Card>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 font-headline">4. Destino</h2>
            <Card className="p-5 rounded-2xl border-none shadow-sm bg-muted/30 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dropoff_street" className="text-xs font-bold text-muted-foreground ml-1">Rua</Label>
                  <Input id="dropoff_street" name="dropoff_street" placeholder="Apenas letras" className="h-12 rounded-xl bg-background" required value={dropoffStreet} onChange={(e) => setDropoffStreet(e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, ""))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label htmlFor="dropoff_number" className="text-xs font-bold text-muted-foreground ml-1">Número</Label><Input id="dropoff_number" name="dropoff_number" placeholder="Ex: 123" className="h-12 rounded-xl bg-background" required value={dropoffNumber} onChange={(e) => setDropoffNumber(e.target.value)}/></div>
                  <div className="space-y-1.5"><Label htmlFor="dropoff_neighborhood" className="text-xs font-bold text-muted-foreground ml-1">Bairro</Label><Input id="dropoff_neighborhood" name="dropoff_neighborhood" placeholder="Centro" className="h-12 rounded-xl bg-background" required/></div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="observations" className="text-xs font-bold text-muted-foreground ml-1">Obs (Apto, Bloco)</Label><Textarea id="observations" name="observations" placeholder="Ex: Deixar na portaria..." className="rounded-xl bg-background min-h-[80px] resize-none" /></div>
            </Card>
          </section>

          <Button type="submit" disabled={isSubmitting || userLoading || selectedPrice === null || paymentMethod === null} className="w-full h-16 text-lg font-black rounded-2xl shadow-xl active:scale-95 transition-all">
            {isSubmitting ? <Loader2 className="animate-spin size-6" /> : <>SOLICITAR ENTREGA <ArrowRight className="size-6 ml-3" /></>}
          </Button>
        </form>
      </main>
    </div>
  );
}
