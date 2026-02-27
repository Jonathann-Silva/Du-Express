'use client';

import { useMemo } from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export function CourierName({ courierId }: { courierId: string }) {
    const firestore = useFirestore();
    const userRef = useMemo(() => (
        firestore ? doc(firestore, 'users', courierId) : null
    ), [firestore, courierId]);
    const { data: userProfile, loading } = useDoc<UserProfile>(userRef);

    if (loading) {
        return <Skeleton className="h-4 w-24 inline-block" />;
    }

    return <>{userProfile?.displayName || 'N/A'}</>;
}
