
'use client';

import { useState, useMemo } from 'react';
import { 
  Building, 
  Bike, 
  MapPin, 
  CircleDot, 
  DollarSign, 
  Info, 
  Loader2, 
  Plus, 
  X,
  User,
  CreditCard,
  Banknote
} from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { UserProfile, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DialogTitle } from '@/components/ui/dialog';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface AdminCreateDeliveryDialogProps {
  onClose: () => void;
}

export function AdminCreateDeliveryDialog({ onClose }: AdminCreateDeliveryDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States do Formulário
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedCourierId, setSelectedCourierId] = useState<string>('none');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [price, setPrice] = useState<string>('');
  const [observations, setObservations] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');

  // Busca Clientes e Entregadores
  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'client'));
  }, [firestore]);

  const couriersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'courier'));
  }, [firestore]);

  const { data: clients, loading: loadingClients } = useCollection<UserProfile>(clientsQuery);
  const { data: couriers, loading: loadingCouriers } = useCollection<UserProfile>(couriersQuery);

  // Atualiza endereço e preço sugerido ao mudar cliente
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients?.find(c => c.uid === clientId);
    if (client) {
      setPickup(client.address || '');
      setPrice(client.deliveryRate?.toString() || '');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !selectedClientId || !pickup || !dropoff || !price) {
      toast({ 
        title: "Campos obrigatórios", 
        description: "Verifique cliente, endereços e valor.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);

    const isAssigned = selectedCourierId !== 'none';
    
    const deliveryData = {
      clientId: selectedClientId,
      courierId: isAssigned ? selectedCourierId : null,
      pickup,
      dropoff,
      price: parseFloat(price),
      observations,
      status: isAssigned ? 'accepted' : 'pending',
      createdAt: serverTimestamp(),
      paid: false,
      paidByClient: paymentMethod === 'collect',
      paymentMethod: paymentMethod
    };

    const deliveriesRef = collection(firestore, 'deliveries');
    const notificationsRef = collection(firestore, 'notifications');

    addDoc(deliveriesRef, deliveryData)
      .then(() => {
        toast({ title: "Entrega Lançada com Sucesso!" });
        
        // Notificação Cliente
        addDoc(notificationsRef, {
          userId: selectedClientId,
          title: isAssigned ? 'Pedido Aceito!' : 'Pedido Lançado!',
          description: isAssigned 
            ? 'Um entregador já foi atribuído ao seu pedido criado pela central.' 
            : 'Seu pedido foi lançado pela central e aguarda um entregador.',
          createdAt: serverTimestamp(),
          read: false,
          icon: 'package',
          link: '/client'
        });

        // Notificação Entregador (se atribuído)
        if (isAssigned) {
          addDoc(notificationsRef, {
            userId: selectedCourierId,
            title: 'Nova Entrega Atribuída!',
            description: `A central te escalou para uma entrega em ${dropoff}.`,
            createdAt: serverTimestamp(),
            read: false,
            icon: 'package',
            link: '/courier'
          });
        }
        
        onClose();
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: 'deliveries',
          operation: 'create',
          requestResourceData: deliveryData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div className="flex flex-col h-full max-h-[90dvh] bg-background">
      <header className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-2 text-primary">
          <Plus className="size-5" />
          <DialogTitle className="text-lg font-bold font-headline">Nova Entrega Central</DialogTitle>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <form onSubmit={handleCreate} className="p-6 space-y-6">
          
          {/* Seleção do Cliente */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <Building className="size-3.5" /> Cliente (Loja)
            </Label>
            <Select value={selectedClientId} onValueChange={handleClientChange}>
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder={loadingClients ? "Carregando clientes..." : "Selecione o Cliente"} />
              </SelectTrigger>
              <SelectContent>
                {clients?.map(client => (
                  <SelectItem key={client.uid} value={client.uid}>
                    {client.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              Forma de Pagamento
            </Label>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-2 gap-3">
                <Label htmlFor="admin-pay-credit" className={cn(
                    "flex items-center justify-center p-3 rounded-xl border transition-all cursor-pointer text-xs",
                    paymentMethod === 'credit' ? "border-primary bg-primary/5 font-bold" : "border-border bg-muted/30"
                )}>
                    <RadioGroupItem value="credit" id="admin-pay-credit" className="sr-only" />
                    <CreditCard className="size-3.5 mr-2" /> Crediário
                </Label>
                <Label htmlFor="admin-pay-collect" className={cn(
                    "flex items-center justify-center p-3 rounded-xl border transition-all cursor-pointer text-xs",
                    paymentMethod === 'collect' ? "border-primary bg-primary/5 font-bold" : "border-border bg-muted/30"
                )}>
                    <RadioGroupItem value="collect" id="admin-pay-collect" className="sr-only" />
                    <Banknote className="size-3.5 mr-2" /> Receber
                </Label>
            </RadioGroup>
          </div>

          {/* Endereços */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <CircleDot className="size-3.5 text-primary" /> Endereço de Coleta
              </Label>
              <Input 
                placeholder="Rua, Número - Bairro" 
                value={pickup} 
                onChange={e => setPickup(e.target.value)} 
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <MapPin className="size-3.5 text-red-500" /> Endereço de Entrega
              </Label>
              <Input 
                placeholder="Destino final" 
                value={dropoff} 
                onChange={e => setDropoff(e.target.value)} 
                className="h-12 rounded-xl"
              />
            </div>
          </div>

          {/* Preço e Atribuição */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <DollarSign className="size-3.5" /> Valor (R$)
              </Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                className="h-12 rounded-xl font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Bike className="size-3.5" /> Motoboy
              </Label>
              <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aguardar (Pendente)</SelectItem>
                  {couriers?.map(courier => (
                    <SelectItem key={courier.uid} value={courier.uid}>
                      {courier.displayName} {courier.status === 'online' ? '🟢' : '⚪'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <Info className="size-3.5" /> Observações
            </Label>
            <Textarea 
              placeholder="Ex: Bloco 2, Apto 401..." 
              value={observations} 
              onChange={e => setObservations(e.target.value)}
              className="rounded-xl min-h-[80px]"
            />
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || !selectedClientId || loadingClients}
            className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20 transition-all active:scale-95"
          >
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Plus className="size-5 mr-2" />}
            CRIAR ENTREGA AGORA
          </Button>
        </form>
      </ScrollArea>
    </div>
  );
}
