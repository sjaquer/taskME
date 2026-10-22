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

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedTargetRefOrQuery);
  const [fromCache, setFromCache] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const queryPath = getQueryPath(memoizedTargetRefOrQuery);
    setIsLoading(true);
    setError(null);

    // Firestore usa su caché persistente (IndexedDB): el primer snapshot llega
    // desde el dispositivo aunque no haya conexión.
    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const snapshotDoc of snapshot.docs) {
          results.push({ ...(snapshotDoc.data() as T), id: snapshotDoc.id });
        }
        setData(results);
        setFromCache(snapshot.metadata.fromCache);
        setError(null);
        setIsLoading(false);
      },
      () => {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: queryPath,
        });

        setError(contextualError);
        setData(null);
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
