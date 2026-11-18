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
import { getDoc, type Firestore } from 'firebase/firestore';

import { normalizeEmail } from '@/domain/email';

import type { Access, AuthPort, SessionUser } from '../backend';

import type { FirebaseServices } from './app';
import { guard, isCancelledSignIn, toBackendError } from './errors';
import { claimSeat } from './member-writes';
import { refs } from './refs';

/** Remembers which email asked for a link, so opening it needs no typing. */
const PENDING_EMAIL_KEY = 'clube-do-livro:email-for-sign-in';

/** Kept no longer than a day: links expire well before, and the address should not linger. */
const PENDING_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;

function readPendingEmail(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_EMAIL_KEY) ?? 'null') as {
      email?: unknown;
      at?: unknown;
    } | null;
    const fresh = typeof saved?.at === 'number' && Date.now() - saved.at < PENDING_EMAIL_TTL_MS;
    if (fresh && typeof saved.email === 'string') return saved.email;
    localStorage.removeItem(PENDING_EMAIL_KEY);
    return null;
  } catch {
    return null;
  }
}

function writePendingEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email, at: Date.now() }));
    else localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Storage blocked: the person will be asked for their email again.
  }
}

/**
 * The name comes from the Google account only. Never from the email: the
 * profile is public inside the club, and part of an address is still the
 * address (email-link sign-ins get the club's fallback name instead).
 */
function toSessionUser(user: User): SessionUser {
  const email = user.email ?? '';
  return { uid: user.uid, email, name: user.displayName ?? '', photoURL: user.photoURL };
}

function currentPageUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Drops the one-time code from the address bar after using it. */
function forgetLinkInUrl() {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
}

/**
 * Whether this account holds the email's seat, claiming it the first time.
 * Another account may claim it first: then this one is the second.
 */
async function holdsSeat(db: Firestore, email: string, uid: string, seat: unknown) {
  if (seat !== undefined) return seat === uid;
  return claimSeat(db, email, uid).then(
    () => true,
    () => false,
  );
}

async function lookUpAccess({ auth, db }: FirebaseServices, user: SessionUser): Promise<Access> {
  if (auth.currentUser?.emailVerified !== true || user.email === '') return { status: 'denied' };
  try {
    const email = normalizeEmail(user.email);
    const entry = await getDoc(refs.allowlistEntry(db, email));
    if (!entry.exists()) return { status: 'denied' };
    if (!(await holdsSeat(db, email, user.uid, entry.get('uid')))) {
      return { status: 'denied', taken: true };
    }
    return { status: 'member', isAdmin: entry.get('admin') === true };
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

    signOut: () => {
      writePendingEmail(null);
      return guard(signOut(auth));
    },

    checkAccess: (user) => lookUpAccess(services, user),
  };
}
