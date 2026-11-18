import { useCallback } from 'react';

import { useBackend } from '@/app/services';
import { useWatch, type Watched } from '@/app/use-watch';
import type { Cycle, CycleId, MemberId, Nomination, OwnAnswer } from '@/domain/types';
import type { Subscriber } from '@/services/backend';

/** Live club data shared by the pages. */

export function useCycles(): Watched<Cycle[]> {
  const { club } = useBackend();
  const watch = useCallback((s: Subscriber<Cycle[]>) => club.watchCycles(s), [club]);
  return useWatch(watch);
}

export function useNominations(cycleId: CycleId): Watched<Nomination[]> {
  const { club } = useBackend();
  const watch = useCallback(
    (s: Subscriber<Nomination[]>) => club.watchNominations(cycleId, s),
    [club, cycleId],
  );
  return useWatch(watch);
}

/** The member's own nomination answer for a cycle; only they can read it. */
export function useOwnAnswer(cycleId: CycleId, uid: MemberId): Watched<OwnAnswer | null> {
  const { club } = useBackend();
  const watch = useCallback(
    (s: Subscriber<OwnAnswer | null>) => club.watchOwnAnswer(cycleId, uid, s),
    [club, cycleId, uid],
  );
  return useWatch(watch);
}

export function useHasVoted(cycleId: CycleId, uid: MemberId): Watched<boolean> {
  const { club } = useBackend();
  const watch = useCallback(
    (s: Subscriber<boolean>) => club.watchHasVoted(cycleId, uid, s),
    [club, cycleId, uid],
  );
  return useWatch(watch);
}
