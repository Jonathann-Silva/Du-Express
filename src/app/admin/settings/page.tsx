'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
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
import { Badge } from '@/components/ui/badge';
import { sendPushNotification } from '@/services/push-notification';

export default function AdminSettingsPage() {
  const { userProfile: adminUser, loading: adminLoading } = useUser();
  const { auth } = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [newFinancePassword, setNewFinancePassword] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const [isSecurityVerified, setIsSecurityVerified] = useState(false);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [verifyError, setVerifyError] = useState(false);

  const [isTimeLimitModalOpen, setIsTimeLimitModalOpen] = useState(false);
  const [newTimeLimit, setNewTimeLimit] = useState(45);
  const [isUpdatingRules, setIsUpdatingRules] = useState(false);

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

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
    try {
      await setDoc(doc(firestore, 'settings', 'finance'), { 
        password: newFinancePassword,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "Senha Atualizada" });
      setIsPasswordModalOpen(false);
      setNewFinancePassword('');
      setIsSecurityVerified(false);
    } catch (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
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
      toast({ title: "Regra Atualizada" });
      setIsTimeLimitModalOpen(false);
    } catch (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setIsUpdatingRules(false);
    }
  };

  const handleToggleAutoCancel = async (checked: boolean) => {
    if (!firestore || !rulesRef) return;
    try {
      await setDoc(rulesRef, { autoCancel: checked, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: checked ? "Cancelamento Ativado" : "Cancelamento Desativado" });
    } catch (error) {
      toast({ title: "Erro ao atualizar regra", variant: "destructive" });
    }
  };

  const handleSendBroadcast = async () => {
    if (!firestore || !broadcastMessage.trim()) return;
    
    setIsSendingBroadcast(true);
    try {
      const usersSnap = await getDocs(collection(firestore, 'users'));
      const batch = writeBatch(firestore);
      
      const pushPromises: Promise<any>[] = [];

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

        if (userData.pushSubscription) {
          pushPromises.push(
            sendPushNotification(userData.pushSubscription, {
              title: 'Lucas Expresso',
              body: `📣 Aviso da Central: ${broadcastMessage}`,
              url: userData.role === 'client' ? '/client' : '/courier'
            })
          );
        }
      });

      await batch.commit();
      await Promise.allSettled(pushPromises);
      
      toast({
        title: "Aviso Enviado!",
        description: `Mensagem enviada para ${usersSnap.size} usuários registrados.`,
      });
      setBroadcastMessage('');
    } catch (error) {
      console.error(error);
      toast({ title: "Erro no Envio", variant: "destructive" });
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
                updateDoc(statusDocRef, { adminOnline: false, lastUpdated: serverTimestamp() }),
                updateDoc(userDocRef, { status: 'offline' })
            ]);
            await auth.signOut();
            router.push('/login');
        } catch (error) {
             await auth.signOut();
             router.push('/login');
        }
    }
  };
  
  const isLoading = adminLoading;
  const isDeviceRegistered = !!adminUser?.pushSubscription;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 py-4 border-b flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/admin"><ArrowLeft className="size-5" /></Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight font-headline">Configurações do Sistema</h1>
        <div className="size-10" />
      </header>

      <main className="flex-1 p-4 space-y-8 pb-32 overflow-y-auto">
        
        <section>
            <Card className="overflow-hidden border-none shadow-md bg-primary/5">
                <CardContent className="p-6 flex items-center gap-4">
                    {isLoading ? <Skeleton className="size-16 rounded-full" /> : (
                        <Avatar className="size-16 border-2 border-primary/20 shadow-sm">
                            {adminUser?.photoURL && <AvatarImage src={adminUser.photoURL} alt={adminUser.displayName || 'Admin'} />}
                            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{adminUser?.displayName?.charAt(0) || 'A'}</AvatarFallback>
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
                  {isDeviceRegistered ? "Webpush Ativo" : "Dispositivo não Registrado"}
                </p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {isDeviceRegistered 
                    ? "Este aparelho está pronto para receber notificações push mesmo com a tela bloqueada."
                    : "Permita as notificações no seu navegador para receber alertas via Webpush."}
                </p>
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
                </DialogHeader>
                <div className="py-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold">Duração Máxima</Label>
                    <span className="text-2xl font-black text-primary">{newTimeLimit} min</span>
                  </div>
                  <Slider min={10} max={120} step={5} value={[newTimeLimit]} onValueChange={(val) => setNewTimeLimit(val[0])} className="py-4"/>
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
              <Switch checked={rulesSetting?.autoCancel !== false} onCheckedChange={handleToggleAutoCancel} />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Megaphone className="text-primary size-5" />
            <h2 className="text-lg font-bold font-headline">Aviso Geral (Transmissão)</h2>
          </div>
          <Card className="p-4 shadow-sm border border-primary/20 bg-primary/5">
            <div className="space-y-4">
              <Textarea 
                placeholder="Digite o aviso aqui (ex: 'Sistema em manutenção'):" 
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
                Enviar para Todos via Webpush
              </Button>
            </div>
          </Card>
        </section>

        <section className="pt-6 border-t">
            <Button variant="outline" className="w-full py-7 rounded-2xl text-base font-bold border-destructive/20 text-destructive" onClick={handleLogout}>
                <LogOut className="mr-2 size-5" /> Sair do Sistema
            </Button>
        </section>
      </main>
    </div>
  );
}
