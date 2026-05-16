'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean; // True if loading.
  fromCache: boolean; // True if data is from local cache.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    };
  };
}

function getQueryPath(target: CollectionReference<DocumentData> | Query<DocumentData>): string {
  return target.type === 'collection'
    ? (target as CollectionReference<DocumentData>).path
    : (target as unknown as InternalQuery)._query.path.canonicalString();
}

function getQuerySignature(target: CollectionReference<DocumentData> | Query<DocumentData>): string {
  if (target.type === 'collection') return (target as CollectionReference<DocumentData>).path;

  const internal = target as unknown as { _query?: unknown };
  try {
    return JSON.stringify(internal._query) || getQueryPath(target);
  } catch {
    return getQueryPath(target);
  }
}

function getCollectionCacheKey(signature: string): string {
  return `taskme:cache:collection:${signature}`;
}

function readCachedCollection<T>(signature: string): WithId<T>[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getCollectionCacheKey(signature));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WithId<T>[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedCollection<T>(signature: string, data: WithId<T>[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getCollectionCacheKey(signature), JSON.stringify(data));
  } catch {
    // Ignore localStorage quota and serialization errors.
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidance. Also make sure that its dependencies are stable references.
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = unknown>(
  memoizedTargetRefOrQuery:
    | ((CollectionReference<DocumentData> | Query<DocumentData>) & { __memo?: boolean })
    | null
    | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const initialSignature = memoizedTargetRefOrQuery ? getQuerySignature(memoizedTargetRefOrQuery) : null;
  const initialCachedData = initialSignature ? readCachedCollection<T>(initialSignature) : null;

  const [data, setData] = useState<StateDataType>(initialCachedData);
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedTargetRefOrQuery && !initialCachedData);
  const [fromCache, setFromCache] = useState<boolean>(!!initialCachedData);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const queryPath = getQueryPath(memoizedTargetRefOrQuery);
    const querySignature = getQuerySignature(memoizedTargetRefOrQuery);
    const cachedData = readCachedCollection<T>(querySignature);

    if (cachedData && cachedData.length > 0) {
      setData(cachedData);
      setIsLoading(false);
      setFromCache(true);
    } else {
      setIsLoading(true);
      setFromCache(false);
    }

    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const snapshotDoc of snapshot.docs) {
          results.push({ ...(snapshotDoc.data() as T), id: snapshotDoc.id });
        }
        setData(results);
        writeCachedCollection<T>(querySignature, results);
        setFromCache(snapshot.metadata.fromCache); // Use Firestore's own cache indicator if available
        setError(null);
        setIsLoading(false);
      },
      () => {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: queryPath,
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
  }, [memoizedTargetRefOrQuery]);

  if (memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, fromCache, error };
}
