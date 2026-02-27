"use client"

import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, Plus, Search, Loader2, Mail, Lock, Cog, Wallet, Building, Bike, MapPin } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, setDoc, serverTimestamp, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { ScrollArea } from "@/components/ui/scroll-area";


const userFormSchema = z.object({
    displayName: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
    email: z.string().email({ message: "Por favor, insira um email válido." }),
    password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
    role: z.enum(["client", "courier"], {
        required_error: "Você deve selecionar um tipo de usuário.",
    }),
    userType: z.string().min(3, { message: "O ramo/tipo de veículo deve ter pelo menos 3 caracteres." }),
    street: z.string().optional(),
    number: z.string().optional(),
    neighborhood: z.string().optional(),
    status: z.enum(['online', 'offline']).default('online'),
}).superRefine((data, ctx) => {
    if (data.role === 'client') {
        if (!data.street || data.street.trim().length < 3) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A rua é obrigatória.",
                path: ['street'],
            });
        }
        if (!data.number || data.number.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "O número é obrigatório.",
                path: ['number'],
            });
        }
        if (!data.neighborhood || data.neighborhood.trim().length < 3) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "O bairro é obrigatório.",
                path: ['neighborhood'],
            });
        }
    }
});


type UserFormData = z.infer<typeof userFormSchema>;


