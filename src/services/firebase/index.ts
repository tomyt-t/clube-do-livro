import type { AppConfig } from '@/config/env';

import type { Backend } from '../backend';

import { createFirebaseAdmin } from './admin';
import { initFirebase } from './app';
import { createFirebaseAuth } from './auth';
import { createFirebaseClub } from './club';
import { createFirebaseFlow } from './flow';

type FirebaseAppConfig = Extract<AppConfig, { mode: 'firebase' }>;

export function createFirebaseBackend(config: FirebaseAppConfig): Backend {
  const services = initFirebase(config.firebase, config.appCheckSiteKey);
  return {
    kind: 'firebase',
    auth: createFirebaseAuth(services),
    club: createFirebaseClub(services),
    flow: createFirebaseFlow(services),
    admin: createFirebaseAdmin(services),
  };
}
