import type { ReactNode } from 'react';

import { useBackend } from '@/app/services';

import { SessionContext } from './session';
import { useSessionState } from './useSessionState';

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionState(useBackend());
  return <SessionContext value={session}>{children}</SessionContext>;
}
