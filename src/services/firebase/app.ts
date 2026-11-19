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

import type { FirebaseConfig, LiveConfig } from '@/config/env';

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

/**
 * On the emulators only: a second app on the real project, used by Gemini
 * alone. App Check runs in debug mode there, with the token registered in
 * the Firebase console (the site key accepts only the site's domain).
 */
export function initLiveApp(live: LiveConfig): FirebaseApp {
  // App Check reads this global when it starts; `true` prints a new token to the console.
  Object.assign(globalThis, { FIREBASE_APPCHECK_DEBUG_TOKEN: live.appCheckDebugToken ?? true });
  const app = initializeApp(live.firebase, 'projeto-real');
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(live.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return app;
}
