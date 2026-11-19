import { useState } from 'react';

import { useBackend } from '@/app/services';
import type { CycleId, MemberId, NominationAnswer } from '@/domain/types';
import { describeError } from '@/ui/describe-error';

interface Sending {
  busy: boolean;
  error: string | null;
}

/** Sends the member's final answer; the page follows it through the live answer. */
export function useSendAnswer(cycleId: CycleId, uid: MemberId) {
  const { club } = useBackend();
  const [state, setState] = useState<Sending>({ busy: false, error: null });

  /** True once the answer is recorded. */
  const send = async (answer: NominationAnswer): Promise<boolean> => {
    setState({ busy: true, error: null });
    try {
      await club.answerNominationCall({ cycleId, uid, answer });
      setState({ busy: false, error: null });
      return true;
    } catch (error) {
      setState({ busy: false, error: describeError(error) });
      return false;
    }
  };

  const clearError = () => {
    setState((current) => ({ ...current, error: null }));
  };

  return { ...state, send, clearError };
}
