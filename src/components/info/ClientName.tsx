'use client';

import { useMemo } from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export function ClientName({ clientId }: { clientId: string }) {
    const firestore = useFirestore();
    const userRef = useMemo(() => (
        firestore ? doc(firestore, 'users', clientId) : null
    ), [firestore, clientId]);
    const { data: userProfile, loading } = useDoc<UserProfile>(userRef);

    if (loading) {
        return <Skeleton className="h-5 w-32" />;
    }

    return <>{userProfile?.displayName || 'Cliente Desconhecido'}</>;
}
