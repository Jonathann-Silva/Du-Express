'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, Loader2, ChevronLeft, ChevronRight, Wallet, CreditCard, Smartphone, Banknote } from 'lucide-react';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinanceGuard } from "@/components/FinanceGuard";
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const paymentIconMap = {
    credit: <CreditCard className="size-3 text-primary" />,
    pix: <Smartphone className="size-3 text-[#32BCAD]" />,
    cash: <Banknote className="size-3 text-emerald-500" />,
    collect: <Banknote className="size-3 text-amber-500" />
};

export default function ClientFinanceDetailsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSettling, setIsSettling] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const fetchDeliveries = async () => {
    if (!firestore || !clientId) return;
    setLoading(true);
    const q = query(
        collection(firestore, 'deliveries'), 
        where('clientId', '==', clientId), 
        where('createdAt', '>=', weekStart), 
        where('createdAt', '<=', weekEnd), 
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    setDeliveries(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery)));
    setLoading(false);
  };

  useEffect(() => { fetchDeliveries(); }, [firestore, clientId, weekStart, weekEnd]);

  const stats = useMemo(() => {
    if (!deliveries) return { totalWeek: 0, debtClient: 0, paidInPerson: 0, unpaidItems: [] };
    return deliveries.reduce((acc, d) => {
        // Agora incluímos todas as corridas exceto as recusadas, para que o saldo "em aberto" apareça
        if (d.status !== 'refused') {
            const priceValue = Number(d.price || 0);
            acc.totalWeek += priceValue;
            
            if (!d.paidByClient) {
                acc.debtClient += priceValue;
                acc.unpaidItems.push(d);
            } else if (d.paymentMethod !== 'credit') {
                // Liquidado no local (Dinheiro/Pix direto ao motoboy)
                acc.paidInPerson += priceValue;
            }
        }
        return acc;
    }, { totalWeek: 0, debtClient: 0, paidInPerson: 0, unpaidItems: [] as Delivery[] });
  }, [deliveries]);

  const handleManualSettle = async () => {
    if (!firestore || stats.unpaidItems.length === 0) return;
    setIsSettling(true);
    const batch = writeBatch(firestore);
    
    stats.unpaidItems.forEach(d => {
        batch.update(doc(firestore, 'deliveries', d.id), { paidByClient: true });
    });

    batch.set(doc(collection(firestore, 'notifications')), {
        userId: clientId,
        title: 'Débitos Liquidados',
        description: 'A central confirmou o recebimento e baixou seus débitos pendentes.',
        createdAt: serverTimestamp(),
        read: false,
        icon: 'wallet'
    });

    try {
        await batch.commit();
        toast({ title: "Débitos Liquidados!", description: "A conta da loja foi atualizada." });
        fetchDeliveries();
    } catch (e) {
        toast({ title: "Erro ao liquidar", variant: "destructive" });
    } finally {
        setIsSettling(false);
    }
  };

  const handleExportToPDF = () => {
    if (!deliveries?.length || !client) return;

    const doc = new jsPDF();
    
    // Configurações do Header
    doc.setFontSize(18);
    doc.setTextColor(19, 164, 236); // Cor azul do Du Express
    doc.text(`Du Express - Extrato Financeiro`, 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(60);
    doc.text(`Cliente: ${client.displayName}`, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${format(weekStart, "dd/MM/yyyy")} a ${format(weekEnd, "dd/MM/yyyy")}`, 14, 37);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 42);

    // Agrupamento por Dia (Exclui recusadas do PDF também)
    const grouped = deliveries.reduce((acc, d) => {
        if (d.status === 'refused') return acc;
        const dateKey = format(d.createdAt.toDate(), "eeee, dd 'de' MMMM", { locale: ptBR });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(d);
        return acc;
    }, {} as Record<string, Delivery[]>);

    let finalY = 50;

    Object.entries(grouped).sort((a, b) => {
        return a[1][0].createdAt.toDate().getTime() - b[1][0].createdAt.toDate().getTime();
    }).forEach(([day, dayDeliveries]) => {
        // Verifica se cabe na página
        if (finalY > 240) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(day.toUpperCase(), 14, finalY);
        finalY += 5;

        autoTable(doc, {
            startY: finalY,
            head: [['Horário', 'Destino', 'Valor', 'Pagamento', 'Status']],
            body: dayDeliveries.sort((a, b) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()).map(d => [
                format(d.createdAt.toDate(), 'HH:mm'),
                d.dropoff,
                d.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                d.paymentMethod === 'credit' ? 'Crediário' : d.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro',
                d.paidByClient ? 'LIQUIDADO' : 'EM ABERTO'
            ]),
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [19, 164, 236], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 14, right: 14 }
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;
    });

    // Totais no final
    if (finalY > 230) {
        doc.addPage();
        finalY = 20;
    }
    
    doc.setDrawColor(200);
    doc.line(14, finalY - 5, 196, finalY - 5);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text("RESUMO DO PERÍODO", 14, finalY);
    finalY += 10;
    
    autoTable(doc, {
        startY: finalY,
        body: [
            ['Faturamento Total Bruto', stats.totalWeek.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
            ['Total Pago no Local (Pix/Dinheiro)', stats.paidInPerson.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
            ['Saldo Pendente para Acerto (Crediário)', stats.debtClient.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]
        ],
        theme: 'grid',
        styles: { fontStyle: 'bold', fontSize: 10, cellPadding: 5 },
        columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right' } }
    });

    doc.save(`Extrato_${client.displayName}_${format(weekStart, "dd-MM")}.pdf`);
  };

  const isLoading = userLoading || clientLoading || loading;

  return (
    <FinanceGuard>
      <div className="flex flex-col h-full bg-background outline-none">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 border-b shrink-0">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" asChild><Link href="/admin/finance"><ArrowLeft /></Link></Button>
            <h1 className="text-lg font-bold font-headline">Extrato da Loja</h1>
            <Button variant="outline" size="sm" onClick={handleExportToPDF} disabled={!deliveries?.length} className="font-bold gap-2">
              <FileText className="size-4" /> PDF
            </Button>
          </div>
          <div className="flex items-center gap-4">
              {isLoading ? <Skeleton className="size-14 rounded-xl" /> : <Avatar className="size-14 rounded-xl border-2 border-primary/10"><AvatarImage src={client?.photoURL || ''} /><AvatarFallback className="bg-muted text-muted-foreground font-black">{client?.displayName?.charAt(0)}</AvatarFallback></Avatar>}
              <div>{isLoading ? <Skeleton className="h-6 w-40" /> : <h2 className="text-lg font-bold">{client?.displayName}</h2>}<p className="text-[10px] uppercase font-bold text-muted-foreground">Logística Local Arapongas</p></div>
          </div>
        </header>

        <main className="flex-1 p-4 pb-48 overflow-y-auto">
          <section className="mb-6">
            <Card className="p-3 bg-muted/50 border flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="size-5" /></Button>
              <div className="text-center">
                <p className="text-sm font-bold">{mounted ? `${format(weekStart, "dd/MM")} - ${format(weekEnd, "dd/MM")}` : '---'}</p>
                <p className="text-[10px] uppercase font-black text-primary tracking-widest leading-none mt-0.5">Semana Selecionada</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="size-5" /></Button>
            </Card>
          </section>

          <section className="grid grid-cols-2 gap-3 mb-6">
              <Card className="p-4 bg-amber-500/10 border-amber-500/20">
                  <p className="text-[10px] font-black uppercase text-amber-600">A Receber (Crediário)</p>
                  <p className="text-xl font-black text-amber-500">{mounted ? stats.debtClient.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '---'}</p>
              </Card>
              <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
                  <p className="text-[10px] font-black uppercase text-emerald-600">Recebido (Pix/Dinheiro)</p>
                  <p className="text-xl font-black text-emerald-500">{mounted ? stats.paidInPerson.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '---'}</p>
              </Card>
          </section>

          {mounted && stats.debtClient > 0 && (
              <div className="mb-8">
                  <Button 
                      className="w-full h-14 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 gap-2"
                      onClick={() => setIsSettleDialogOpen(true)}
                      disabled={isSettling}
                  >
                      {isSettling ? <Loader2 className="animate-spin" /> : <Wallet className="size-5" />}
                      BAIXAR DÉBITOS MANUALMENTE ({stats.debtClient.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground mt-2 italic">Use este botão se a loja já pagou por outro meio.</p>
              </div>
          )}

          <section className="space-y-3">
              <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest px-1">Registros da Semana</h3>
              {isLoading || !mounted ? <Skeleton className="h-32 w-full rounded-2xl" /> : deliveries?.map(d => (
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

        <AlertDialog open={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen}>
          <AlertDialogContent className="rounded-3xl max-w-[90vw]">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Baixa Manual?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está confirmando que recebeu o valor de {stats.debtClient.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} da loja {client?.displayName}. Esta ação baixará todos os débitos pendentes desta semana.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col gap-2">
              <AlertDialogAction 
                onClick={handleManualSettle}
                className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground"
              >
                Sim, Recebi o Valor
              </AlertDialogAction>
              <AlertDialogCancel className="w-full h-12 rounded-xl font-medium border-none bg-muted text-muted-foreground">
                Cancelar
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FinanceGuard>
  );
}
