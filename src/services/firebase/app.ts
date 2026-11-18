import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
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
  auth: Auth;
  db: Firestore;
}

export function initFirebase(
  config: FirebaseConfig,
  appCheckSiteKey: string | null,
): FirebaseServices {
  const app = initializeApp(config);

  if (appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const auth = initializeAuth(app, {
    // Stay signed in on this device until "Sair".
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  auth.languageCode = 'pt-BR';

  return { auth, db: getFirestore(app) };
}
