'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Package, Wallet, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, query, where, orderBy } from 'firebase/firestore';

import { useUser, useFirestore, useCollection } from '@/firebase';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const iconMap: Record<Notification['icon'], React.ReactNode> = {
  package: <Package className="size-5 text-blue-500" />,
  wallet: <Wallet className="size-5 text-green-500" />,
  alert: <AlertTriangle className="size-5 text-red-500" />,
};

const bgColorMap: Record<Notification['icon'], string> = {
    package: 'bg-blue-500/10',
    wallet: 'bg-green-500/10',
    alert: 'bg-red-500/10',
}


export default function AdminNotificationsPage() {
    const { user, userProfile } = useUser();
    const firestore = useFirestore();

    const notificationsQuery = useMemo(() => {
        if (!firestore || !user || userProfile?.role !== 'admin') return null;
        return query(
            collection(firestore, 'notifications'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user, userProfile]);

    const { data: notifications, loading } = useCollection<Notification>(notificationsQuery);

    return (
        <>
            <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b px-4 py-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="text-lg font-semibold tracking-tight font-headline">Todas as Notificações</h1>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {loading && (
                    <>
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                    </>
                )}
                {!loading && notifications && notifications.length > 0 ? (
                    notifications.map(notification => (
                        <Card
                            key={notification.id}
                            className={cn(
                                "flex items-start gap-4 p-4 transition-colors",
                                !notification.read && "bg-primary/5 border-primary/10"
                            )}
                        >
                            <div className={cn("size-10 rounded-full flex items-center justify-center shrink-0 mt-1", bgColorMap[notification.icon])}>
                                {iconMap[notification.icon]}
                            </div>
                            <div className="flex-1">
                                <p className={cn("font-semibold text-sm leading-tight", !notification.read && "text-primary")}>{notification.title}</p>
                                <p className="text-xs text-muted-foreground">{notification.description}</p>
                                <p className="text-[10px] text-muted-foreground/70 mt-1">
                                {notification.createdAt ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : ''}
                                </p>
                            </div>
                            {!notification.read && (
                                <div className="size-2.5 bg-primary rounded-full mt-1.5 self-start shrink-0"></div>
                            )}
                        </Card>
                    ))
                ) : (!loading &&
                    <div className="text-center py-10 border rounded-2xl">
                        <Bell className="mx-auto text-muted-foreground size-12 mb-4" />
                        <p className="font-semibold">Nenhuma notificação</p>
                        <p className="text-muted-foreground text-sm mt-1">Você não tem nenhuma notificação ainda.</p>
                    </div>
                )}
            </main>
        </>
    )
}
