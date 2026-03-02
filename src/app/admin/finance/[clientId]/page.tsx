
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2, CheckCircle, XCircle, ChevronLeft, ChevronRight, AlertCircle, Banknote, CreditCard, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { UserProfile, Delivery } from '@/lib/types';
import { format, startOfWeek, addDays, subDays, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { FinanceGuard } from "@/components/FinanceGuard";
import { cn } from '@/lib/utils';

const paymentIconMap = {
    credit: <CreditCard className="size-3 text-primary" />,
    pix: <Smartphone className="size-3 text-[#32BCAD]" />,
    cash: <Banknote className="size-3 text-emerald-500" />
};

export default function ClientFinanceDetailsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const clientRef = useMemo(() => firestore && clientId ? doc(firestore, 'users', clientId) : null, [firestore, clientId]);
  const { data: client, loading: clientLoading } = useDoc<UserProfile>(clientRef);

  useEffect(() => {
    if (!firestore || !clientId) return;
    setLoading(true);
    const q = query(collection(firestore, 'deliveries'), where('clientId', '==', clientId), where('createdAt', '>=', weekStart), where('createdAt', '<=', weekEnd), orderBy('createdAt', 'desc'));
    getDocs(q).then(snap => setDeliveries(snapshotToDeliveries(snap))).finally(() => setLoading(false));
  }, [firestore, clientId, weekStart, weekEnd]);

  const snapshotToDeliveries = (snap: any) => snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery));

  const stats = useMemo(() => {
    if (!deliveries) return { totalWeek: 0, debtClient: 0, paidInPerson: 0 };
    return deliveries.reduce((acc, d) => {
        if (d.status === 'finished') {
            acc.totalWeek += d.price;
            if (d.paymentMethod === 'credit' && !d.paidByClient) {
                acc.debtClient += d.price;
            } else if (d.paymentMethod !== 'credit') {
                acc.paidInPerson += d.price;
            }
        }
        return acc;
    }, { totalWeek: 0, debtClient: 0, paidInPerson: 0 });
  }, [deliveries]);

  const handleExportToExcel = () => {
    if (!deliveries?.length) return;
    const data = deliveries.map(d => ({
        'Data': format(d.createdAt.toDate(), 'dd/MM/yyyy HH:mm'),
        'Destino': d.dropoff,
        'Valor': d.price,
        'Pagamento': d.paymentMethod === 'credit' ? 'Crediário' : d.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro',
        'Status Loja': d.paidByClient ? 'Pago' : 'Pendente'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faturamento");
    XLSX.writeFile(wb, `Faturamento_${client?.displayName || 'Loja'}.xlsx`);
  };

  const isLoading = userLoading || clientLoading || loading;

  return (
    <FinanceGuard>
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" asChild><Link href="/admin/finance"><ArrowLeft /></Link></Button>
          <h1 className="text-lg font-bold font-headline">Extrato da Loja</h1>
          <Button variant="outline" size="sm" onClick={handleExportToExcel} disabled={!deliveries?.length} className="font-bold gap-2"><Download className="size-4" /> Excel</Button>
        </div>
        <div className="flex items-center gap-4">
            {isLoading ? <Skeleton className="size-14 rounded-xl" /> : <Avatar className="size-14 rounded-xl border-2 border-primary/10"><AvatarImage src={client?.photoURL || ''} /><AvatarFallback className="bg-muted text-muted-foreground font-black">{client?.displayName?.charAt(0)}</AvatarFallback></Avatar>}
            <div>{isLoading ? <Skeleton className="h-6 w-40" /> : <h2 className="text-lg font-bold">{client?.displayName}</h2>}<p className="text-[10px] uppercase font-bold text-muted-foreground">Logística Local Arapongas</p></div>
        </div>
      </header>

      <main className="flex-1 p-4 pb-48">
        <section className="mb-6"><Card className="p-3 bg-muted/50 border flex items-center justify-between"><Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="size-5" /></Button><div className="text-center"><p className="text-sm font-bold">{format(weekStart, "dd/MM")} - {format(weekEnd, "dd/MM")}</p><p className="text-[10px] uppercase font-black text-primary tracking-widest leading-none mt-0.5">Semana Selecionada</p></div><Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="size-5" /></Button></Card></section>

        <section className="grid grid-cols-2 gap-3 mb-6">
            <Card className="p-4 bg-amber-500/10 border-amber-500/20">
                <p className="text-[10px] font-black uppercase text-amber-600">A Receber (Crediário)</p>
                <p className="text-xl font-black text-amber-500">{stats.debtClient.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </Card>
            <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
                <p className="text-[10px] font-black uppercase text-emerald-600">Recebido (Pix/Dinheiro)</p>
                <p className="text-xl font-black text-emerald-500">{stats.paidInPerson.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </Card>
        </section>

        <section className="space-y-3">
            <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest px-1">Registros da Semana</h3>
            {isLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : deliveries?.map(d => (
                <Card key={d.id} className={cn("p-4 rounded-xl border-l-4", d.paidByClient ? "border-l-emerald-500" : "border-l-amber-500")}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center">{paymentIconMap[d.paymentMethod]}</div>
                            <div>
                                <p className="font-bold text-sm truncate max-w-[150px]">{d.dropoff}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-muted-foreground">{format(d.createdAt.toDate(), "dd MMM, HH:mm", { locale: ptBR })}</span>
                                    <span className={cn("text-[8px] font-black uppercase px-1 rounded", d.paidByClient ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{d.paidByClient ? 'Liquidado' : 'Em Aberto'}</span>
                                </div>
                            </div>
                        </div>
                        <p className="font-black text-base">{d.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </Card>
            ))}
        </section>
      </main>
    </FinanceGuard>
  );
}
