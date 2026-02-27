'use client';

import { useMemo } from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function CourierInfo({ courierId, status }: { courierId?: string, status: string }) {
    const firestore = useFirestore();
    const courierRef = useMemo(() => (
        firestore && courierId ? doc(firestore, 'users', courierId) : null
    ), [firestore, courierId]);
    const { data: courierProfile, loading } = useDoc<UserProfile>(courierRef);
    
    const courierAvatar = PlaceHolderImages.find(p => p.id === 'courier-john-doe');

    if (loading) {
        return (
            <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium leading-none">Entregador</p>
                    <Skeleton className="h-4 w-24 mt-1" />
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex items-center gap-3">
          <Avatar className={cn("size-8 rounded-full", !courierProfile && "bg-muted")}>
            {courierProfile && courierAvatar ? (
              <AvatarImage src={courierProfile.photoURL || courierAvatar.imageUrl} alt={courierProfile.displayName || 'courier'} data-ai-hint={courierAvatar.imageHint} className={cn(status === 'finished' && 'grayscale')} />
            ) : (
                <AvatarFallback className="bg-transparent">
                    <UserX className="text-muted-foreground" />
                </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium leading-none">Entregador</p>
            <p className={cn("text-sm font-semibold", !courierProfile && "text-muted-foreground italic")}>
              {courierProfile ? courierProfile.displayName : 'Não atribuído'}
            </p>
          </div>
        </div>
    );
}
