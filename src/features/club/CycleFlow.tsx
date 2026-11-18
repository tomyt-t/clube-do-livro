import { useEffect, useRef } from 'react';

import { useBackend } from '@/app/services';
import { nextFlowStep } from '@/domain/flow';
import { useMember } from '@/features/auth/session';
import { advance } from '@/services/election';

import { useCycles, useMemberCount } from './use-club';

/**
 * Moves the cycle along from any member's device: when everyone has
 * answered, voted or finished the book, the next step happens here. If two
 * devices try at once, the server accepts only the first; the other's
 * refusal is expected and ignored, and the live data shows the result.
 */
export function CycleFlow() {
  const backend = useBackend();
  const { isAdmin } = useMember();
  const cycles = useCycles();
  const members = useMemberCount();
  const attempted = useRef<string | null>(null);

  const step = cycles.status === 'ready' ? nextFlowStep(cycles.value, members) : null;
  const key = step && `${step.kind}:${step.cycle.id}`;

  useEffect(() => {
    if (!step || cycles.status !== 'ready' || attempted.current === key) return;
    attempted.current = key;
    advance(backend, step, cycles.value, { canFlag: isAdmin }).catch(() => {
      // Someone else took the step first, or it is no longer ready: let the
      // next change try again.
      attempted.current = null;
    });
  }, [backend, cycles, isAdmin, key, step]);

  return null;
}
