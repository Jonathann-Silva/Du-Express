'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Calendar, ChevronRight, Calculator, Wallet, Loader2, MapPin, Building, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Delivery } from '@/lib/types';
import { 
  format, 
  startOfYear, 
  endOfYear, 
  eachMonthOfInterval, 
  isSameMonth, 
  compareDesc
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { FinanceGuard } from '@/components/FinanceGuard';
import { ClientName } from '@/components/info/ClientName';
import { cn } from '@/lib/utils';

export default function FinancialHistoryPage() {
  const { userProfile, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const yearRange = useMemo(() => {
    const start = startOfYear(new Date(selectedYear, 0, 1));
    const end = endOfYear(new Date(selectedYear, 0, 1));
    return { start, end };
  }, [selectedYear]);

  const historyQuery = useMemo(() => {
    if (!firestore || userProfile?.role !== 'admin') return null;
    return query(
      collection(firestore, 'deliveries'),
      where('status', '==', 'finished'),
      where('createdAt', '>=', Timestamp.fromDate(yearRange.start)),
      where('createdAt', '<=', Timestamp.fromDate(yearRange.end)),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, userProfile, yearRange]);

  const { data: deliveries, loading: loadingDeliveries } = useCollection<Delivery>(historyQuery);

  const months = useMemo(() => {
    return eachMonthOfInterval({
      start: yearRange.start,
      end: yearRange.end,
    }).reverse(); // Do mais recente para o mais antigo
  }, [yearRange]);

  const statsByMonth = useMemo(() => {
    if (!deliveries) return {};

    const stats: Record<string, { total: number; deliveries: Delivery[] }> = {};

    months.forEach(month => {
      const monthKey = format(month, 'yyyy-MM');
      const monthDeliveries = deliveries
        .filter(d => isSameMonth(d.createdAt.toDate(), month))
        .sort((a, b) => compareDesc(a.createdAt.toDate(), b.createdAt.toDate()));
      
      const monthTotal = monthDeliveries.reduce((sum, d) => sum + (d.price || 0), 0);

      stats[monthKey] = {
        total: monthTotal,
        deliveries: monthDeliveries
      };
    });

    return stats;
  }, [deliveries, months]);

  const totalYear = useMemo(() => {
    return Object.values(statsByMonth).reduce((sum, m) => sum + m.total, 0);
  }, [statsByMonth]);

  // Filtra apenas os meses que possuem entregas realizadas
  const activeMonths = useMemo(() => {
    return months.filter(month => {
      const key = format(month, 'yyyy-MM');
      return statsByMonth[key] && statsByMonth[key].deliveries.length > 0;
    });
  }, [months, statsByMonth]);

  const isLoading = userLoading || loadingDeliveries;

  return (
    <FinanceGuard>
      <div className="flex flex-col h-full bg-background outline-none">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 py-4 border-b">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin">
                <ArrowLeft />
              </Link>
            </Button>
            <h1 className="text-xl font-bold tracking-tight font-headline">Histórico Financeiro</h1>
          </div>
          
          <Card className="bg-primary/5 border-primary/10 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Faturamento Total {selectedYear}</p>
                <h2 className="text-3xl font-black text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-32" /> : totalYear.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </h2>
              </div>
              <div className="size-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <TrendingUp size={24} />
              </div>
            </div>
          </Card>
        </header>

        <main className="flex-1 p-4 overflow-y-auto pb-32">
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))
            ) : activeMonths.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-4">
                {activeMonths.map(month => {
                  const key = format(month, 'yyyy-MM');
                  const data = statsByMonth[key];

                  return (
                    <AccordionItem key={key} value={key} className="border rounded-[2rem] bg-card overflow-hidden shadow-sm border-none">
                      <AccordionTrigger className="hover:no-underline p-0">
                        <div className="flex items-center justify-between w-full p-5 text-left transition-colors bg-muted/30">
                          <div className="flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-background border flex flex-col items-center justify-center shrink-0 shadow-sm">
                              <span className="text-[10px] font-black uppercase text-primary">{format(month, 'MMM', { locale: ptBR })}</span>
                              <span className="text-lg font-bold leading-none">{format(month, 'yy')}</span>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold capitalize leading-none">{format(month, 'MMMM', { locale: ptBR })}</h3>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                {data.deliveries.length} entregas
                              </p>
                            </div>
                          </div>
                          <div className="text-right pr-2">
                            <p className="text-base font-black text-primary">
                              {data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        <div className="divide-y divide-dashed">
                          {data.deliveries.map((delivery) => (
                            <div key={delivery.id} className="p-4 hover:bg-muted/20 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Building size={16} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold leading-none">
                                      <ClientName clientId={delivery.clientId} />
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Clock className="size-3 text-muted-foreground" />
                                      <p className="text-[10px] font-medium text-muted-foreground">
                                        {format(delivery.createdAt.toDate(), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-sm font-black text-foreground">
                                  {delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 mt-2 px-1">
                                <MapPin className="size-3 text-red-500 shrink-0" />
                                <p className="text-xs text-muted-foreground truncate">{delivery.dropoff}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <div className="text-center py-20 border-2 border-dashed rounded-[2rem]">
                <Calculator className="size-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="font-bold text-muted-foreground">Nenhum faturamento encontrado em {selectedYear}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </FinanceGuard>
  );
}