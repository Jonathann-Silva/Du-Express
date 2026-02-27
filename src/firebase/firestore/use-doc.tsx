'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, DocumentReference, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useDoc<T>(ref: DocumentReference | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ref) {
        setData(null);
        setLoading(false);
        return;
    };
    setLoading(true);

    const unsubscribe = onSnapshot(
      ref,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...snapshot.data(), id: snapshot.id, uid: snapshot.id } as unknown as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        if (err.message.includes('permission-denied') || err.message.includes('insufficient permissions')) {
            const permissionError = new FirestorePermissionError({
                path: ref.path,
                operation: 'get', // 'get' for doc queries
            });
            errorEmitter.emit('permission-error', permissionError);
            setError(permissionError);
        } else {
            console.error("useDoc snapshot error:", err);
            setError(err);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]); // Re-run effect if ref path changes

  return { data, loading, error };
}
