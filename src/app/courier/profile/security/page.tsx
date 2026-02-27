'use client';

import { ArrowLeft, ShieldCheck, KeyRound, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';

export default function SecuritySettingsPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center p-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/courier/profile">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="flex-1 text-center text-lg font-bold tracking-tight pr-10 font-headline">Configurações de Segurança</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="text-primary size-10" />
          </div>
          <h2 className="text-xl font-bold mb-1 font-headline">Proteção da Conta</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie sua senha e camadas extras de segurança para manter sua conta de entregador segura.
          </p>
        </div>

        <section className="px-4 py-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 px-2 font-headline">Atualizar Senha</h3>
          <Card className="p-4 rounded-xl">
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="old-password">Senha Antiga</Label>
                <div className="relative flex items-center">
                  <Input id="old-password" type="password" placeholder="Digite a senha atual" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative flex items-center">
                  <Input id="new-password" type="password" placeholder="Digite a nova senha" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <div className="relative flex items-center">
                  <Input id="confirm-password" type="password" placeholder="Confirme a nova senha" />
                </div>
              </div>
              <Button className="w-full font-bold mt-2">
                Atualizar Senha
              </Button>
            </div>
          </Card>
        </section>

        <section className="px-4 py-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 px-2 font-headline">Segurança Avançada</h3>
          <Card className="p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <KeyRound className="size-5" />
              </div>
              <div>
                <p className="font-semibold">Autenticação de Dois Fatores</p>
                <p className="text-xs text-muted-foreground">Proteja sua conta com 2FA</p>
              </div>
            </div>
            <Switch id="two-factor-auth" />
          </Card>
          <p className="mt-3 px-2 text-xs text-muted-foreground leading-relaxed">
            A autenticação de dois fatores adiciona uma camada extra de segurança à sua conta, exigindo mais do que apenas uma senha para fazer login.
          </p>
        </section>

        <section className="px-4 py-2">
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
            <Button variant="ghost" className="w-full flex items-center justify-between text-destructive hover:text-destructive hover:bg-destructive/20">
              <span>Sair de todos os dispositivos</span>
              <LogOut />
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}
