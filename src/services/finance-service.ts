'use client';

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Firestore,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { Transaction, FinanceContext } from '@/types/finance';

function getUserTransactionsRef(firestore: Firestore, userId: string): CollectionReference {
  return collection(firestore, 'users', userId, 'transactions');
}

function getTransactionDocRef(firestore: Firestore, userId: string, transactionId: string): DocumentReference {
  return doc(firestore, 'users', userId, 'transactions', transactionId);
}

export function buildTransactionsQuery(firestore: Firestore, userId: string, context?: FinanceContext) {
  // Traemos los últimos 90 días de transacciones para análisis histórico local
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  if (context) {
    return query(
      getUserTransactionsRef(firestore, userId),
      where('context', '==', context),
      where('date', '>=', ninetyDaysAgo.toISOString().split('T')[0]),
      orderBy('date', 'desc')
    );
  }

  return query(
    getUserTransactionsRef(firestore, userId),
    where('date', '>=', ninetyDaysAgo.toISOString().split('T')[0]),
    orderBy('date', 'desc')
  );
}

export function createTransaction(
  firestore: Firestore,
  userId: string,
  data: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
) {
  const colRef = getUserTransactionsRef(firestore, userId);
  return addDocumentNonBlocking(colRef, {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateTransaction(
  firestore: Firestore,
  userId: string,
  transactionId: string,
  data: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
) {
  const docRef = getTransactionDocRef(firestore, userId, transactionId);
  return updateDocumentNonBlocking(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function deleteTransaction(firestore: Firestore, userId: string, transactionId: string) {
  const docRef = getTransactionDocRef(firestore, userId, transactionId);
  return deleteDocumentNonBlocking(docRef);
}
