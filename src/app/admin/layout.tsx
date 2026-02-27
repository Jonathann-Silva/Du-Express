
'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { MobileLayout } from '@/components/MobileLayout';
import { AdminNav } from '@/components/nav/AdminNav';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { doc, writeBatch, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { requestPermissionAndSaveToken } from '@/firebase/messaging';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, userProfile } = useUser();
  const firestore = useFirestore();
  const { auth } = useAuth();
  const statusUpdateRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setAdminStatus = useCallback(async (online: boolean) => {
    const uid = auth?.currentUser?.uid;
    if (!firestore || !uid) return;
    
    try {
        const userDocRef = doc(firestore, 'users', uid);
        const statusDocRef = doc(firestore, 'status', 'main');
        
        const batch = writeBatch(firestore);
        batch.set(userDocRef, { status: online ? 'online' : 'offline' }, { merge: true });
        batch.set(statusDocRef, { 
            adminOnline: online,
            lastUpdated: serverTimestamp(),
        }, { merge: true });

        await batch.commit();
    } catch (serverError: any) {
        if (serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: 'status/main',
                operation: 'update',
                requestResourceData: { adminOnline: online }
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    }
  }, [firestore, auth]);

  useEffect(() => {
    if (user && userProfile?.role === 'admin') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!statusUpdateRef.current) {
        setAdminStatus(true);
        statusUpdateRef.current = true;
        // REGISTRA O APARELHO DO ADMIN
        requestPermissionAndSaveToken(user.uid);
      }

      const q = query(collection(firestore, 'deliveries'), where('status', '==', 'pending'));
      const unsubscribeDeliveries = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            if (Notification.permission === 'granted') {
              new Notification('📦 Novo Pedido!', {
                body: 'Uma nova solicitação de entrega chegou na central.',
                icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTtaP08iz-rJqKpD5XRwlvQotlrKLxFlYHXw&s',
                vibrate: [200, 100, 200]
              });
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
              audio.play().catch(() => {});
            }
          }
        });
      });

      const handleUnload = () => {
        setAdminStatus(false);
      };
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        unsubscribeDeliveries();
        timeoutRef.current = setTimeout(() => {
          setAdminStatus(false);
          statusUpdateRef.current = false;
        }, 5000);
      };
    }
  }, [user?.uid, userProfile?.role, setAdminStatus, firestore]);

  return (
    <MobileLayout>
      {children}
      <AdminNav />
    </MobileLayout>
  );
}
