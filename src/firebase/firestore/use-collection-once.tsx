'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  getDocs,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';

type WithId<T> = T & { id: string };

export interface UseCollectionOnceResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

function getQueryCacheKey(query: Query<DocumentData>): string {
  try {
    const internal = query as unknown as { _query?: unknown };
    return `taskme:cache:once:${JSON.stringify(internal._query)}`;
  } catch {
    return 'taskme:cache:once:default';
  }
}

function readCached<T>(key: string): WithId<T>[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WithId<T>[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCached<T>(key: string, value: WithId<T>[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

/**
 * React hook to fetch a Firestore collection or query once (single read).
 * Unlike useCollection, this does NOT set up a real-time listener.
 * Use for views where real-time updates are not needed to save on read costs.
 */
export function useCollectionOnce<T = unknown>(
  memoizedQuery: Query<DocumentData> | null | undefined,
): UseCollectionOnceResult<T> {
  const initialCacheKey = memoizedQuery ? getQueryCacheKey(memoizedQuery) : null;
  const initialCachedData = initialCacheKey ? readCached<T>(initialCacheKey) : null;

  const [data, setData] = useState<WithId<T>[] | null>(initialCachedData);
  const [isLoading, setIsLoading] = useState(!!memoizedQuery && !initialCachedData);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = getQueryCacheKey(memoizedQuery);
    const cachedData = readCached<T>(cacheKey);
    if (cachedData && cachedData.length > 0) {
      setData(cachedData);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    setError(null);

    getDocs(memoizedQuery)
      .then((snapshot) => {
        const results = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        setData(results);
        writeCached<T>(cacheKey, results);
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
