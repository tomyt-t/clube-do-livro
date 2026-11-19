import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

import type { FirebaseConfig } from '@/config/env';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

/** Where `npm run dev:emulator` serves them (ports in firebase.json). */
const EMULATOR_HOST = '127.0.0.1';
const AUTH_EMULATOR = `http://${EMULATOR_HOST}:9099`;
const FIRESTORE_EMULATOR_PORT = 8080;

export function initFirebase(
  config: FirebaseConfig,
  appCheckSiteKey: string | null,
  emulators = false,
): FirebaseServices {
  const app = initializeApp(config);

  // Google Cloud Fraud Defense (formerly reCAPTCHA Enterprise): the only
  // provider App Check still takes on the web; it needs no secret key.
  if (appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const auth = initializeAuth(app, {
    // Stay signed in on this device until "Sair".
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  auth.languageCode = 'pt-BR';
  const db = getFirestore(app);

  if (emulators) {
    connectAuthEmulator(auth, AUTH_EMULATOR, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
  }

  return { app, auth, db };
}
