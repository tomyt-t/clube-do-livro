import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import type { FirebaseConfig } from '@/config/env';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export function initFirebase(
  config: FirebaseConfig,
  appCheckSiteKey: string | null,
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

  return { app, auth, db: getFirestore(app) };
}
