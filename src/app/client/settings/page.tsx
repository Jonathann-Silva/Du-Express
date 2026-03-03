'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  LogOut, 
  Wallet, 
  Store, 
  ShieldCheck, 
  Bell, 
  Mail, 
  Lock, 
  ChevronRight, 
  Loader2, 
  CheckCircle2,
  PackageCheck,
  Camera,
  Edit,
  Link as LinkIcon,
  Smartphone,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const storeSettingsSchema = z.object({
  displayName: z.string().min(3, "Nome muito curto"),
  cnpj: z.string().optional(),
  address: z.string().min(5, "Endereço necessário"),
});

type StoreSettingsData = z.infer<typeof storeSettingsSchema>;

export default function ClientSettingsPage() {
    const { user, userProfile, loading: userLoading } = useUser();
    const { auth } = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [monthlySpend, setMonthlySpend] = useState(0);
    const [loadingSpend, setLoadingSpend] = useState(true);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
    const [tempPhotoURL, setTempPhotoURL] = useState('');

    const form = useForm<StoreSettingsData>({
        resolver: zodResolver(storeSettingsSchema),
        values: {
            displayName: userProfile?.displayName || '',
            cnpj: userProfile?.cnpj || '',
            address: userProfile?.address || '',
        }
    });

    useEffect(() => {
        if (userProfile?.photoURL) {
            setTempPhotoURL(userProfile.photoURL);
        }
    }, [userProfile?.photoURL]);

    // Calcula gasto mensal
    useEffect(() => {
        if (!firestore || !user?.uid) return;
        
        const fetchMonthlySpend = async () => {
            const startOfCurrentMonth = startOfMonth(new Date());
            const q = query(
                collection(firestore, 'deliveries'),
                where('clientId', '==', user.uid),
                where('status', '==', 'finished'),
                where('createdAt', '>=', startOfCurrentMonth)
            );
            
            try {
                const snap = await getDocs(q);
                const total = snap.docs.reduce((acc, d) => acc + (d.data().price || 0), 0);
                setMonthlySpend(total);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingSpend(false);
            }
        };

        fetchMonthlySpend();
    }, [firestore, user?.uid]);

    const handleUpdatePhotoURL = async () => {
        if (!user?.uid || !firestore) return;
        setIsSaving(true);
        
        try {
            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, { photoURL: tempPhotoURL });
            
            toast({
                title: "Foto Atualizada",
                description: "O link da imagem da sua loja foi salvo.",
            });
            setIsPhotoDialogOpen(false);
        } catch (error) {
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível atualizar o link da imagem.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateProfile = async (data: StoreSettingsData) => {
        if (!user?.uid || !firestore) return;
        setIsSaving(true);
        
        try {
            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, {
                displayName: data.displayName,
                cnpj: data.cnpj,
                address: data.address
            });
            
            toast({
                title: "Configurações Salvas",
                description: "As informações da sua loja foram atualizadas.",
            });
        } catch (error) {
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível atualizar os dados.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!auth || !user?.email) return;
        
        setIsSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, user.email);
            toast({
                title: "E-mail Enviado!",
                description: `Um link de redefinição de senha foi enviado para ${user.email}. Verifique sua caixa de entrada.`,
            });
            setIsPasswordDialogOpen(false);
        } catch (error: any) {
            console.error("Erro ao enviar reset de senha:", error);
            toast({
                title: "Erro ao enviar e-mail",
                description: "Não foi possível processar sua solicitação agora. Tente novamente mais tarde.",
                variant: "destructive"
            });
        } finally {
            setIsSendingReset(false);
        }
    };

    const handleLogout = async () => {
        if (auth) {
            try {
                await auth.signOut();
                toast({ title: "Desconectado" });
                router.push('/login');
            } catch (error) {
                 toast({ title: "Erro ao sair", variant: "destructive" });
            }
        }
    };

    if (userLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="size-24 rounded-full" />
                    <Skeleton className="h-6 w-48" />
                </div>
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    const isDeviceRegistered = !!userProfile?.fcmToken;

    return (
        <div className="flex flex-col h-full bg-background">
            <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-4 flex items-center justify-between">
                <Button variant="ghost" size="icon" className="rounded-full" asChild>
                    <Link href="/client">
                        <ArrowLeft className="size-5" />
                    </Link>
                </Button>
                <h1 className="text-lg font-bold tracking-tight font-headline">Ajustes da Loja</h1>
                <div className="size-10" />
            </header>

            <main className="flex-1 overflow-y-auto pb-32">
                {/* Profile Header */}
                <section className="p-6 flex flex-col items-center text-center">
                    <div className="relative">
                        <Avatar className="size-24 border-4 border-primary/20 shadow-xl">
                            {userProfile?.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName || ''} />}
                            <AvatarFallback className="text-3xl bg-primary/10 text-primary font-bold">
                                {userProfile?.displayName?.charAt(0) || 'L'}
                            </AvatarFallback>
                        </Avatar>
                        
                        <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
                            <DialogTrigger asChild>
                                <Button 
                                    size="icon" 
                                    variant="outline" 
                                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border shadow-sm bg-background hover:bg-muted p-0"
                                >
                                    <Camera className="size-4 text-primary" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-[90vw] rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle>Link da Logomarca</DialogTitle>
                                    <DialogDescription>
                                        Cole abaixo o link (URL) da imagem da sua loja para economizar espaço em disco.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="photo-url">URL da Imagem</Label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                            <Input 
                                                id="photo-url" 
                                                placeholder="https://exemplo.com/logo.png" 
                                                className="pl-10"
                                                value={tempPhotoURL}
                                                onChange={(e) => setTempPhotoURL(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {tempPhotoURL && (
                                        <div className="flex flex-col items-center gap-2 p-4 border rounded-xl bg-muted/30">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Prévia</p>
                                            <img src={tempPhotoURL} alt="Preview" className="size-20 object-contain rounded-lg border bg-white" />
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsPhotoDialogOpen(false)}>Cancelar</Button>
                                    <Button onClick={handleUpdatePhotoURL} disabled={isSaving}>
                                        {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
                                        Salvar Link
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <h2 className="text-xl font-bold mt-4 font-headline leading-tight">{userProfile?.displayName}</h2>
                    <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-widest">
                        Desde {userProfile?.createdAt ? format(userProfile.createdAt.toDate(), 'MMMM yyyy', { locale: ptBR }) : '2024'}
                    </p>
                    <div className="mt-3">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-tighter border border-primary/20">
                            Cliente Verificado
                        </span>
                    </div>
                </section>

                {/* Device Registration Status Indicator */}
                <section className="px-4 mb-8">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <Smartphone className="size-4 text-primary" />
                        <h3 className="text-base font-bold font-headline">Status do Dispositivo</h3>
                    </div>
                    <Card className={cn(
                        "p-4 border-none shadow-sm flex items-center gap-4",
                        isDeviceRegistered ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                    )}>
                        <div className={cn(
                            "size-10 rounded-xl flex items-center justify-center",
                            isDeviceRegistered ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                        )}>
                            {isDeviceRegistered ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold leading-none">
                                {isDeviceRegistered ? "Notificações Ativas" : "Registro Pendente"}
                            </p>
                            <p className="text-[10px] opacity-80 mt-1 font-medium">
                                {isDeviceRegistered 
                                    ? "Este celular está configurado para receber alertas de pedidos e chats."
                                    : "Clique em permitir notificações no seu navegador para habilitar alertas."}
                            </p>
                        </div>
                    </Card>
                </section>

                {/* Financial Overview */}
                <section className="px-4 mb-8">
                    <Card className="bg-primary/5 border-primary/10 shadow-none rounded-2xl overflow-hidden">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <Wallet className="size-4" />
                                </div>
                                <h3 className="font-bold text-sm uppercase tracking-wider">Visão Financeira</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-primary/5">
                                    <span className="text-xs text-muted-foreground font-medium">Taxa de Entrega Ativa</span>
                                    <span className="text-sm font-black text-primary">
                                        {userProfile?.deliveryRate?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground font-medium">Gasto Mensal (Est.)</span>
                                        <span className="text-[10px] text-muted-foreground/60 italic font-normal">Somente entregas finalizadas</span>
                                    </div>
                                    <span className="text-lg font-black text-foreground">
                                        {loadingSpend ? '...' : monthlySpend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Store Profile Form */}
                <section className="px-4 mb-8">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <Store className="size-4 text-primary" />
                        <h3 className="text-base font-bold font-headline">Perfil do Negócio</h3>
                    </div>
                    <form onSubmit={form.handleSubmit(handleUpdateProfile)} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="displayName" className="ml-1 text-xs font-bold text-muted-foreground uppercase tracking-widest">Nome da Loja</Label>
                            <Input 
                                id="displayName" 
                                {...form.register('displayName')} 
                                className="h-12 rounded-xl bg-card border-muted-foreground/10 focus:border-primary"
                            />
                            {form.formState.errors.displayName && <p className="text-[10px] text-destructive font-bold">{form.formState.errors.displayName.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cnpj" className="ml-1 text-xs font-bold text-muted-foreground uppercase tracking-widest">CNPJ / CPF</Label>
                            <Input 
                                id="cnpj" 
                                placeholder="00.000.000/0001-00"
                                {...form.register('cnpj')} 
                                className="h-12 rounded-xl bg-card border-muted-foreground/10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address" className="ml-1 text-xs font-bold text-muted-foreground uppercase tracking-widest">Endereço de Coleta</Label>
                            <Textarea 
                                id="address" 
                                {...form.register('address')} 
                                className="rounded-xl bg-card border-muted-foreground/10 min-h-[100px] resize-none"
                            />
                            {form.formState.errors.address && <p className="text-[10px] text-destructive font-bold">{form.formState.errors.address.message}</p>}
                        </div>

                        <Button 
                            type="submit" 
                            disabled={isSaving} 
                            className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20 transition-all active:scale-95"
                        >
                            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 size-5" />}
                            SALVAR ALTERAÇÕES
                        </Button>
                    </form>
                </section>

                {/* Preferences */}
                <section className="px-4 mb-8">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <Bell className="size-4 text-primary" />
                        <h3 className="text-base font-bold font-headline">Preferências de Notificação</h3>
                    </div>
                    <Card className="rounded-2xl border-muted-foreground/10 shadow-none divide-y divide-muted-foreground/5 overflow-hidden">
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                                    <PackageCheck className="size-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Notificações Push</p>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase leading-tight">Status dos pedidos em tempo real</p>
                                </div>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                                    <Mail className="size-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Alertas por E-mail</p>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase leading-tight">Resumo diário de entregas</p>
                                </div>
                            </div>
                            <Switch />
                        </div>
                    </Card>
                </section>

                {/* Security & Logout */}
                <section className="px-4 mb-12">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <Lock className="size-4 text-primary" />
                        <h3 className="text-base font-bold font-headline">Segurança</h3>
                    </div>
                    <div className="space-y-3">
                        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-14 rounded-2xl border-muted-foreground/10 bg-card hover:bg-muted font-bold">
                                    <span className="flex items-center gap-3">
                                        <Lock className="size-4 text-muted-foreground" />
                                        Alterar Senha
                                    </span>
                                    <ChevronRight className="size-4 text-muted-foreground/50" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-[90vw] rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="font-headline">Redefinir Senha</DialogTitle>
                                    <DialogDescription>
                                        Para sua segurança, enviaremos um link de redefinição para o e-mail: <span className="font-bold text-foreground">{user?.email}</span>
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="flex flex-col gap-2">
                                    <Button onClick={handleResetPassword} disabled={isSendingReset} className="w-full h-12 font-bold">
                                        {isSendingReset ? <Loader2 className="animate-spin mr-2" /> : <Mail className="size-4 mr-2" />}
                                        Enviar link de recuperação
                                    </Button>
                                    <Button variant="ghost" onClick={() => setIsPasswordDialogOpen(false)} className="w-full">
                                        Cancelar
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        
                        <Button 
                            variant="outline" 
                            onClick={handleLogout}
                            className="w-full justify-between h-14 rounded-2xl border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive font-black"
                        >
                            <span className="flex items-center gap-3">
                                <LogOut className="size-4" />
                                Sair da Conta
                            </span>
                        </Button>
                    </div>
                </section>

                <p className="text-center text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest pb-10">
                    Lucas Expresso v0.0.9 • Parceiro Comercial
                </p>
            </main>
        </div>
    );
}