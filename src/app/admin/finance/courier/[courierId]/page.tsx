
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Banknote, Wallet, CreditCard, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, collection, query, where, orderBy, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { UserProfile, Delivery } from '@/lib/types';
import { format, startOfWeek, addDays, subDays, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { FinanceGuard } from "@/components/FinanceGuard";
import { cn } from '@/lib/utils';

export default function CourierFinanceDetailsPage() {
  const params = useParams();
  const courierId = params.courierId as string;
  const { userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPaying, setIsPaying] = useState(false);

  const { weekStart, weekEnd } = useMemo(() => {
    const day = getDay(currentDate);
    const reference = day === 0 ? subDays(currentDate, 1) : currentDate;
    const start = startOfWeek(reference, { weekStartsOn: 1 });
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, 5);
    end.setHours(23, 59, 59, 999);
    return { weekStart: start, weekEnd: end };
  }, [currentDate]);

  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [loading, setLoading] = useState(true);

  const courierRef = useMemo(() => firestore && courierId ? doc(firestore, 'users', courierId) : null, [firestore, courierId]);
  const { data: courier, loading: courierLoading } = useDoc<UserProfile>(courierRef);

  const fetchDeliveries = async () => {
    if (!firestore || !courierId) return;
    setLoading(true);
    const q = query(collection(firestore, 'deliveries'), where('courierId', '==', courierId), where('status', '==', 'finished'), where('createdAt', '>=', weekStart), where('createdAt', '<=', weekEnd), orderBy('createdAt', 'desc'));
    getDocs(q).then(snap => setDeliveries(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery)))).finally(() => setLoading(false));
  };

  useEffect(() => { fetchDeliveries(); }, [firestore, courierId, weekStart, weekEnd]);

  const stats = useMemo(() => {
    if (!deliveries || !courier) return { totalEarned: 0, receivedInCash: 0, finalBalance: 0, unpaidDeliveries: [] };
    const rate = courier.deliveryRate || 6;
    const unpaid = deliveries.filter(d => !d.paid);
    
    return deliveries.reduce((acc, d) => {
        acc.totalEarned += rate;
        if (d.paymentMethod === 'cash') acc.receivedInCash += d.price;
        return acc;
    }, { totalEarned: 0, receivedInCash: 0, finalBalance: 0, unpaidDeliveries: unpaid });
  }, [deliveries, courier]);

  const finalBalance = stats.totalEarned - stats.receivedInCash;

  const handlePay = async () => {
    if (!firestore || stats.unpaidDeliveries.length === 0) return;
    setIsPaying(true);
    const batch = writeBatch(firestore);
    stats.unpaidDeliveries.forEach(d => batch.update(doc(firestore, 'deliveries', d.id), { paid: true }));
    batch.set(doc(collection(firestore, 'notifications')), { userId: courierId, title: 'Pagamento Realizado!', description: 'Seu repasse semanal foi processado.', createdAt: serverTimestamp(), read: false, icon: 'wallet' });
    batch.commit().then(() => { toast({ title: "Pagamento Confirmado!" }); fetchDeliveries(); }).finally(() => setIsPaying(false));
  };

  const isLoading = userLoading || courierLoading || loading;

  return (
    <FinanceGuard>
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b">
        <div className="flex items-center justify-between mb-4"><Button variant="ghost" size="icon" asChild><Link href="/admin/finance/weekly-payouts"><ArrowLeft /></Link></Button><h1 className="text-lg font-bold font-headline">Extrato de Repasse</h1><div className="size-10"/></div>
        <div className="flex items-center gap-4">
            {isLoading ? <Skeleton className="size-14 rounded-xl" /> : <Avatar className="size-14 rounded-xl border-2 border-primary/10"><AvatarImage src={courier?.photoURL || ''} /><AvatarFallback className="font-black text-xl">{courier?.displayName?.charAt(0)}</AvatarFallback></Avatar>}
            <div>{isLoading ? <Skeleton className="h-6 w-40" /> : <h2 className="text-lg font-bold">{courier?.displayName}</h2>}<p className="text-[10px] uppercase font-bold text-muted-foreground">{courier?.userType || 'Entregador'}</p></div>
        </div>
      </header>

      <main className="flex-1 p-4 pb-48 overflow-y-auto">
        <section className="mb-6"><Card className="p-3 bg-muted/50 border flex items-center justify-between"><Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="size-5" /></Button><div className="text-center"><p className="text-sm font-bold">{format(weekStart, "dd/MM")} - {format(weekEnd, "dd/MM")}</p><p className="text-[10px] uppercase font-black text-primary tracking-widest leading-none mt-0.5">Ciclo Semanal Seg-Sáb</p></div><Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="size-5" /></Button></Card></section>

        <section className={cn("p-6 rounded-3xl text-white shadow-xl relative overflow-hidden mb-6", finalBalance >= 0 ? "bg-primary" : "bg-destructive")}>
            <div className="absolute top-0 right-0 opacity-10"><Wallet size={120} /></div>
            <p className="text-xs font-black uppercase tracking-widest opacity-80">{finalBalance >= 0 ? "Saldo a Pagar ao Motoboy" : "Saldo a Receber do Motoboy"}</p>
            <h2 className="text-4xl font-black mt-1 font-headline">{Math.abs(finalBalance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
            <div className="mt-4 flex gap-4 text-[10px] font-bold uppercase tracking-tighter">
                <div className="bg-white/20 px-2 py-1 rounded">Ganhos: {stats.totalEarned.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
                <div className="bg-black/20 px-2 py-1 rounded">Em mãos: {stats.receivedInCash.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
            </div>
        </section>

        <section className="space-y-3">
            <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest px-1">Registros da Semana</h3>
            {deliveries?.map(d => (
                <Card key={d.id} className={cn("p-4 rounded-xl border-l-4", d.paid ? "border-l-emerald-500" : "border-l-amber-500")}>
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-bold text-sm">Entrega: {d.paymentMethod === 'cash' ? 'DINHEIRO' : d.paymentMethod === 'pix' ? 'PIX' : 'CREDIÁRIO'}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">{format(d.createdAt.toDate(), "dd/MM HH:mm")}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-primary">Repasse: {(courier?.deliveryRate || 6).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                            {d.paymentMethod === 'cash' && <p className="text-[10px] font-bold text-destructive">Motoboy Coletou: {d.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>}
                        </div>
                    </div>
                </Card>
            ))}
        </section>

        {finalBalance > 0 && stats.unpaidDeliveries.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent pb-8 z-40 max-w-md mx-auto">
                <Button className="w-full py-7 rounded-2xl text-base font-bold shadow-2xl shadow-primary/30 gap-2" onClick={handlePay} disabled={isPaying}>
                    {isPaying ? <Loader2 className="animate-spin" /> : <Wallet className="size-5" />}
                    Confirmar Pagamento ({finalBalance.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})})
                </Button>
            </div>
        )}
      </main>
    </FinanceGuard>
  );
}
