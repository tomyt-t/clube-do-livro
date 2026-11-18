import { createContext, useContext } from 'react';

import type { SessionUser } from '@/services/backend';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  /** The page was opened from a sign-in link on another device. */
  | { status: 'needs-email' }
  | { status: 'checking'; user: SessionUser }
  | { status: 'denied'; user: SessionUser; taken: boolean }
  | { status: 'member'; user: SessionUser; isAdmin: boolean }
  | { status: 'error'; user: SessionUser | null };

export interface SessionActions {
  signInWithGoogle: () => Promise<void>;
  sendSignInLink: (email: string) => Promise<void>;
  confirmLinkEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}

export interface Session {
  state: SessionState;
  actions: SessionActions;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionContext ausente: use <SessionProvider>.');
  return session;
}

export interface Member {
  user: SessionUser;
  isAdmin: boolean;
}

/** The signed-in member. Only valid inside `<SessionGate>`. */
export function useMember(): Member {
  const { state } = useSession();
  if (state.status !== 'member') throw new Error('useMember fora de uma sessão de membro.');
  return { user: state.user, isAdmin: state.isAdmin };
}
