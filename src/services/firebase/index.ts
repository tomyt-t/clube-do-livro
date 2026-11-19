import type { AppConfig } from '@/config/env';

import type { Backend } from '../backend';

import { createFirebaseAdmin } from './admin';
import { initFirebase, initLiveApp } from './app';
import { createFirebaseAuth } from './auth';
import { createFirebaseChecker } from './checker';
import { createFirebaseClub } from './club';
import { createFirebaseFlow } from './flow';
import { createFirebaseTranslator } from './translator';

type FirebaseAppConfig = Extract<AppConfig, { mode: 'firebase' }>;

export function createFirebaseBackend(config: FirebaseAppConfig): Backend {
  const services = initFirebase(config.firebase, config.appCheckSiteKey, config.emulators);
  // On the emulators, Gemini still runs on the real project, when its keys are set.
  const aiApp = config.live ? initLiveApp(config.live) : services.app;
  return {
    kind: 'firebase',
    auth: createFirebaseAuth(services),
    club: createFirebaseClub(services),
    flow: createFirebaseFlow(services),
    admin: createFirebaseAdmin(services),
    checker: createFirebaseChecker(aiApp, config.aiModel),
    translator: createFirebaseTranslator(aiApp, config.aiModel),
  };
}
