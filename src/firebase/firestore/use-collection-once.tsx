'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  getDocs,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export interface UseCollectionOnceResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * React hook to fetch a Firestore collection or query once (single read).
 * Unlike useCollection, this does NOT set up a real-time listener.
 * Use for views where real-time updates are not needed to save on read costs.
 */
export function useCollectionOnce<T = unknown>(
  memoizedQuery: Query<DocumentData> | null | undefined,
): UseCollectionOnceResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getDocs(memoizedQuery)
      .then((snapshot) => {
        const results = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        setData(results);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err);
        setData(null);
        setIsLoading(false);
      });
  }, [memoizedQuery]);

  return { data, isLoading, error };
}
