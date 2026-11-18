import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getDoc } from 'firebase/firestore';

import { normalizeEmail } from '@/domain/email';

import type { Access, AuthPort, SessionUser } from '../backend';

import type { FirebaseServices } from './app';
import { guard, isCancelledSignIn, toBackendError } from './errors';
import { refs } from './refs';

/** Remembers which email asked for a link, so opening it needs no typing. */
const PENDING_EMAIL_KEY = 'clube-do-livro:email-for-sign-in';

function readPendingEmail(): string | null {
  try {
    return localStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

function writePendingEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(PENDING_EMAIL_KEY, email);
    else localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Storage blocked: the person will be asked for their email again.
  }
}

function toSessionUser(user: User): SessionUser {
  const email = user.email ?? '';
  const name = user.displayName ?? email.split('@')[0] ?? '';
  return { uid: user.uid, email, name, photoURL: user.photoURL };
}

function currentPageUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Drops the one-time code from the address bar after using it. */
function forgetLinkInUrl() {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
}

async function lookUpAccess({ auth, db }: FirebaseServices, user: SessionUser): Promise<Access> {
  if (auth.currentUser?.emailVerified !== true || user.email === '') return { status: 'denied' };
  try {
    const entry = await getDoc(refs.allowlistEntry(db, normalizeEmail(user.email)));
    return entry.exists()
      ? { status: 'member', isAdmin: entry.get('admin') === true }
      : { status: 'denied' };
  } catch (error) {
    const failure = toBackendError(error);
    if (failure.code === 'permission-denied') return { status: 'denied' };
    throw failure;
  }
}

export function createFirebaseAuth(services: FirebaseServices): AuthPort {
  const { auth } = services;

  return {
    watchUser: (listener) =>
      onAuthStateChanged(auth, (user) => {
        listener(user ? toSessionUser(user) : null);
      }),

    signInWithGoogle: async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        if (!isCancelledSignIn(error)) throw toBackendError(error);
      }
    },

    sendSignInLink: async (email) => {
      const address = normalizeEmail(email);
      await guard(
        sendSignInLinkToEmail(auth, address, { url: currentPageUrl(), handleCodeInApp: true }),
      );
      writePendingEmail(address);
    },

    completeSignInLink: async (email) => {
      const link = window.location.href;
      if (!isSignInWithEmailLink(auth, link)) return 'not-a-link';
      const address = email ?? readPendingEmail();
      if (!address) return 'needs-email';

      await guard(signInWithEmailLink(auth, normalizeEmail(address), link));
      writePendingEmail(null);
      forgetLinkInUrl();
      return 'signed-in';
    },

    signOut: () => guard(signOut(auth)),

    checkAccess: (user) => lookUpAccess(services, user),
  };
}
