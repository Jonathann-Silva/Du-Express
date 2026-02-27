'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, User as UserIcon, Bike, Camera, Loader2, Phone, CaseSensitive } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const profileFormSchema = z.object({
  displayName: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  userType: z.string().min(3, { message: "O modelo do veículo deve ter pelo menos 3 caracteres." }),
  phone: z.string().optional(),
  licensePlate: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function EditCourierProfilePage() {
  const { user, userProfile, loading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    values: {
        displayName: userProfile?.displayName || '',
        userType: userProfile?.userType || '',
        phone: '', // This field is not in the database model yet.
        licensePlate: '', // This field is not in the database model yet.
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!user || !firestore) {
      toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const userDocRef = doc(firestore, 'users', user.uid);

    try {
      await updateDoc(userDocRef, {
        displayName: data.displayName,
        userType: data.userType,
        // Not updating phone and licensePlate as they are not in the model.
      });
      toast({
        title: 'Perfil Atualizado!',
        description: 'Suas informações foram salvas com sucesso.',
      });
      router.back();
    } catch (serverError: any) {
      const permissionError = new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update',
        requestResourceData: {
          displayName: data.displayName,
          userType: data.userType,
        },
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        title: 'Erro ao Salvar',
        description: 'Não foi possível atualizar seu perfil. Verifique suas permissões.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (loading) {
      return (
          <>
            <header className="sticky top-0 z-10 flex items-center bg-background/80 backdrop-blur-md p-4 pb-2 border-b">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/courier/profile"><ArrowLeft /></Link>
                </Button>
                <h2 className="text-lg font-bold leading-tight flex-1 text-center pr-12">Informações Pessoais</h2>
            </header>
            <main className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="size-32 rounded-full" />
                    <Skeleton className="h-7 w-40" />
                </div>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-14 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-14 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-14 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-14 w-full" /></div>
                </div>
            </main>
          </>
      )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 flex items-center bg-background/80 backdrop-blur-md p-4 pb-2 border-b">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/courier/profile">
            <ArrowLeft />
          </Link>
        </Button>
        <h2 className="text-lg font-bold leading-tight flex-1 text-center pr-12 font-headline">Informações Pessoais</h2>
      </header>
      <main className="flex-1 overflow-y-auto">
        <section className="flex p-6">
          <div className="flex w-full flex-col gap-4 items-center">
            <div className="relative">
                <Avatar className="size-32 border-4 border-primary/20">
                    {userProfile?.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName || 'Courier'} />}
                    <AvatarFallback className="text-5xl bg-slate-300 dark:bg-slate-700">{userProfile?.displayName?.charAt(0) || 'C'}</AvatarFallback>
                </Avatar>
                <Button size="icon" className="absolute bottom-0 right-0 h-10 w-10 border-4 border-background">
                    <Camera />
                </Button>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
                <h2 className="text-2xl font-bold tracking-tight font-headline">{userProfile?.displayName}</h2>
                <p className="text-sm text-muted-foreground">Entregador Ativo desde {userProfile?.createdAt ? new Date(userProfile.createdAt.toDate()).getFullYear() : 'N/A'}</p>
            </div>
          </div>
        </section>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 py-2 space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="px-1">Nome Completo</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                      <Input placeholder="Seu nome completo" className="pl-12 py-6 rounded-xl" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="px-1">Telefone</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                      <Input type="tel" placeholder="+55 11 98765-4321" className="pl-12 py-6 rounded-xl" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="userType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="px-1">Modelo do Veículo</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Bike className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                      <Input placeholder="Ex: Honda CG 160" className="pl-12 py-6 rounded-xl" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="licensePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="px-1">Placa</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <CaseSensitive className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                      <Input placeholder="BRA-2E19" className="pl-12 py-6 rounded-xl" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-6 pb-24 px-4">
              <Button type="submit" disabled={isSaving || loading} className="w-full py-6 rounded-xl font-bold text-base shadow-lg shadow-primary/25 transition-all active:scale-95">
                {isSaving ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
