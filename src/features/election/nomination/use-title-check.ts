import { useCallback } from 'react';

import { useBackend } from '@/app/services';
import type { CycleId } from '@/domain/types';

import { TITLE_TAKEN } from './draft';

/**
 * Whether a title was already nominated this round: the message to show, or
 * null. A failed check lets the member go on; the server still refuses a
 * repeat, and sending then says why.
 */
export function useTitleCheck(cycleId: CycleId) {
  const { club } = useBackend();
  return useCallback(
    async (title: string): Promise<string | null> => {
      try {
        return (await club.isTitleTaken(cycleId, title)) ? TITLE_TAKEN : null;
      } catch {
        return null;
      }
    },
    [club, cycleId],
  );
}
