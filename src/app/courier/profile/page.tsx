
'use client';

import { ArrowLeft, LogOut, User, Wallet, SlidersHorizontal, Lock, ChevronRight, Settings, Edit, Star, Loader2, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useRef, useState } from 'react';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';


import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useUser, useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function CourierProfilePage() {
    const { user, userProfile, loading } = useUser();
    const { app, auth, firestore } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleLogout = async () => {
        if (auth) {
            try {
                await auth.signOut();
                toast({
                    title: "Desconectado",
                    description: "Você foi desconectado com sucesso.",
                });
                router.push('/login');
            } catch (error) {
                 toast({
                    title: "Erro ao sair",
                    description: "Não foi possível fazer logout. Tente novamente.",
                    variant: "destructive"
                });
            }
        }
    };
    
    const handleEditPhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return;
        }
        const file = event.target.files[0];
        if (!user || !app || !firestore) return;

        setIsUploading(true);
        try {
            const filePath = `profile-pictures/${user.uid}/${file.name}`;
            const fileRef = storageRef(getStorage(app), filePath);

            const uploadResult = await uploadBytes(fileRef, file);
            const photoURL = await getDownloadURL(uploadResult.ref);

            const userDocRef = doc(firestore, 'users', user.uid);
            await updateDoc(userDocRef, {
                photoURL: photoURL
            });

            toast({
                title: "Foto de perfil atualizada!",
                description: "Sua nova foto foi salva com sucesso.",
            });
        } catch (error) {
            console.error("Error uploading photo: ", error);
            toast({
                title: "Erro ao enviar foto",
                description: "Não foi possível atualizar sua foto de perfil. Tente novamente.",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
        }
    };


    const accountLinks = [
        { href: "/courier/profile/edit", icon: User, title: "Informações Pessoais", description: "Nome, telefone e detalhes do veículo" },
        { href: "/courier/profile/payment", icon: Wallet, title: "Métodos de Pagamento", description: "Chaves PIX e informações bancárias" },
        { href: "/courier/profile/preferences", icon: SlidersHorizontal, title: "Preferências do App", description: "Modo escuro e notificações" },
        { href: "/courier/profile/security", icon: Lock, title: "Segurança", description: "Senha e acesso biométrico" },
    ];

    const isDeviceRegistered = !!userProfile?.fcmToken;

    return (
        <>
            <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/courier">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="text-lg font-bold tracking-tight font-headline">Perfil</h1>
                 <Button variant="ghost" size="icon">
                    <Settings />
                </Button>
            </header>

            <main className="flex-1 overflow-y-auto pb-32">
                <section className="p-6 flex flex-col items-center">
                    {loading ? (
                        <>
                            <Skeleton className="size-32 rounded-full" />
                            <Skeleton className="h-7 w-40 mt-4" />
                            <Skeleton className="h-5 w-56 mt-2" />
                            <Skeleton className="h-7 w-32 mt-2" />
                        </>
                    ) : (
                        <>
                            <div className="relative">
                                <Avatar className="size-32 border-4 border-primary/20">
                                     {isUploading ? (
                                        <div className="flex items-center justify-center h-full w-full bg-background/50">
                                            <Loader2 className="size-8 animate-spin text-primary" />
                                        </div>
                                    ) : (
                                        <>
                                            {userProfile?.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName || 'Courier'} />}
                                            <AvatarFallback className="text-5xl bg-slate-300 dark:bg-slate-700">{userProfile?.displayName?.charAt(0) || 'C'}</AvatarFallback>
                                        </>
                                    )}
                                </Avatar>
                                <Button size="icon" className="absolute bottom-1 right-1 h-8 w-8 border-2 border-background" onClick={handleEditPhotoClick} disabled={isUploading}>
                                    <Edit className="size-4" />
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="image/png, image/jpeg"
                                    disabled={isUploading}
                                />
                            </div>
                            <h2 className="text-2xl font-bold mt-4 tracking-tight text-center font-headline">{userProfile?.displayName}</h2>
                            <p className="text-sm text-muted-foreground mt-1 text-center">
                                {userProfile?.userType} • Ativo desde {userProfile?.createdAt ? format(userProfile.createdAt.toDate(), 'yyyy') : 'N/A'}
                            </p>
                            <div className="flex items-center gap-1 mt-2 bg-primary/10 px-3 py-1 rounded-full">
                                <Star className="size-4 text-primary" fill="currentColor" />
                                <p className="text-primary text-sm font-bold leading-none">4.9</p>
                                <p className="text-muted-foreground text-xs font-normal leading-none ml-1">(124 avaliações)</p>
                            </div>
                        </>
                    )}
                </section>

                {/* Device Registration Status Indicator */}
                <section className="px-4 mb-4">
                    <Card className={cn(
                        "p-4 border-none shadow-sm flex items-center gap-4",
                        isDeviceRegistered ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                    )}>
                        <div className={cn(
                            "size-10 rounded-xl flex items-center justify-center",
                            isDeviceRegistered ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                        )}>
                            {isDeviceRegistered ? <Smartphone className="size-5" /> : <AlertCircle className="size-5" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold leading-none">
                                {isDeviceRegistered ? "Aparelho Conectado" : "Notificações Desligadas"}
                            </p>
                            <p className="text-[10px] opacity-80 mt-1 font-medium">
                                {isDeviceRegistered 
                                    ? "Você receberá alertas de novas tarefas mesmo com o celular bloqueado."
                                    : "Permita as notificações para não perder pedidos da central."}
                            </p>
                        </div>
                        {isDeviceRegistered && <CheckCircle2 className="size-4 text-emerald-500" />}
                    </Card>
                </section>
                
                <section className="px-4 py-2">
                    <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest px-2 pb-3 pt-4">Gerenciamento da Conta</h3>
                    <div className="flex flex-col gap-px bg-card rounded-xl overflow-hidden border">
                        {accountLinks.map((link, index) => (
                             <Link key={link.title} href={link.href} className="flex items-center gap-4 px-4 min-h-[72px] hover:bg-muted/50 transition-colors group">
                                <div className="flex items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 size-11">
                                    <link.icon className="size-5" />
                                </div>
                                <div className={`flex-1 flex-col justify-center py-4 ${index < accountLinks.length - 1 ? 'border-b' : ''}`}>
                                    <p className="text-base font-semibold leading-none">{link.title}</p>
                                    <p className="text-muted-foreground text-xs font-normal mt-1.5">{link.description}</p>
                                </div>
                                <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="px-6 py-8">
                     <Button variant="outline" className="w-full h-14 text-base font-bold text-red-500 hover:text-red-500 hover:bg-red-500/10 border-red-500/20" onClick={handleLogout}>
                        <LogOut className="mr-2" />
                        Sair
                    </Button>
                    <p className="text-center text-muted-foreground/60 text-xs mt-6">Versão do App 1.0.0 • Construído para Excelência do Entregador</p>
                </section>
            </main>
        </>
    );
}
