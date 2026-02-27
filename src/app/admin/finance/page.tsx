'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Search, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { NotificationsPopover } from "@/components/notifications";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { FinanceGuard } from "@/components/FinanceGuard";

export default function FinancialControlPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const { userProfile, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const clientsQuery = useMemo(() => {
        if (!firestore || !userProfile || userProfile.role !== 'admin') return null;
        return query(collection(firestore, 'users'), where('role', '==', 'client'));
    }, [firestore, userProfile?.uid, userProfile?.role]);

    const [clients, setClients] = useState<UserProfile[] | null>(null);
    const [clientsLoading, setClientsLoading] = useState(true);

    useEffect(() => {
        if (clientsQuery) {
            setClientsLoading(true);
            getDocs(clientsQuery)
                .then(snapshot => {
                    const clientsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as UserProfile));
                    setClients(clientsData);
                })
                .catch(async (serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: 'users',
                        operation: 'list',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    setClients([]);
                })
                .finally(() => setClientsLoading(false));
        } else {
            setClients([]);
            setClientsLoading(false);
        }
    }, [clientsQuery]);

    const filteredClients = useMemo(() => {
        if (!clients) {
            return [];
        }
        return clients.filter(client => 
            client && client.uid && (!searchQuery || client.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [clients, searchQuery]);

    const isLoading = userLoading || clientsLoading;

    return (
        <FinanceGuard>
            <header className="sticky top-0 z-20 flex items-center justify-between bg-background/80 backdrop-blur-md px-4 py-4 border-b">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin">
                            <ArrowLeft />
                        </Link>
                    </Button>
                    <h1 className="text-lg font-bold tracking-tight font-headline">Receita por Loja</h1>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationsPopover />
                    <Avatar className="size-9">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">AD</AvatarFallback>
                    </Avatar>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-32">
                <section className="px-4 py-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold font-headline">Lojas Ativas</h3>
                            <p className="text-[11px] text-muted-foreground">{isLoading ? 'Buscando...' : `${filteredClients.length} lojas encontradas`}</p>
                        </div>
                    </div>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                        <Input 
                            className="pl-10" 
                            placeholder="Buscar loja..." 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="space-y-3">
                        {isLoading && (
                            <>
                                <Skeleton className="h-24 w-full rounded-2xl" />
                                <Skeleton className="h-24 w-full rounded-2xl" />
                                <Skeleton className="h-24 w-full rounded-2xl" />
                            </>
                        )}
                        {!isLoading && filteredClients.map(store => (
                            <Link key={store.uid} href={`/admin/finance/${store.uid}`} className="block active:scale-[0.98] transition-transform">
                                <Card className="p-4 rounded-2xl hover:border-primary transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="size-14 rounded-lg">
                                            {store.photoURL && <AvatarImage src={store.photoURL} alt={store.displayName || ''} />}
                                            <AvatarFallback className="text-xl font-bold bg-muted text-muted-foreground">
                                                {store.displayName?.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold leading-tight">{store.displayName}</h3>
                                            <p className="text-xs text-muted-foreground">{store.userType}</p>
                                        </div>
                                        <ChevronRight className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                    </div>
                                </Card>
                            </Link>
                        ))}
                         {!isLoading && filteredClients.length === 0 && (
                            <div className="text-center py-10 border rounded-2xl">
                                <p className="font-semibold">Nenhuma loja encontrada</p>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {searchQuery ? 'Tente uma busca diferente.' : "Adicione novos clientes na aba 'Usuários'."}
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </FinanceGuard>
    );
}
