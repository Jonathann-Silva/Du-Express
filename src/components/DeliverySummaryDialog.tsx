'use client';

import { Delivery } from "@/lib/types";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, CircleDot, Building, Bike, CreditCard, Banknote, Smartphone, Clock, Calendar, CheckCircle2, Info } from "lucide-react";
import { ClientName } from "./info/ClientName";
import { CourierName } from "./info/CourierName";
import { cn } from "@/lib/utils";

const paymentIconMap = {
    credit: <CreditCard className="size-4 text-primary" />,
    pix: <Smartphone className="size-4 text-[#32BCAD]" />,
    cash: <Banknote className="size-4 text-emerald-500" />,
    collect: <Banknote className="size-4 text-amber-500" />
};

const paymentLabelMap = {
    credit: 'Crediário',
    pix: 'Pix',
    cash: 'Dinheiro',
    collect: 'Receber no Local'
};

export function DeliverySummaryDialog({ delivery }: { delivery: Delivery }) {
  const createdDate = delivery.createdAt?.toDate();
  const finishedDate = delivery.finishedAt?.toDate();

  return (
    <div className="space-y-6 py-2">
      <DialogHeader className="text-left border-b pb-4 -mx-6 px-6">
        <DialogTitle className="text-xl font-bold font-headline flex items-center gap-2">
          <CheckCircle2 className="text-emerald-500 size-6" />
          Resumo da Entrega
        </DialogTitle>
        <DialogDescription className="text-xs uppercase font-black tracking-widest text-muted-foreground mt-1">
          ID: {delivery.id}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1">
        {/* Rota */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Logística da Rota</h3>
          <div className="space-y-4 bg-muted/30 p-4 rounded-2xl border border-dashed">
            <div className="flex gap-3">
              <CircleDot className="size-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Coleta</p>
                <p className="text-sm font-semibold leading-tight">{delivery.pickup}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="size-5 text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Destino</p>
                <p className="text-sm font-semibold leading-tight">{delivery.dropoff}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Profissionais */}
        <div className="grid grid-cols-2 gap-4">
          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Solicitante</h3>
            <div className="flex items-center gap-2 bg-card border p-3 rounded-xl shadow-sm">
              <Building className="size-4 text-primary opacity-50" />
              <p className="text-[11px] font-bold truncate"><ClientName clientId={delivery.clientId} /></p>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Entregador</h3>
            <div className="flex items-center gap-2 bg-card border p-3 rounded-xl shadow-sm">
              <Bike className="size-4 text-primary opacity-50" />
              <p className="text-[11px] font-bold truncate">
                {delivery.courierId ? <CourierName courierId={delivery.courierId} /> : 'N/A'}
              </p>
            </div>
          </section>
        </div>

        <Separator />

        {/* Financeiro */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Informações Financeiras</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
              <p className="text-[9px] font-black uppercase text-primary mb-1">Valor Total</p>
              <p className="text-xl font-black text-foreground">{delivery.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="p-4 rounded-2xl bg-muted/50 border flex flex-col items-center text-center">
              <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Pagamento</p>
              <div className="flex items-center gap-1.5 mt-1">
                {paymentIconMap[delivery.paymentMethod]}
                <span className="text-xs font-bold">{paymentLabelMap[delivery.paymentMethod]}</span>
              </div>
            </div>
          </div>
          
          <div className={cn(
            "p-3 rounded-xl flex items-center justify-between",
            delivery.paidByClient ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          )}>
            <span className="text-[10px] font-black uppercase">Status do Acerto (Loja)</span>
            <span className="text-xs font-bold uppercase">{delivery.paidByClient ? 'Liquidado' : 'Em Aberto'}</span>
          </div>
        </section>

        {/* Cronologia */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cronologia</h3>
          <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-2xl">
            <div className="flex items-start gap-2">
              <Calendar className="size-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-none mb-1">Solicitado</p>
                <p className="text-[11px] font-bold">{createdDate ? format(createdDate, "dd/MM/yyyy") : '--'}</p>
                <p className="text-[10px] text-muted-foreground">{createdDate ? format(createdDate, "HH:mm") : '--'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="size-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-none mb-1">Finalizado</p>
                <p className="text-[11px] font-bold">{finishedDate ? format(finishedDate, "dd/MM/yyyy") : '--'}</p>
                <p className="text-[10px] text-muted-foreground">{finishedDate ? format(finishedDate, "HH:mm") : '--'}</p>
              </div>
            </div>
          </div>
        </section>

        {delivery.observations && (
          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</h3>
            <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl flex gap-2">
              <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-tight italic">"{delivery.observations}"</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
