import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Backend, SessionUser } from '@/services/backend';

import type { Session, SessionState } from './session';

const FALLBACK_NAME = 'Leitor';

/**
 * Follows the signed-in user and checks them against the allowlist:
 * a pending email link first, then the session restored on this device.
 */
export function useSessionState(backend: Backend): Session {
  const { auth, club } = backend;
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const resolveAccess = useCallback(
    async (user: SessionUser, isCurrent: () => boolean) => {
      setState({ status: 'checking', user });
      try {
        const access = await auth.checkAccess(user);
        if (!isCurrent()) return;
        if (access.status === 'denied') {
          setState({ status: 'denied', user });
          return;
        }
        setState({ status: 'member', user, isAdmin: access.isAdmin });
        const name = user.name.trim() || FALLBACK_NAME;
        void club
          .saveProfile({ uid: user.uid, name, photoURL: user.photoURL })
          .catch(() => undefined);
      } catch {
        if (isCurrent()) setState({ status: 'error', user });
      }
    },
    [auth, club],
  );

  useEffect(() => {
    let active = true;
    let linkPending = true;
    let signedOut = false;
    const isCurrent = () => active;
    // "Signed out" waits for the link check, so opening a link never flashes the sign-in page.
    const settleSignedOut = () => {
      if (active && signedOut && !linkPending) setState({ status: 'signed-out' });
    };

    void auth
      .completeSignInLink()
      .catch(() => 'not-a-link' as const)
      .then((result) => {
        linkPending = false;
        if (active && result === 'needs-email') setState({ status: 'needs-email' });
        else settleSignedOut();
      });

    let resolvedUid: string | null = null;
    const unsubscribe = auth.watchUser((user) => {
      signedOut = user === null;
      // The same account announced again needs no second allowlist check.
      if (user?.uid === resolvedUid) return;
      resolvedUid = user?.uid ?? null;
      if (user) void resolveAccess(user, isCurrent);
      else settleSignedOut();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth, resolveAccess, attempt]);

  const actions = useMemo(
    () => ({
      signInWithGoogle: () => auth.signInWithGoogle(),
      sendSignInLink: (email: string) => auth.sendSignInLink(email),
      confirmLinkEmail: async (email: string) => {
        await auth.completeSignInLink(email);
      },
      signOut: () => auth.signOut(),
      retry: () => {
        setAttempt((n) => n + 1);
      },
    }),
    [auth],
  );

  return useMemo(() => ({ state, actions }), [state, actions]);
}
