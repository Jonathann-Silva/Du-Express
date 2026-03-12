'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Calendar, ChevronRight, Calculator, Wallet, Loader2 } from 'lucide-react';
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
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  addDays, 
  isSameMonth, 
  isWithinInterval,
  getDay,
  subDays
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
    }).reverse();
  }, [yearRange]);

  const statsByMonth = useMemo(() => {
    if (!deliveries) return {};

    const stats: Record<string, { total: number; weeks: { label: string; total: number }[] }> = {};

    months.forEach(month => {
      const monthKey = format(month, 'yyyy-MM');
      const monthDeliveries = deliveries.filter(d => isSameMonth(d.createdAt.toDate(), month));
      const monthTotal = monthDeliveries.reduce((sum, d) => sum + d.price, 0);

      // Agrupamento Semanal (Segunda a Sábado)
      const weeks: { label: string; total: number }[] = [];
      const mStart = startOfMonth(month);
      const mEnd = endOfMonth(month);

      let current = startOfWeek(mStart, { weekStartsOn: 1 });
      while (current <= mEnd) {
        const wStart = current;
        const wEnd = addDays(current, 5); // Sábado
        
        const weekDeliveries = monthDeliveries.filter(d => {
          const dDate = d.createdAt.toDate();
          return isWithinInterval(dDate, { start: wStart, end: wEnd });
        });

        const weekTotal = weekDeliveries.reduce((sum, d) => sum + d.price, 0);
        
        if (weekTotal > 0 || isWithinInterval(new Date(), { start: wStart, end: wEnd })) {
          weeks.push({
            label: `${format(wStart, 'dd/MM')} - ${format(wEnd, 'dd/MM')}`,
            total: weekTotal
          });
        }
        
        current = addDays(current, 7);
      }

      stats[monthKey] = {
        total: monthTotal,
        weeks: weeks.reverse()
      };
    });

    return stats;
  }, [deliveries, months]);

  const totalYear = useMemo(() => {
    return Object.values(statsByMonth).reduce((sum, m) => sum + m.total, 0);
  }, [statsByMonth]);

  const isLoading = userLoading || loadingDeliveries;

  return (
    <FinanceGuard>
      <div className="flex flex-col h-full bg-background">
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
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Faturamento Bruto {selectedYear}</p>
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
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))
            ) : (
              <Accordion type="single" collapsible className="space-y-3">
                {months.map(month => {
                  const key = format(month, 'yyyy-MM');
                  const data = statsByMonth[key];
                  if (!data || data.total === 0) return null;

                  return (
                    <AccordionItem key={key} value={key} className="border rounded-2xl bg-card px-4 shadow-sm">
                      <AccordionTrigger className="hover:no-underline py-5">
                        <div className="flex items-center gap-4 w-full text-left">
                          <div className="size-12 rounded-xl bg-muted flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">{format(month, 'MMM', { locale: ptBR })}</span>
                            <span className="text-lg font-bold leading-none">{format(month, 'yy')}</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold capitalize">{format(month, 'MMMM', { locale: ptBR })}</h3>
                            <p className="text-xs text-muted-foreground font-medium">{data.weeks.length} semanas registradas</p>
                          </div>
                          <div className="text-right pr-2">
                            <p className="text-base font-black text-primary">{data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 pt-2 border-t border-dashed">
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Detalhamento por Ciclo</h4>
                          {data.weeks.map((week, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                              <div className="flex items-center gap-3">
                                <Calendar className="size-4 text-muted-foreground" />
                                <span className="text-sm font-bold">{week.label}</span>
                              </div>
                              <span className="text-sm font-black text-foreground">
                                {week.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}

            {!isLoading && totalYear === 0 && (
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
