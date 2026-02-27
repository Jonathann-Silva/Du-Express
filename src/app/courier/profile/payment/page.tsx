'use client';

import { ArrowLeft, Wallet, Landmark, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PaymentMethodsPage() {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center bg-background/80 backdrop-blur-md p-4 border-b">
        <Button asChild variant="ghost" size="icon">
            <Link href="/courier/profile">
                <ArrowLeft />
            </Link>
        </Button>
        <h1 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10 font-headline">
            Métodos de Pagamento
        </h1>
      </header>
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 bg-primary/10 border-b border-primary/20">
            <div className="flex items-start gap-3">
                <Info className="text-primary size-5 mt-0.5 shrink-0"/>
                <p className="text-sm font-medium text-foreground/80">
                    Seus pagamentos são processados toda quarta-feira referente aos ganhos da semana anterior.
                </p>
            </div>
        </div>

        <div className="p-4 space-y-8 mt-6">
            <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 font-headline">
                    <Wallet className="text-primary size-6" />
                    Detalhes do PIX
                </h2>
                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                            Tipo de Chave PIX
                        </Label>
                        <Select>
                            <SelectTrigger className="w-full h-14 rounded-xl text-base">
                                <SelectValue placeholder="Selecione o tipo de chave" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cpf">CPF</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Telefone</SelectItem>
                                <SelectItem value="random">Chave Aleatória</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                            Chave PIX
                        </Label>
                        <Input 
                            className="h-14 rounded-xl text-base" 
                            placeholder="Insira sua chave PIX" 
                        />
                    </div>
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 font-headline">
                        <Landmark className="text-primary size-6" />
                        Conta Bancária
                        <span className="text-xs font-normal text-muted-foreground uppercase ml-2">(Opcional)</span>
                    </h2>
                </div>
                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                            Nome do Banco
                        </Label>
                        <Input 
                            className="h-14 rounded-xl text-base" 
                            placeholder="Ex: Nubank, Itaú" 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                                Agência
                            </Label>
                            <Input 
                                className="h-14 rounded-xl text-base" 
                                placeholder="0001" 
                            />
                        </div>
                        <div>
                            <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                                Conta
                            </Label>
                            <Input 
                                className="h-14 rounded-xl text-base" 
                                placeholder="12345-6" 
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
        
        <div className="px-4 py-6">
            <Button className="w-full h-14 font-bold text-base rounded-xl shadow-lg shadow-primary/25">
                Atualizar Informações
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4 px-6">
                Alterações nas informações de pagamento podem levar até 24 horas para serem verificadas.
            </p>
        </div>
      </main>
    </>
  );
}