export default function UserManagementPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user, userProfile, loading: userProfileLoading } = useUser();
    
    const [roleToCreate, setRoleToCreate] = useState<'client' | 'courier' | null>(null);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    
    const [currentRate, setCurrentRate] = useState<string>('');
    const [currentCondoRateGoldemItalian, setCurrentCondoRateGoldemItalian] = useState<string>('');
    const [currentCondoRateMonteRey, setCurrentCondoRateMonteRey] = useState<string>('');
    
    const [rateAricanduva, setRateAricanduva] = useState<string>('');
    const [rateApucarana, setRateApucarana] = useState<string>('');
    const [rateSabaudia, setRateSabaudia] = useState<string>('');
    const [rateRolandia, setRateRolandia] = useState<string>('');
    const [rateLondrina, setRateLondrina] = useState<string>('');

    const [currentAddress, setCurrentAddress] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);

    const [allUsers, setAllUsers] = useState<UserProfile[] | null>(null);
    const [collectionLoading, setCollectionLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !userProfile || userProfile.role !== 'admin') {
            if (userProfile && userProfile.role !== 'admin') {
                setAllUsers([]);
                setCollectionLoading(false);
            }
            return;
        };

        setCollectionLoading(true);
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const usersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as UserProfile));
                setAllUsers(usersData);
                setCollectionLoading(false);
            },
            (error) => {
                const permissionError = new FirestorePermissionError({
                    path: 'users',
                    operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
                setCollectionLoading(false);
            }
        );

        return () => unsubscribe();
    }, [firestore, userProfile]);


    const isAdmin = userProfile?.role === 'admin';
    const isLoading = userProfileLoading || (isAdmin && allUsers === null);


    const users = useMemo(() => {
        if (!allUsers || !user) return [];
        return allUsers.filter(u => u.uid !== user.uid);
    }, [allUsers, user?.uid]);

    const clients = useMemo(() => users.filter(u => u.role === 'client'), [users]);
    const couriers = useMemo(() => users.filter(u => u.role === 'courier'), [users]);
    
    async function handleAddUser(data: UserFormData) {
        if (!firestore) {
            toast({ title: "Erro de sistema", description: "Serviço de banco de dados indisponível.", variant: "destructive" });
            return;
        }

        const tempAppName = `user-creation-${Date.now()}`;
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            const userCredential = await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
            const authUser = userCredential.user;

            let address = '';
            if (data.role === 'client' && data.street && data.number && data.neighborhood) {
                address = `${data.street}, ${data.number} - ${data.neighborhood}`;
            }
            
            const userDocRef = doc(firestore, "users", authUser.uid);
            const newUserProfile = {
                uid: authUser.uid,
                displayName: data.displayName,
                email: data.email,
                role: data.role,
                userType: data.userType,
                status: data.status,
                createdAt: serverTimestamp(),
                photoURL: '',
                address: address,
                deliveryRate: 0,
                condoRateGoldemItalian: 0,
                condoRateMonteRey: 0,
                rateAricanduva: 0,
                rateApucarana: 0,
                rateSabaudia: 0,
                rateRolandia: 0,
                rateLondrina: 0,
            };

            setDoc(userDocRef, newUserProfile)
                .then(() => {
                    toast({
                        title: "Usuário Adicionado!",
                        description: `${data.displayName} foi adicionado com sucesso.`,
                    });
                    setRoleToCreate(null);
                })
                .catch((serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: userDocRef.path,
                        operation: 'create',
                        requestResourceData: newUserProfile,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });

        } catch (error: any) {
            let description = "Ocorreu um erro desconhecido na autenticação.";
            if (error.code === 'auth/email-already-in-use') {
                description = "Este e-mail já está em uso por outra conta.";
            } else if (error.code === 'auth/weak-password') {
                description = "A senha é muito fraca. Use pelo menos 6 caracteres.";
            }
            toast({ title: "Erro ao Criar Autenticação", description, variant: "destructive" });
        } finally {
            await deleteApp(tempApp);
        }
    }
    
    const handleStatusChange = async (user: UserProfile, isOnline: boolean) => {
        if (!firestore) return;
        const userDocRef = doc(firestore, 'users', user.uid);
        const data = { status: isOnline ? 'online' : 'offline' };
        
        updateDoc(userDocRef, data)
            .then(() => {
                toast({
                    title: 'Status Atualizado',
                    description: `O status de ${user.displayName} foi atualizado.`,
                });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleOpenEditModal = (user: UserProfile) => {
        setSelectedUser(user);
        setCurrentRate(user.deliveryRate?.toString() || '');
        setCurrentCondoRateGoldemItalian(user.condoRateGoldemItalian?.toString() || '');
        setCurrentCondoRateMonteRey(user.condoRateMonteRey?.toString() || '');
        
        setRateAricanduva(user.rateAricanduva?.toString() || '');
        setRateApucarana(user.rateApucarana?.toString() || '');
        setRateSabaudia(user.rateSabaudia?.toString() || '');
        setRateRolandia(user.rateRolandia?.toString() || '');
        setRateLondrina(user.rateLondrina?.toString() || '');

        setCurrentAddress(user.address || '');
        setIsEditModalOpen(true);
    };

    const handleUpdateUser = async () => {
        if (!firestore || !selectedUser) return;

        const parseRate = (val: string) => val ? parseFloat(val) : 0;

        setIsUpdating(true);
        const userDocRef = doc(firestore, 'users', selectedUser.uid);
        const updateData = {
            deliveryRate: parseRate(currentRate),
            condoRateGoldemItalian: parseRate(currentCondoRateGoldemItalian),
            condoRateMonteRey: parseRate(currentCondoRateMonteRey),
            rateAricanduva: parseRate(rateAricanduva),
            rateApucarana: parseRate(rateApucarana),
            rateSabaudia: parseRate(rateSabaudia),
            rateRolandia: parseRate(rateRolandia),
            rateLondrina: parseRate(rateLondrina),
            address: currentAddress,
        };

        updateDoc(userDocRef, updateData)
            .then(() => {
                toast({
                    title: "Usuário Atualizado!",
                    description: `Os detalhes para ${selectedUser.displayName} foram atualizados.`,
                });
                setIsEditModalOpen(false);
                setSelectedUser(null);
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: updateData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsUpdating(false);
            });
    };


    return (
    <>
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center justify-between px-4 h-16">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin"><ArrowLeft/></Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight font-headline">Usuários</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="icon" className="rounded-full">
                    <Plus />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRoleToCreate('client')}>
                    <Building className="mr-2" />
                    <span>Novo Cliente (Loja)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRoleToCreate('courier')}>
                    <Bike className="mr-2" />
                    <span>Novo Entregador</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        <Tabs defaultValue="clients" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="clients">Clientes (Lojas)</TabsTrigger>
                <TabsTrigger value="couriers">Entregadores (Motoboys)</TabsTrigger>
            </TabsList>
            <div className="py-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                    <Input className="h-12 pl-11 pr-4 rounded-xl text-base" placeholder="Buscar por nome ou ID"/>
                </div>
            </div>
            <TabsContent value="clients">
                <UserList users={clients} onStatusChange={handleStatusChange} onEditUser={handleOpenEditModal} isLoading={isLoading}/>
            </TabsContent>
            <TabsContent value="couriers">
                <UserList users={couriers} onStatusChange={handleStatusChange} onEditUser={handleOpenEditModal} isLoading={isLoading}/>
            </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!roleToCreate} onOpenChange={(isOpen) => !isOpen && setRoleToCreate(null)}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
            <DialogTitle>Adicionar Novo {roleToCreate === 'client' ? 'Cliente' : 'Entregador'}</DialogTitle>
            <DialogDescription>
                Preencha os detalhes abaixo para criar um novo {roleToCreate === 'client' ? 'cliente (loja)' : 'entregador'}.
            </DialogDescription>
            </DialogHeader>
            {roleToCreate && <AddUserForm onSubmit={handleAddUser} role={roleToCreate} />}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-md max-h-[90dvh]">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl">Ajustar Detalhes do Usuário</DialogTitle>
            {selectedUser && <DialogDescription>Defina valores para {selectedUser.displayName}</DialogDescription>}
          </DialogHeader>
          <ScrollArea className="pr-4 py-4 max-h-[60dvh]">
            <div className="space-y-6">
                
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Taxas Arapongas</h3>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rate-normal">Taxa de Entrega Padrão</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">R$</span>
                            <Input id="rate-normal" type="number" step="0.01" placeholder="0.00" value={currentRate} onChange={(e) => setCurrentRate(e.target.value)} className="pl-9" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rate-condo-gi">Taxa Cond. (Goldem/Italian Ville)</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">R$</span>
                            <Input id="rate-condo-gi" type="number" step="0.01" placeholder="0.00" value={currentCondoRateGoldemItalian} onChange={(e) => setCurrentCondoRateGoldemItalian(e.target.value)} className="pl-9" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rate-condo-mr">Taxa Cond. (Monte Rey / Bem Viver)</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">R$</span>
                            <Input id="rate-condo-mr" type="number" step="0.01" placeholder="0.00" value={currentCondoRateMonteRey} onChange={(e) => setCurrentCondoRateMonteRey(e.target.value)} className="pl-9" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Taxas Regionais</h3>
                    
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rate-aricanduva">Aricanduva</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">R$</span>
                            <Input id="rate-aricanduva" type="number" step="0.01" placeholder="0.00" value={rateAricanduva} onChange={(e) => setRateAricanduva(e.target.value)} className="pl-9" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rate-apucarana">Apucarana</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">R$</span>
                            <Input id="rate-apucarana" type="number" step="0.01" placeholder="0.00" value={rateApucarana} onChange={(e) => setRateApucarana(e.target.value)} className="pl-9" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rate-sabaudia">Sabáudia</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">R$</span>
                            <Input id="rate-sabaudia" type="number" step="0.01" placeholder="0.00" value={rateSabaudia} onChange={(e) => setRateSabaudia(e.target.value)} className="pl-9" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rate-rolandia">Rolândia</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">R$</span>
                            <Input id="rate-rolandia" type="number" step="0.01" placeholder="0.00" value={rateRolandia} onChange={(e) => setRateRolandia(e.target.value)} className="pl-9" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rate-londrina">Londrina</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">R$</span>
                            <Input id="rate-londrina" type="number" step="0.01" placeholder="0.00" value={rateLondrina} onChange={(e) => setRateLondrina(e.target.value)} className="pl-9" />
                        </div>
                    </div>
                </div>

                {selectedUser?.role === 'client' && (
                    <div className="flex flex-col gap-1.5 pt-4 border-t">
                        <Label htmlFor="address">Endereço da Loja</Label>
                        <Textarea id="address" placeholder="Rua, Número, Bairro, Cidade..." value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} />
                    </div>
                )}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleUpdateUser} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    )
}

