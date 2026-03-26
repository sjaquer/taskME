'use client';

import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean; // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

function getDocCacheKey(path: string): string {
  return `taskme:cache:doc:${path}`;
}

function readCachedDoc<T>(path: string): WithId<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getDocCacheKey(path));
    if (!raw) return null;
    return JSON.parse(raw) as WithId<T>;
  } catch {
    return null;
  }
}

function writeCachedDoc<T>(path: string, data: WithId<T>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getDocCacheKey(path), JSON.stringify(data));
  } catch {
    // Ignore localStorage quota and serialization errors.
  }
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidance. Also make sure that its dependencies are stable references.
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = unknown>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const initialCachedData = memoizedDocRef ? readCachedDoc<T>(memoizedDocRef.path) : null;

  const [data, setData] = useState<StateDataType>(initialCachedData);
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedDocRef && !initialCachedData);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cachedData = readCachedDoc<T>(memoizedDocRef.path);
    if (cachedData) {
      setData(cachedData);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    setError(null);

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          const nextData = { ...(snapshot.data() as T), id: snapshot.id };
          setData(nextData);
          writeCachedDoc<T>(memoizedDocRef.path, nextData);
        } else {
          // Document does not exist.
          setData(null);
        }
        setError(null);
        setIsLoading(false);
      },
      () => {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });

        setError(contextualError);
        if (!cachedData) {
          setData(null);
        }
        setIsLoading(false);

        // Trigger global error propagation.
        errorEmitter.emit('permission-error', contextualError);
      },
    );

    return () => unsubscribe();
  }, [memoizedDocRef]);

  return { data, isLoading, error };
}
