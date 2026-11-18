import { useState } from 'react';

import { useBackend } from '@/app/services';
import type { CycleId, MemberId, NominationId } from '@/domain/types';
import { describeError } from '@/ui/describe-error';

/** Casts the anonymous ballot; the page follows it through the live receipt. */
export function useCastBallot(cycleId: CycleId, uid: MemberId) {
  const { club } = useBackend();
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  const cast = async (choices: readonly NominationId[]) => {
    setState({ busy: true, error: null });
    try {
      await club.castBallot({ cycleId, uid, choices });
      setState({ busy: false, error: null });
    } catch (error) {
      setState({ busy: false, error: describeError(error) });
    }
  };

  return { ...state, cast };
}
