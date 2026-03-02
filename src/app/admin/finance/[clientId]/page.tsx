
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2, CheckCircle, XCircle, ChevronLeft, ChevronRight, AlertCircle, Banknote } from 'lucide-react';
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

const statusMap: Record<Delivery['status'], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: 'text-amber-500', icon: <Loader2 className="size-5 animate-spin text-amber-500" /> },
  accepted: { label: 'Aceito', color: 'text-blue-500', icon: <Loader2 className="size-5 animate-spin text-blue-500" /> },
  'in-progress': { label: 'Em Trânsito', color: 'text-emerald-500', icon: <Loader2 className="size-5 animate-spin text-emerald-500" /> },
  finished: { label: 'Finalizado', color: 'text-green-500', icon: <CheckCircle className="size-5 text-green-500" /> },
  refused: { label: 'Recusado', color: 'text-red-500', icon: <XCircle className="size-5 text-red-500" /> },
};

const statusBgMap: Record<Delivery['status'], string> = {
    pending: 'bg-amber-500/10',
    accepted: 'bg-blue-500/10',
    'in-progress': 'bg-emerald-500/10',
    finished: 'bg-green-500/10',
    refused: 'bg-red-500/10',
};


export default function ClientFinanceDetailsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());

  const { weekStart, weekEnd } = useMemo(() => {
    const dateForWeekCalc = getDay(currentDate) === 0 ? subDays(currentDate, 1) : currentDate;
    const start = startOfWeek(dateForWeekCalc, { weekStartsOn: 1 });
    const end = addDays(start, 5);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { weekStart: start, weekEnd: end };
  }, [currentDate]);

  const clientRef = useMemo(() => {
    if (!firestore || !clientId || !userProfile || userProfile.role !== 'admin') return null;
    return doc(firestore, 'users', clientId);
  }, [firestore, clientId, userProfile]);

  const deliveriesQuery = useMemo(() => {
    if (!firestore || !clientId || !userProfile || userProfile.role !== 'admin') return null;
    return query(
        collection(firestore, 'deliveries'), 
        where('clientId', '==', clientId),
        where('createdAt', '>=', weekStart),
        where('createdAt', '<=', weekEnd),
        orderBy('createdAt', 'asc')
    );
  }, [firestore, clientId, userProfile, weekStart, weekEnd]);

  const { data: client, loading: clientLoading } = useDoc<UserProfile>(clientRef);

  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);

  useEffect(() => {
    if (deliveriesQuery) {
        setDeliveriesLoading(true);
        getDocs(deliveriesQuery)
            .then(snapshot => {
                const deliveriesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery));
                setDeliveries(deliveriesData);
            })
            .catch(console.error)
            .finally(() => setDeliveriesLoading(false));
    } else {
        setDeliveries([]);
        setDeliveriesLoading(false);
    }
  }, [deliveriesQuery]);

  const sortedDeliveries = useMemo(() => {
    if (!deliveries) return [];
    return [...deliveries].sort((a, b) => (b.createdAt as Timestamp).toDate().getTime() - (a.createdAt as Timestamp).toDate().getTime());
  }, [deliveries]);

  const { totalPending, totalReceived, totalFinished, totalUnpaidByClient } = useMemo(() => {
    if (!deliveries) return { totalPending: 0, totalReceived: 0, totalFinished: 0, totalUnpaidByClient: 0 };
    return deliveries.reduce((acc, delivery) => {
      if (delivery.status === 'finished') {
        acc.totalReceived += delivery.price;
        acc.totalFinished += 1;
        if (!delivery.paidByClient) {
            acc.totalUnpaidByClient += delivery.price;
        }
      } else if (delivery.status === 'pending' || delivery.status === 'accepted' || delivery.status === 'in-progress') {
        acc.totalPending += delivery.price;
      }
      return acc;
    }, { totalPending: 0, totalReceived: 0, totalFinished: 0, totalUnpaidByClient: 0 });
  }, [deliveries]);

  const isLoading = userLoading || clientLoading || deliveriesLoading;

  const handleNextWeek = () => {
    setCurrentDate(current => addDays(current, 7));
  };

  const handlePrevWeek = () => {
    setCurrentDate(current => subDays(current, 7));
  };

  const handleExportToExcel = () => {
    if (!deliveries || deliveries.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há entregas registradas nesta semana para esta loja.",
        variant: "destructive"
      });
      return;
    }

    const exportData = deliveries.map((d, index) => ({
      'Nº Pedido': `Pedido ${(index + 1).toString().padStart(3, '0')}`,
      'Dia da Entrega': format((d.createdAt as Timestamp).toDate(), 'dd/MM/yyyy HH:mm'),
      'Nome da Loja': client?.displayName || 'N/A',
      'Local da Entrega': d.dropoff,
      'Valor': d.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      'Status': statusMap[d.status]?.label || d.status,
      'Pago pela Loja?': d.paidByClient ? 'Sim' : 'Não'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Entregas");

    const fileName = `Relatorio_${client?.displayName?.replace(/\s+/g, '_')}_${format(weekStart, 'dd-MM')}_a_${format(weekEnd, 'dd-MM')}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: "Exportação Concluída",
      description: "O arquivo Excel foi gerado com sucesso.",
    });
  };

  return (
    <FinanceGuard>
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/finance">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-lg font-bold tracking-tight font-headline">Histórico da Loja</h1>
           <Button variant="outline" size="sm" onClick={handleExportToExcel} disabled={isLoading || !deliveries?.length} className="gap-2 font-bold">
            <Download className="size-4" />
            Excel
          </Button>
        </div>
        <div className="flex items-center gap-4">
            {isLoading ? <Skeleton className="size-14 rounded-xl" /> : (
                <Avatar className="size-14 rounded-xl">
                    <AvatarImage src={client?.photoURL || ''} alt={client?.displayName || ''} />
                    <AvatarFallback className="text-xl font-bold bg-muted text-muted-foreground">
                        {client?.displayName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            )}
            <div>
                {isLoading ? (
                    <>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-32 mt-1" />
                    </>
                ) : (
                    <>
                        <h2 className="text-lg font-bold">{client?.displayName}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Desde {client?.createdAt ? format(client.createdAt.toDate(), 'MMM yyyy', {locale: ptBR}) : 'N/A'}</p>
                    </>
                )}
            </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-48">
        <section className="mb-6">
            <Card className="p-3 bg-muted/50 border">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
                        <ChevronLeft className="size-5" />
                    </Button>
                    <div className="text-center">
                        <p className="text-sm font-bold">{format(weekStart, "d 'de' MMM", { locale: ptBR })} - {format(weekEnd, "d 'de' MMM, yyyy", { locale: ptBR })}</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Semana Selecionada</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleNextWeek}>
                        <ChevronRight className="size-5" />
                    </Button>
                </div>
            </Card>
        </section>

         <section className="grid grid-cols-2 gap-3 mb-6">
            <Card className="p-4 bg-amber-500/10 border-amber-500/20 relative overflow-hidden">
                <div className="absolute -right-2 -top-2 opacity-10">
                    <AlertCircle size={48} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">A Receber (Loja)</p>
                {isLoading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                    <p className="text-lg font-bold text-amber-500">
                        {totalUnpaidByClient.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                )}
            </Card>
            <Card className="p-4 bg-primary/10 border-primary/20 relative overflow-hidden">
                <div className="absolute -right-2 -top-2 opacity-10">
                    <CheckCircle size={48} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Total da Semana</p>
                {isLoading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                    <p className="text-lg font-bold text-primary">
                        {totalReceived.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                )}
            </Card>
        </section>

        <section>
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Relatório de Cobrança</h2>
                <span className="text-sm font-medium text-muted-foreground">{deliveries?.length || 0} registros</span>
            </div>
            <div className="space-y-3">
                 {isLoading && Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
                {!isLoading && deliveries && sortedDeliveries.map((delivery) => {
                    const originalIndex = deliveries.findIndex(d => d.id === delivery.id);
                    return (
                        <Card key={delivery.id} className={cn(
                            "p-3 transition-colors border-l-4",
                            delivery.paidByClient ? "border-l-emerald-500" : "border-l-amber-500"
                        )}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`size-10 rounded-full flex items-center justify-center ${statusBgMap[delivery.status]}`}>
                                        {statusMap[delivery.status]?.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Pedido {(originalIndex + 1).toString().padStart(3, '0')}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-black uppercase text-muted-foreground">{format((delivery.createdAt as Timestamp).toDate(), "dd MMM", {locale: ptBR})}</span>
                                            <span className={cn(
                                                "text-[9px] font-bold px-1 rounded uppercase",
                                                delivery.paidByClient ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                            )}>
                                                {delivery.paidByClient ? 'Liquidado' : 'Em Aberto'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-base">{delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
                 {!isLoading && deliveries?.length === 0 && (
                    <div className="text-center py-10 border rounded-xl">
                        <p className="font-semibold">Nenhuma entrega nesta semana</p>
                        <p className="text-muted-foreground text-sm mt-1">Navegue para outras semanas para ver o histórico.</p>
                    </div>
                )}
            </div>
        </section>
      </main>

      <div className="absolute bottom-0 left-0 right-0 z-30 pb-10 px-4 bg-gradient-to-t from-background via-background/80 to-transparent pt-10 pointer-events-none">
        <div className="p-5 rounded-2xl bg-primary text-white shadow-2xl shadow-primary/30 flex items-center justify-between pointer-events-auto">
            <div>
                <p className="text-[11px] uppercase font-bold tracking-widest opacity-80 mb-1">A Receber desta Loja</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{totalUnpaidByClient.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                </div>
            </div>
            <div className="text-right border-l border-white/20 pl-6">
                <p className="text-[11px] uppercase font-bold tracking-widest opacity-80 mb-1">Pendentes</p>
                <p className="text-2xl font-black">{unpaidDeliveries.length}</p>
            </div>
        </div>
    </div>
    </FinanceGuard>
  );
}
