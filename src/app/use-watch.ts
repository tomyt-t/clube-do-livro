import { useEffect, useState } from 'react';

import type { BackendError, Subscriber, Unsubscribe } from '@/services/backend';

export type Watch<T> = (subscriber: Subscriber<T>) => Unsubscribe;

export type Watched<T> =
  { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; error: BackendError };

const LOADING = { status: 'loading' } as const;

interface Snapshot<T> {
  source: Watch<T>;
  watched: Watched<T>;
}

/**
 * Follows a live backend value. Pass a stable `watch` (from `useCallback`):
 * a new one starts over from "loading".
 */
export function useWatch<T>(watch: Watch<T>): Watched<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);

  useEffect(
    () =>
      watch({
        next: (value) => {
          setSnapshot({ source: watch, watched: { status: 'ready', value } });
        },
        error: (error) => {
          setSnapshot({ source: watch, watched: { status: 'error', error } });
        },
      }),
    [watch],
  );

  return snapshot?.source === watch ? snapshot.watched : LOADING;
}
