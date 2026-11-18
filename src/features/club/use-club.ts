import { useCallback } from 'react';

import { useBackend } from '@/app/services';
import { useWatch, type Watched } from '@/app/use-watch';
import type {
  ClubSettings,
  Cycle,
  CycleId,
  MemberId,
  Nomination,
  NominationId,
  OwnAnswer,
} from '@/domain/types';
import type { MemberProfile, Subscriber } from '@/services/backend';

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

/**
 * The member's own nomination: while nominations are open, the only one they
 * can read. Null when they have none.
 */
export function useOwnNomination(
  cycleId: CycleId,
  nominationId: NominationId | null,
): Watched<Nomination | null> {
  const { club } = useBackend();
  const watch = useCallback(
    (s: Subscriber<Nomination | null>) => {
      if (nominationId === null) {
        s.next(null);
        return () => undefined;
      }
      return club.watchOwnNomination(cycleId, nominationId, s);
    },
    [club, cycleId, nominationId],
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

/** Members' public profiles: name and photo, never the email. */
export function useMemberProfiles(): Watched<MemberProfile[]> {
  const { club } = useBackend();
  const watch = useCallback((s: Subscriber<MemberProfile[]>) => club.watchMembers(s), [club]);
  return useWatch(watch);
}

/** How many members "everyone" is. */
export function useSettings(): Watched<ClubSettings> {
  const { club } = useBackend();
  const watch = useCallback((s: Subscriber<ClubSettings>) => club.watchSettings(s), [club]);
  return useWatch(watch);
}

/** The member count once known; zero while loading or not set up. */
export function useMemberCount(): number {
  const settings = useSettings();
  return settings.status === 'ready' ? settings.value.members : 0;
}

export function useHasFinished(cycleId: CycleId, uid: MemberId): Watched<boolean> {
  const { club } = useBackend();
  const watch = useCallback(
    (s: Subscriber<boolean>) => club.watchHasFinished(cycleId, uid, s),
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
