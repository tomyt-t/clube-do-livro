import { useCallback, useEffect, useState } from 'react';

import { useBackend } from '@/app/services';
import { useWatch, type Watched } from '@/app/use-watch';
import type { AllowlistEntry, Subscriber } from '@/services/backend';
import { describeError } from '@/ui/describe-error';

/** The allowlist, readable only by the organizer. */
export function useAllowlist(): Watched<AllowlistEntry[]> {
  const { admin } = useBackend();
  const watch = useCallback((s: Subscriber<AllowlistEntry[]>) => admin.watchAllowlist(s), [admin]);
  return useWatch(watch);
}

/**
 * Keeps "everyone" in step with the allowlist: whenever the organizer has
 * this page open and the two disagree, the count is corrected.
 */
export function useMemberCountSync(listed: number | null, counted: number | null) {
  const { admin } = useBackend();
  useEffect(() => {
    if (listed === null || counted === null || listed === counted || listed === 0) return;
    admin.setMemberCount(listed).catch(() => {
      // Tried again on the next change; nothing else depends on it right now.
    });
  }, [admin, listed, counted]);
}

/** Runs one organizer action at a time, with a readable error if it fails. */
export function useAction() {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setState({ busy: true, error: null });
    try {
      await action();
      setState({ busy: false, error: null });
      return true;
    } catch (error) {
      setState({ busy: false, error: describeError(error) });
      return false;
    }
  };

  const reset = () => {
    setState({ busy: false, error: null });
  };

  return { ...state, run, reset };
}
