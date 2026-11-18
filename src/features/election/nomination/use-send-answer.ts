import { useState } from 'react';

import { useBackend } from '@/app/services';
import type { CycleId, MemberId, NominationAnswer } from '@/domain/types';
import { describeError } from '@/ui/describe-error';

import { useTitleCheck } from './use-title-check';

interface Sending {
  busy: boolean;
  error: string | null;
}

/** Sends the member's final answer; the page follows it through the live answer. */
export function useSendAnswer(cycleId: CycleId, uid: MemberId) {
  const { club } = useBackend();
  const checkTitle = useTitleCheck(cycleId);
  const [state, setState] = useState<Sending>({ busy: false, error: null });

  /** Someone may have nominated the same title since the member checked it. */
  const explain = async (error: unknown, answer: NominationAnswer) => {
    const taken = answer.kind === 'nominate' ? await checkTitle(answer.book.title) : null;
    return taken ?? describeError(error);
  };

  const send = async (answer: NominationAnswer) => {
    setState({ busy: true, error: null });
    try {
      await club.answerNominationCall({ cycleId, uid, answer });
      setState({ busy: false, error: null });
    } catch (error) {
      setState({ busy: false, error: await explain(error, answer) });
    }
  };

  const clearError = () => {
    setState((current) => ({ ...current, error: null }));
  };

  return { ...state, send, clearError };
}
