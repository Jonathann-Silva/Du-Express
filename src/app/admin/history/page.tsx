import { ArrowLeft, Calendar, CheckCircle, Download, MapPin, AlertCircle, Search, Bike } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { historyReports } from "@/lib/data";

export default function HistoryReportsPage() {
  const summaryCards = [
    { title: "Receita Total", value: "R$4.250,00", change: "+12.5%", icon: <span className="text-green-500">▲</span>, changeColor: "text-green-500" },
    { title: "Concluídas", value: "142", change: "94% de Sucesso", icon: <CheckCircle className="size-3 text-green-500" />, changeColor: "text-green-500" },
    { title: "Recusadas", value: "5", change: "Ação Necessária", icon: <AlertCircle className="size-3 text-red-500" />, changeColor: "text-red-500" },
  ];

  return (
    <>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 pt-8 pb-4">
        <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" asChild>
                <Link href="/admin"><ArrowLeft /></Link>
            </Button>
          <h1 className="text-2xl font-bold tracking-tight font-headline">Histórico e Relatórios</h1>
          <Button variant="outline" size="icon" className="rounded-full">
            <Download className="size-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <section className="p-4">
            <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {summaryCards.map(card => (
                <Card key={card.title} className="min-w-[150px]">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</span>
                        <span className="text-xl font-bold block">{card.value}</span>
                        <span className={`text-[10px] font-semibold flex items-center gap-1 ${card.changeColor}`}>
                            {card.icon} {card.change}
                        </span>
                    </CardContent>
                </Card>
            ))}
          </div>
        </section>

        <section className="px-4 space-y-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
            <Input className="pl-10 pr-4 py-5 rounded-xl text-base" placeholder="Buscar ID do Pedido, Entregador ou Cliente" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Button size="sm" className="rounded-full whitespace-nowrap">Todos os Pedidos</Button>
            <Button size="sm" variant="secondary" className="rounded-full whitespace-nowrap">Finalizados</Button>
            <Button size="sm" variant="secondary" className="rounded-full whitespace-nowrap">Aceitos</Button>
            <Button size="sm" variant="secondary" className="rounded-full whitespace-nowrap">Recusados</Button>
            <Button size="sm" variant="secondary" className="rounded-full whitespace-nowrap">
              <Calendar className="size-4 mr-2" /> Out 2023
            </Button>
          </div>
        </section>

        <section className="px-4 space-y-3">
            {['Hoje', 'Ontem'].map(dateGroup => (
                <div key={dateGroup} className="space-y-3">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 pt-4">{dateGroup}</h2>
                    {historyReports.filter(r => r.dateGroup === dateGroup).map(report => (
                        <Card key={report.id} className="p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${report.status === 'Finalizado' ? 'bg-primary/10' : 'bg-red-100 dark:bg-red-900/20'}`}>
                                        {report.status === 'Finalizado' ? <Bike className="text-primary"/> : <AlertCircle className="text-red-500"/>}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{report.client}</p>
                                        <p className="text-xs text-muted-foreground">Entregador: {report.courier}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <Badge variant={report.status === 'Finalizado' ? 'default' : 'destructive'} className={`bg-${report.status === 'Finalizado' ? 'green' : 'red'}-100 text-${report.status === 'Finalizado' ? 'green' : 'red'}-600 dark:bg-${report.status === 'Finalizado' ? 'green' : 'red'}-900/30 dark:text-${report.status === 'Finalizado' ? 'green' : 'red'}-400`}>
                                        {report.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground mt-1">{report.timestamp}</span>
                                </div>
                            </div>
                            <div className="space-y-2 border-t pt-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <MapPin className="size-3.5 text-primary" />
                                    <span className="truncate">{report.pickup}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <MapPin className="size-3.5 text-red-500" />
                                    <span className="truncate">{report.dropoff}</span>
                                </div>
                            </div>
                            {report.reason && (
                                <div className="mt-3 p-2 bg-destructive/10 rounded-lg">
                                    <p className="text-[10px] text-destructive font-medium">{report.reason}</p>
                                </div>
                            )}
                            <div className="flex justify-between items-center mt-3 pt-3 border-t">
                                <p className={`text-lg font-bold ${report.price > 0 ? 'text-primary' : 'text-muted-foreground'}`}>R${report.price.toFixed(2)}</p>
                            </div>
                        </Card>
                    ))}
                </div>
            ))}
        </section>
      </main>
    </>
  );
}
