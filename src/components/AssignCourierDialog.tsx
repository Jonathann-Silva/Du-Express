'use client';

import { useState, useMemo } from 'react';
import { Bike, Wallet, Circle } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Delivery, UserProfile } from '@/lib/types';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { doc, writeBatch, collection, serverTimestamp, query, where } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendPushNotification } from '@/services/push-notification';


export function AssignCourierDialog({ delivery, onAssign, onCancel }: { delivery: Delivery, onAssign: () => void, onCancel: () => void }) {
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { userProfile } = useUser();

  const couriersQuery = useMemo(() => {
      if (!firestore || !userProfile || userProfile.role !== 'admin') return null;
      return query(
          collection(firestore, 'users'),
          where('role', '==', 'courier')
      );
  }, [firestore, userProfile?.uid, userProfile?.role]);

  const { data: couriers, loading: loadingCouriers } = useCollection<UserProfile>(couriersQuery);

  const sortedCouriers = useMemo(() => {
    if (!couriers) return [];
    return [...couriers].sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
    });
  }, [couriers]);

  const handleAssign = async () => {
      if(!selectedCourierId || !firestore || !couriers) return;
      
      const selectedCourier = couriers.find(c => c.uid === selectedCourierId);
      if (!selectedCourier) return;

      setIsAssigning(true);
      
      const deliveryRef = doc(firestore, 'deliveries', delivery.id);
      const batch = writeBatch(firestore);

      batch.update(deliveryRef, {
          courierId: selectedCourierId,
          status: 'accepted',
          acceptedAt: serverTimestamp()
      });
      
      const clientNotifRef = doc(collection(firestore, 'notifications'));
      batch.set(clientNotifRef, {
          userId: delivery.clientId,
          title: "Entrega aceita!",
          description: `${selectedCourier.displayName} está a caminho para retirar seu pedido.`,
          createdAt: serverTimestamp(),
          read: false,
          icon: 'package',
          link: '/client'
      });
      
      const courierNotifRef = doc(collection(firestore, 'notifications'));
      batch.set(courierNotifRef, {
          userId: selectedCourierId,
          title: "Nova entrega para você!",
          description: `Vá até ${delivery.pickup} para retirar um novo pedido.`,
          createdAt: serverTimestamp(),
          read: false,
          icon: 'package',
          link: '/courier'
      });
      
      try {
        await batch.commit();

        if (selectedCourier.pushSubscription) {
          await sendPushNotification(selectedCourier.pushSubscription, {
            title: 'Lucas Expresso',
            body: `🚀 Nova Entrega: Você foi escalado para coletar em ${delivery.pickup}.`,
            url: '/courier'
          });
        }

        toast({
            title: 'Entrega Atribuída!',
            description: `${selectedCourier.displayName} foi avisado.`
        });
        onAssign();
      } catch (serverError) {
        const permissionError = new FirestorePermissionError({
          path: deliveryRef.path,
          operation: 'update',
          requestResourceData: {
            courierId: selectedCourierId,
            status: 'accepted',
          },
        });
        errorEmitter.emit('permission-error', permissionError);
      } finally {
        setIsAssigning(false);
      }
  }

  const selectedCourierName = couriers?.find(c => c.uid === selectedCourierId)?.displayName?.split(' ')[0] || '';

  return (
    <>
      <div className="py-4 min-h-[20rem] flex flex-col justify-center">
        {loadingCouriers && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        )}
        {!loadingCouriers && (!couriers || couriers.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
             <div className="size-12 bg-muted rounded-full flex items-center justify-center">
                <Bike className="size-6 text-muted-foreground" />
             </div>
            <p className="font-semibold">Nenhum entregador cadastrado</p>
            <p className="text-muted-foreground text-xs">Vá em 'Usuários' para adicionar entregadores.</p>
          </div>
        )}
        {!loadingCouriers && sortedCouriers.length > 0 && (
          <ScrollArea className="h-80">
            <RadioGroup value={selectedCourierId || ''} onValueChange={setSelectedCourierId} className="space-y-2 pr-4">
              {sortedCouriers.map(courier => (
                <Label
                  key={courier.uid}
                  htmlFor={courier.uid}
                  className={cn(
                    "p-4 rounded-xl border bg-card flex items-center gap-4 cursor-pointer transition-all",
                    selectedCourierId === courier.uid ? "border-primary ring-2 ring-primary" : "hover:bg-muted/50"
                  )}
                >
                  <div className="relative">
                    <Avatar className="size-12 rounded-lg">
                        {courier.photoURL && <AvatarImage src={courier.photoURL} alt={courier.displayName || 'courier'} />}
                        <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{courier.displayName?.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className={cn(
                        "absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-background",
                        courier.status === 'online' ? "bg-green-500" : "bg-slate-400"
                    )} />
                  </div>
                  <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base">{courier.displayName}</h3>
                        {courier.status === 'online' && <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter bg-green-100 px-1.5 py-0.5 rounded">Online</span>}
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground text-xs mt-1">
                          <span className="flex items-center gap-1.5">
                            <Wallet className="size-3.5"/> 
                            {courier.deliveryRate ? courier.deliveryRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Taxa Padrão'}
                          </span>
                      </div>
                  </div>
                  <RadioGroupItem value={courier.uid} id={courier.uid} />
                </Label>
              ))}
            </RadioGroup>
          </ScrollArea>
        )}
      </div>
      <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={isAssigning || !selectedCourierId}>
              {isAssigning ? 'Atribuindo...' : `Confirmar ${selectedCourierName}`}
          </Button>
    </div>
    </>
  );
}
