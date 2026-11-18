import type { AuthPort, SessionUser } from '../backend';

import { pause, personaByUid, type DemoContext } from './context';
import type { DemoPersona } from './state';

export interface DemoAuthPort extends AuthPort {
  /** Demo only: switch the signed-in persona to try the club as someone else. */
  signInAs(uid: string): void;
}

function toUser(persona: DemoPersona | null): SessionUser | null {
  if (!persona) return null;
  return { uid: persona.uid, email: persona.email, name: persona.name, photoURL: null };
}

export function createDemoAuth(context: DemoContext, defaultPersona: string): DemoAuthPort {
  const signInAs = (uid: string) => {
    context.store.update((state) => {
      state.session = uid;
    });
  };

  return {
    watchUser: (listener) =>
      context.store.watch(
        (state) => state.session,
        (uid) => {
          listener(toUser(personaByUid(context, uid)));
        },
      ),

    signInWithGoogle: async () => {
      await pause(context);
      signInAs(defaultPersona);
    },

    // The demo sends no email; the persona switcher stands in for the link.
    sendSignInLink: async () => {
      await pause(context);
    },

    completeSignInLink: () => Promise.resolve('not-a-link'),

    signOut: async () => {
      await pause(context);
      context.store.update((state) => {
        state.session = null;
      });
    },

    checkAccess: async (user) => {
      await pause(context);
      const entry = context.store.current.allowlist[user.email.toLowerCase()];
      return entry ? { status: 'member', isAdmin: entry.admin } : { status: 'denied' };
    },

    signInAs,
  };
}
