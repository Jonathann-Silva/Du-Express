
'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, Query, DocumentData, QuerySnapshot } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useCollection<T>(query: Query | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
        setData(null);
        setLoading(false);
        return;
    }
    
    // Limpar dados anteriores ao trocar de consulta para evitar estado estático confuso
    setLoading(true);
    setData(null);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const result: T[] = [];
        snapshot.forEach((doc) => {
          result.push({ ...doc.data(), id: doc.id, uid: doc.id } as unknown as T);
        });
        setData(result);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        if (err.message.includes('permission-denied') || err.message.includes('insufficient permissions')) {
            const permissionError = new FirestorePermissionError({
                path: (query as any).path || 'collection',
                operation: 'list', // 'list' for collection queries
            });
            errorEmitter.emit('permission-error', permissionError);
            setError(permissionError);
        } else {
            console.error("useCollection snapshot error:", err);
            setError(err);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]); // Re-run effect if query object changes

  return { data, loading, error };
}
