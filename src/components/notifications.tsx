'use client';

import { Bell, Package, Wallet, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const iconMap = {
  package: <Package className="size-5 text-blue-500" />,
  wallet: <Wallet className="size-5 text-green-500" />,
  alert: <AlertTriangle className="size-5 text-red-500" />,
};

const bgColorMap = {
    package: 'bg-blue-500/10',
    wallet: 'bg-green-500/10',
    alert: 'bg-red-500/10',
}

export function NotificationsPopover() {
  const { user, userProfile } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const notificationsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'notifications'), 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: notifications, loading } = useCollection<Notification>(notificationsQuery);
  
  const unreadCount = useMemo(() => notifications?.filter(n => !n.read).length || 0, [notifications]);

  const handleMarkAsRead = (notification: Notification) => {
    if (!firestore) return;
    const notifRef = doc(firestore, 'notifications', notification.id);
    if (!notification.read) {
        updateDoc(notifRef, { read: true })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: notifRef.path,
                    operation: 'update',
                    requestResourceData: { read: true },
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    }

    if (notification.link) {
      router.push(notification.link);
    }
  };
  
  const handleMarkAllAsRead = () => {
    if (!firestore || !notifications || unreadCount === 0) return;
    const batch = writeBatch(firestore);
    const unreadNotifications = notifications.filter(n => !n.read);

    unreadNotifications.forEach(n => {
        const notifRef = doc(firestore, 'notifications', n.id);
        batch.update(notifRef, { read: true });
    });
    
    batch.commit()
        .catch(serverError => {
            // Emitting one error is enough to show something is wrong.
            // We can point to the first failed doc path.
            const firstFailedPath = unreadNotifications.length > 0 ? doc(firestore, 'notifications', unreadNotifications[0].id).path : 'notifications';
            const permissionError = new FirestorePermissionError({
                path: firstFailedPath,
                operation: 'update',
                requestResourceData: { read: true },
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
             <span className="absolute top-0 right-0 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="p-4 border-b">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-base font-headline">Notificações</h4>
                {unreadCount > 0 && <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={handleMarkAllAsRead}>Marcar todas como lidas</Button>}
            </div>
        </div>
        <div className="p-2 max-h-96 overflow-y-auto">
            {loading && (
              <div className="space-y-3 p-1">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}
            {!loading && notifications && notifications.length > 0 ? (
                notifications.map(notification => (
                    <div 
                        key={notification.id}
                        className={cn(
                            "flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-muted/50 cursor-pointer",
                            !notification.read && "bg-blue-500/5"
                        )}
                        onClick={() => handleMarkAsRead(notification)}
                    >
                        <div className={cn("size-9 rounded-full flex items-center justify-center shrink-0 mt-1", bgColorMap[notification.icon])}>
                            {iconMap[notification.icon]}
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-sm leading-tight">{notification.title}</p>
                            <p className="text-xs text-muted-foreground">{notification.description}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {notification.createdAt ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : ''}
                            </p>
                        </div>
                        {!notification.read && (
                            <div className="size-2 bg-primary rounded-full mt-2 self-center"></div>
                        )}
                    </div>
                ))
            ) : (!loading &&
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma notificação nova.</p>
            )}
        </div>
        <div className="p-2 border-t text-center">
            {userProfile?.role === 'admin' ? (
                <Button variant="ghost" size="sm" className="text-xs w-full" asChild>
                    <Link href="/admin/notifications">Ver todas as notificações</Link>
                </Button>
            ) : (
                <Button variant="ghost" size="sm" className="text-xs w-full" disabled>
                    Ver todas as notificações
                </Button>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