function AddUserForm({ onSubmit, role }: { onSubmit: (data: UserFormData) => Promise<void>; role: 'client' | 'courier' }) {
    const form = useForm<UserFormData>({
        resolver: zodResolver(userFormSchema),
        defaultValues: {
            displayName: "",
            email: "",
            password: "",
            role: role,
            userType: "",
            street: "",
            number: "",
            neighborhood: "",
            status: 'online',
        },
    });

    const { isSubmitting } = form.formState;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome Completo / Nome da Loja</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Burger Barn HQ" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email de Acesso</FormLabel>
                             <FormControl>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                                    <Input type="email" placeholder="usuario@email.com" className="pl-10" {...field} />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                                    <Input type="password" placeholder="Mínimo 6 caracteres" className="pl-10" {...field} />
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
                            <FormLabel>{role === 'courier' ? 'Tipo de Veículo' : 'Ramo do Negócio'}</FormLabel>
                            <FormControl>
                                <Input placeholder={role === 'courier' ? "Ex: Moto Honda CG 160" : "Ex: Fast Food"} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {role === 'client' && (
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="street"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rua</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Rua de Coleta" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número</FormLabel>
                                        <FormControl>
                                            <Input placeholder="123" {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="neighborhood"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bairro</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Centro" {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                )}
                 <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-4!">
                        <div className="space-y-0.5">
                        <FormLabel>Status</FormLabel>
                        <FormDescription>
                            Define se o usuário começa como online ou offline.
                        </FormDescription>
                        </div>
                        <FormControl>
                        <Switch
                            checked={field.value === 'online'}
                            onCheckedChange={(checked) => field.onChange(checked ? 'online' : 'offline')}
                        />
                        </FormControl>
                    </FormItem>
                    )}
                />
                <DialogFooter className="pt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>
                            Cancelar
                        </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="animate-spin mr-2" />}
                        {isSubmitting ? 'Adicionando...' : 'Adicionar Usuário'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

function UserList({ users, onStatusChange, onEditUser, isLoading }: {
    users: UserProfile[], 
    onStatusChange: (user: UserProfile, isOnline: boolean) => void,
    onEditUser: (user: UserProfile) => void,
    isLoading: boolean
}) {
    if (isLoading) {
       return (
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                   <Skeleton className="h-5 w-48" />
               </div>
                <div className="space-y-3">
                   <Skeleton className="h-20 w-full rounded-2xl" />
                   <Skeleton className="h-20 w-full rounded-2xl" />
               </div>
           </div>
       )
   }

    const onlineUsers = users.filter((u) => u.status === 'online');
    const offlineUsers = users.filter((u) => u.status !== 'online');

    const UserCard = ({ user }: { user: UserProfile }) => (
        <Card key={user.uid} className="p-4 flex items-center gap-4 rounded-2xl shadow-sm">
            <div className="relative">
                <Avatar className="w-14 h-14 rounded-xl">
                {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || ''} />}
                <AvatarFallback
                    className={cn(
                    user.status === 'online' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    'font-bold text-xl'
                    )}
                >
                    {user.displayName?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                </AvatarFallback>
                </Avatar>
                <div
                    className={cn(
                        'absolute -bottom-1 -right-1 w-4 h-4 border-2 border-background rounded-full',
                        user.status === 'online' ? "bg-green-500" : "bg-slate-400"
                    )}
                ></div>
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground truncate font-headline">{user.displayName}</h3>
                 <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 mt-1">
                    {user.userType && <span className="font-medium text-slate-500">{user.userType}</span>}
                    
                    {user.role === 'client' && (
                        <>
                            {(user.deliveryRate ?? 0) > 0 && <span className="bg-primary/5 px-1.5 rounded text-primary font-bold">Pad: {user.deliveryRate?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                            {(user.rateAricanduva ?? 0) > 0 && <span className="bg-primary/5 px-1.5 rounded text-primary font-bold">Ari: {user.rateAricanduva?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                            {(user.rateApucarana ?? 0) > 0 && <span className="bg-primary/5 px-1.5 rounded text-primary font-bold">Apu: {user.rateApucarana?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                            {(user.rateSabaudia ?? 0) > 0 && <span className="bg-primary/5 px-1.5 rounded text-primary font-bold">Sab: {user.rateSabaudia?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                            {(user.rateRolandia ?? 0) > 0 && <span className="bg-primary/5 px-1.5 rounded text-primary font-bold">Rol: {user.rateRolandia?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                            {(user.rateLondrina ?? 0) > 0 && <span className="bg-primary/5 px-1.5 rounded text-primary font-bold">Lon: {user.rateLondrina?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                        </>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Switch
                checked={user.status === 'online'}
                onCheckedChange={(isChecked) => onStatusChange(user, isChecked)}
                />
                <Button variant="ghost" size="icon" onClick={() => onEditUser(user)}>
                    <Cog className="text-muted-foreground size-5" />
                </Button>
            </div>
        </Card>
    );

    if (users.length === 0) {
        return (
            <div className="text-center py-10 border rounded-2xl">
                <p className="font-semibold">Nenhum usuário encontrado</p>
                <p className="text-muted-foreground text-sm mt-1">Adicione um novo usuário para começar.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {onlineUsers.length > 0 && (
                <div className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Online ({onlineUsers.length})
                </h2>
                <div className="space-y-3">
                    {onlineUsers.map((user) => (
                    <UserCard key={user.uid} user={user} />
                    ))}
                </div>
                </div>
            )}

            {offlineUsers.length > 0 && (
                <div className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Offline ({offlineUsers.length})
                </h2>
                <div className="space-y-3">
                    {offlineUsers.map((user) => (
                    <UserCard key={user.uid} user={user} />
                    ))}
                </div>
                </div>
            )}
        </div>
    );
}
