
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  User as UserIcon, 
  LogOut, 
  Palette, 
  Image as ImageIcon, 
  Gavel, 
  ChevronRight, 
  ShieldCheck, 
  Lock, 
  Fingerprint, 
  Bell, 
  Mail, 
  BellRing,
  Loader2,
  Megaphone,
  Send,
  Timer,
  Smartphone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUser, useAuth, useFirestore, useDoc } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, updateDoc, serverTimestamp, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function AdminSettingsPage() {
  const { userProfile: adminUser, loading: adminLoading } = useUser();
  const { auth } = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [newFinancePassword, setNewFinancePassword] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Security Verification
  const [isSecurityVerified, setIsSecurityVerified] = useState(false);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [verifyError, setVerifyError] = useState(false);

  // System Rules state
  const [isTimeLimitModalOpen, setIsTimeLimitModalOpen] = useState(false);
  const [newTimeLimit, setNewTimeLimit] = useState(45);
  const [isUpdatingRules, setIsUpdatingRules] = useState(false);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // Otimização: Apenas tenta criar referências se o usuário for carregado e for admin
  const isAuthorizedAdmin = !!adminUser && adminUser.role === 'admin';

  const settingRef = useMemo(() => (
    firestore && isAuthorizedAdmin ? doc(firestore, 'settings', 'finance') : null
  ), [firestore, isAuthorizedAdmin]);
  
  const { data: financeSetting } = useDoc<{ password?: string }>(settingRef);

  const rulesRef = useMemo(() => (
    firestore && isAuthorizedAdmin ? doc(firestore, 'settings', 'rules') : null
  ), [firestore, isAuthorizedAdmin]);
  
  const { data: rulesSetting } = useDoc<{ deliveryTimeLimit?: number, autoCancel?: boolean }>(rulesRef);

  useEffect(() => {
    if (rulesSetting?.deliveryTimeLimit) {
      setNewTimeLimit(rulesSetting.deliveryTimeLimit);
    }
  }, [rulesSetting]);

  const handleUpdateFinancePassword = async () => {
    if (!firestore || !newFinancePassword) return;
    
    setIsUpdatingPassword(true);
    const docRef = doc(firestore, 'settings', 'finance');
    
    try {
      await setDoc(docRef, { 
        password: newFinancePassword,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toast({
        title: "Senha Atualizada",
        description: "A senha da área financeira foi alterada com sucesso.",
      });
      setIsPasswordModalOpen(false);
      setNewFinancePassword('');
      setIsSecurityVerified(false);
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar a nova senha.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleVerifyAccess = () => {
    const correctPassword = financeSetting?.password || 'admin123';
    if (verifyPasswordInput === correctPassword) {
      setIsSecurityVerified(true);
      setVerifyError(false);
    } else {
      setVerifyError(true);
      setVerifyPasswordInput('');
      setTimeout(() => setVerifyError(false), 2000);
    }
  };

  const handleUpdateTimeLimit = async () => {
    if (!firestore || !rulesRef) return;
    setIsUpdatingRules(true);
    try {
      await setDoc(rulesRef, { 
        deliveryTimeLimit: newTimeLimit,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toast({
        title: "Regra Atualizada",
        description: `O tempo limite foi definido para ${newTimeLimit} minutos.`,
      });
      setIsTimeLimitModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingRules(false);
    }
  };

  const handleToggleAutoCancel = async (checked: boolean) => {
    if (!firestore || !rulesRef) return;
    try {
      await setDoc(rulesRef, { 
        autoCancel: checked,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({
        title: checked ? "Cancelamento Ativado" : "Cancelamento Desativado",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar regra",
        variant: "destructive"
      });
    }
  };

  const handleSendBroadcast = async () => {
    if (!firestore || !broadcastMessage.trim()) return;
    
    setIsSendingBroadcast(true);
    try {
      const usersSnap = await getDocs(collection(firestore, 'users'));
      const batch = writeBatch(firestore);
      
      usersSnap.docs.forEach(userDoc => {
        const userData = userDoc.data();
        const notifRef = doc(collection(firestore, 'notifications'));
        
        batch.set(notifRef, {
          userId: userDoc.id,
          title: 'Aviso da Central',
          description: broadcastMessage,
          createdAt: serverTimestamp(),
          read: false,
          icon: 'alert',
          link: userData.role === 'client' ? '/client' : '/courier'
        });
      });

      await batch.commit();
      
      toast({
        title: "Aviso Enviado!",
        description: `Mensagem enviada para ${usersSnap.size} usuários.`,
      });
      setBroadcastMessage('');
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro no Envio",
        description: "Não foi possível enviar a mensagem para todos.",
        variant: "destructive"
      });
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleLogout = async () => {
    if (auth && firestore && adminUser) {
        try {
            const statusDocRef = doc(firestore, 'status', 'main');
            const userDocRef = doc(firestore, 'users', adminUser.uid);
            
            await Promise.all([
                updateDoc(statusDocRef, { 
                    adminOnline: false,
                    lastUpdated: serverTimestamp(),
                }),
                updateDoc(userDocRef, { status: 'offline' })
            ]);

            await auth.signOut();
            toast({
                title: "Desconectado",
                description: "Você saiu e a central foi marcada como Offline.",
            });
            router.push('/login');
        } catch (error) {
             console.error("Logout error:", error);
             await auth.signOut();
             router.push('/login');
        }
    }
  };
  
  const isLoading = adminLoading;
  const isDeviceRegistered = !!adminUser?.fcmToken;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 py-4 border-b flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/admin">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight font-headline">Configurações do Sistema</h1>
        <div className="size-10" />
      </header>

      <main className="flex-1 p-4 space-y-8 pb-32 overflow-y-auto">
        
        <section>
            <Card className="overflow-hidden border-none shadow-md bg-primary/5">
                <CardContent className="p-6 flex items-center gap-4">
                    {isLoading ? (
                        <Skeleton className="size-16 rounded-full" />
                    ) : (
                        <Avatar className="size-16 border-2 border-primary/20 shadow-sm">
                            {adminUser?.photoURL && <AvatarImage src={adminUser.photoURL} alt={adminUser.displayName || 'Admin'} />}
                            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                                {adminUser?.displayName?.charAt(0) || 'A'}
                            </AvatarFallback>
                        </Avatar>
                    )}
                    <div className="flex-1">
                        {isLoading ? (
                            <>
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-3 w-40 mt-2" />
                            </>
                        ) : (
                            <>
                                <h2 className="text-lg font-bold leading-tight font-headline">{adminUser?.displayName}</h2>
                                <p className="text-xs text-muted-foreground">{adminUser?.email}</p>
                                <Badge variant="outline" className="mt-2 text-[10px] uppercase font-black bg-background">Administrador Master</Badge>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </section>

        {/* Device Registration Status */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Smartphone className="text-primary size-5" />
            <h2 className="text-lg font-bold font-headline">Status do Dispositivo</h2>
          </div>
          <Card className={cn(
            "p-4 border shadow-sm transition-all",
            isDeviceRegistered ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "size-12 rounded-2xl flex items-center justify-center shadow-sm",
                isDeviceRegistered ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
              )}>
                {isDeviceRegistered ? <CheckCircle2 className="size-6" /> : <AlertCircle className="size-6" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">
                  {isDeviceRegistered ? "Celular Conectado" : "Dispositivo não Registrado"}
                </p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {isDeviceRegistered 
                    ? "Este aparelho está pronto para receber notificações push, mesmo com o app fechado."
                    : "Permita as notificações no seu navegador para receber alertas de novos pedidos."}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Palette className="text-primary size-5" />
            <h2 className="text-lg font-bold font-headline">Identidade da Plataforma</h2>
          </div>
          <Card className="p-4 shadow-sm border">
            <div className="flex flex-col gap-4">
              <div className="aspect-video w-full rounded-xl bg-muted flex items-center justify-center overflow-hidden relative group border">
                <div className="absolute inset-0 bg-primary/5 flex items-center justify-center">
                  <ImageIcon className="size-12 text-primary/20" />
                </div>
                <Button variant="secondary" size="sm" className="relative z-10 font-bold">
                  Alterar Logo
                </Button>
              </div>
              <div>
                <p className="text-base font-bold">Identidade Visual</p>
                <p className="text-sm text-muted-foreground">Gerencie o logotipo e a cor primária da sua marca.</p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary ring-4 ring-primary/10"></div>
                  <span className="text-xs font-mono font-bold text-muted-foreground">#13A4EC</span>
                </div>
                <Button variant="outline" size="sm" className="font-bold">
                  Editar Estilos
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Gavel className="text-primary size-5" />
            <h2 className="text-lg font-bold font-headline">Regras do Sistema</h2>
          </div>
          <div className="rounded-xl border bg-card shadow-sm divide-y">
            
            <Dialog open={isTimeLimitModalOpen} onOpenChange={setIsTimeLimitModalOpen}>
              <DialogTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left">
                  <div>
                    <p className="font-bold text-sm">Tempo Limite de Entrega</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Minutos máximos por rota</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-primary">{rulesSetting?.deliveryTimeLimit || 45}m</span>
                    <ChevronRight className="text-muted-foreground size-4" />
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-headline flex items-center gap-2">
                    <Timer className="text-primary size-5" />
                    Definir Tempo Limite
                  </DialogTitle>
                  <DialogDescription>
                    Ajuste o tempo médio esperado para as entregas. Isso ajuda na organização da logística.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold">Duração Máxima</Label>
                    <span className="text-2xl font-black text-primary">{newTimeLimit} min</span>
                  </div>
                  <Slider 
                    min={10} 
                    max={120} 
                    step={5} 
                    value={[newTimeLimit]} 
                    onValueChange={(val) => setNewTimeLimit(val[0])}
                    className="py-4"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    <span>10 min</span>
                    <span>120 min</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsTimeLimitModalOpen(false)}>Cancelar</Button>
                  <Button onClick={handleUpdateTimeLimit} disabled={isUpdatingRules}>
                    {isUpdatingRules && <Loader2 className="animate-spin size-4 mr-2" />}
                    Salvar Regra
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div>
                <p className="font-bold text-sm">Cancelamento Automático</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Cancelar após 20m sem resposta</p>
              </div>
              <Switch 
                checked={rulesSetting?.autoCancel !== false} 
                onCheckedChange={handleToggleAutoCancel} 
              />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <ShieldCheck className="text-primary size-5" />
            <h2 className="text-lg font-bold font-headline">Segurança do Admin</h2>
          </div>
          <div className="rounded-xl border bg-card shadow-sm divide-y">
            <Dialog 
              open={isPasswordModalOpen} 
              onOpenChange={(open) => {
                setIsPasswordModalOpen(open);
                if (!open) {
                  setIsSecurityVerified(false);
                  setVerifyPasswordInput('');
                  setVerifyError(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Lock className="text-muted-foreground size-5" />
                    <p className="font-bold text-sm">Gestão de Senhas</p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4" />
                </button>
              </DialogTrigger>
              <DialogContent>
                {!isSecurityVerified ? (
                  <div className="space-y-4 py-4">
                    <DialogHeader>
                      <DialogTitle className="font-headline flex items-center gap-2">
                        <Lock className="text-primary size-5" />
                        Acesso Restrito
                      </DialogTitle>
                      <DialogDescription>
                        Insira a senha mestra para gerenciar as credenciais do sistema.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="verify-pass">Senha Mestra</Label>
                        <Input 
                          id="verify-pass" 
                          type="password" 
                          placeholder="••••••"
                          value={verifyPasswordInput}
                          onChange={(e) => setVerifyPasswordInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyAccess()}
                          className={cn(verifyError && "border-destructive ring-destructive")}
                          autoFocus
                        />
                        {verifyError && <p className="text-[10px] text-destructive font-bold uppercase tracking-widest">Senha Incorreta</p>}
                      </div>
                      <Button className="w-full font-bold h-12" onClick={handleVerifyAccess}>
                        Desbloquear Acesso
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="font-headline">Senha Mestra (Área Financeira)</DialogTitle>
                      <DialogDescription>
                        Esta senha protege o acesso aos dados sensíveis de faturamento e repasses.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-pass">Senha Atual</Label>
                        <Input 
                          id="current-pass" 
                          type="text" 
                          value={financeSetting?.password || 'admin123'} 
                          disabled 
                          className="bg-muted font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-pass">Nova Senha</Label>
                        <Input 
                          id="new-pass" 
                          type="password" 
                          placeholder="Digite a nova senha mestra"
                          value={newFinancePassword}
                          onChange={(e) => setNewFinancePassword(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" onClick={handleUpdateFinancePassword} disabled={isUpdatingPassword || !newFinancePassword}>
                        {isUpdatingPassword ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Atualizando...
                          </>
                        ) : (
                          "Salvar Nova Senha"
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <Fingerprint className="text-muted-foreground size-5" />
                <p className="font-bold text-sm">Autenticação 2FA</p>
              </div>
              <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded">Ativado</span>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Bell className="text-primary size-5" />
            <h2 className="text-lg font-bold font-headline">Notificações</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 border flex flex-col items-center gap-2 text-center hover:bg-muted/30 transition-colors cursor-pointer group">
              <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Mail className="size-5" />
              </div>
              <p className="text-sm font-bold">Alertas E-mail</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase leading-tight">Status & Relatórios</p>
              <button className="mt-2 text-xs font-black text-primary uppercase">Configurar</button>
            </Card>
            <Card className="p-4 border flex flex-col items-center gap-2 text-center hover:bg-muted/30 transition-colors cursor-pointer group">
              <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <BellRing className="size-5" />
              </div>
              <p className="text-sm font-bold">Alertas Push</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase leading-tight">Novos Pedidos</p>
              <button className="mt-2 text-xs font-black text-primary uppercase">Configurar</button>
            </Card>
          </div>
        </section>

        {/* Transmissão Message Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Megaphone className="text-primary size-5" />
            <h2 className="text-lg font-bold font-headline">Aviso Geral (Transmissão)</h2>
          </div>
          <Card className="p-4 shadow-sm border border-primary/20 bg-primary/5">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold">Comunicado para Todos</p>
                <p className="text-xs text-muted-foreground">Esta mensagem será enviada para o celular de todos os usuários.</p>
              </div>
              <Textarea 
                placeholder="Digite o aviso aqui:" 
                className="bg-background border-primary/10 min-h-[100px]"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
              />
              <Button 
                className="w-full font-bold gap-2" 
                disabled={isSendingBroadcast || !broadcastMessage.trim()}
                onClick={handleSendBroadcast}
              >
                {isSendingBroadcast ? <Loader2 className="animate-spin size-4" /> : <Send className="size-4" />}
                Enviar para Todos os Usuários
              </Button>
            </div>
          </Card>
        </section>

        <section className="pt-6 border-t">
            <Button 
                variant="outline" 
                className="w-full py-7 rounded-2xl text-base font-bold border-destructive/20 text-destructive hover:bg-destructive/5 active:scale-95 transition-all" 
                onClick={handleLogout}
            >
                <LogOut className="mr-2 size-5" />
                Sair do Sistema
            </Button>
            <p className="text-center text-[10px] text-muted-foreground mt-8 uppercase tracking-widest font-black opacity-30">
                Lucas Expresso v1.0.0 • Admin Central
            </p>
        </section>
      </main>
    </div>
  );
}

function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'outline', className?: string }) {
    return (
        <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight",
            variant === 'default' ? "bg-primary text-primary-foreground" : "border text-muted-foreground",
            className
        )}>
            {children}
        </span>
    )
}
