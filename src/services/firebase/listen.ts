import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import type { Subscriber, Unsubscribe } from '../backend';

import { toBackendError } from './errors';

/** Pending server timestamps read as an estimate instead of null. */
const READ_OPTIONS = { serverTimestamps: 'estimate' } as const;

type Reader<T> = (id: string, data: DocumentData) => T | null;

function readAll<T>(docs: QueryDocumentSnapshot[], read: Reader<T>): T[] {
  const items: T[] = [];
  docs.forEach((doc) => {
    const item = read(doc.id, doc.data(READ_OPTIONS));
    if (item === null) console.warn(`Documento ignorado por estar malformado: ${doc.ref.path}`);
    else items.push(item);
  });
  return items;
}

export function listenToQuery<T>(
  query: Query,
  read: Reader<T>,
  subscriber: Subscriber<T[]>,
): Unsubscribe {
  return onSnapshot(
    query,
    (snapshot) => {
      subscriber.next(readAll(snapshot.docs, read));
    },
    (error) => {
      subscriber.error(toBackendError(error));
    },
  );
}

/**
 * Like `listenToQuery`, but only with results the server confirmed. A query
 * may first answer from the local cache with just the documents this tab
 * already read (say, the member's own allowlist entry): fine for display,
 * wrong for anything that counts them.
 */
export function listenToServerQuery<T>(
  query: Query,
  read: Reader<T>,
  subscriber: Subscriber<T[]>,
): Unsubscribe {
  return onSnapshot(
    query,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache) return;
      subscriber.next(readAll(snapshot.docs, read));
    },
    (error) => {
      subscriber.error(toBackendError(error));
    },
  );
}

export function listenToDoc<T>(
  ref: DocumentReference,
  read: (snapshot: DocumentSnapshot) => T,
  subscriber: Subscriber<T>,
): Unsubscribe {
  return onSnapshot(
    ref,
    (snapshot) => {
      subscriber.next(read(snapshot));
    },
    (error) => {
      subscriber.error(toBackendError(error));
    },
  );
}

export function dataOf(snapshot: DocumentSnapshot): DocumentData | null {
  return snapshot.exists() ? snapshot.data(READ_OPTIONS) : null;
}
