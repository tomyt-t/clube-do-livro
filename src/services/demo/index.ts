import type { Backend } from '../backend';

import { createDemoAdmin } from './admin';
import { createDemoAuth, type DemoAuthPort } from './auth';
import { createDemoClub } from './club';
import { DEMO_ADMIN, DEMO_PERSONAS, createDemoState } from './seed';
import { DemoStore, type DemoPersona, type DemoState } from './state';

export interface DemoBackend extends Backend {
  kind: 'demo';
  auth: DemoAuthPort;
  personas: readonly DemoPersona[];
}

interface DemoOptions {
  state?: DemoState;
  latencyMs?: number;
}

/**
 * A complete in-memory club for `npm run dev:demo` and for tests. It enforces
 * the same rules as `firestore.rules`, so the UI meets the same errors.
 * Data resets when the page reloads.
 */
export function createDemoBackend(options: DemoOptions = {}): DemoBackend {
  const context = {
    store: new DemoStore(options.state ?? createDemoState()),
    personas: DEMO_PERSONAS,
    latencyMs: options.latencyMs ?? 0,
  };
  return {
    kind: 'demo',
    auth: createDemoAuth(context, DEMO_ADMIN),
    club: createDemoClub(context),
    admin: createDemoAdmin(context),
    personas: DEMO_PERSONAS,
  };
}

export { createDemoState, createEmptyDemoState, DEMO_ADMIN, DEMO_PERSONAS } from './seed';
export type { DemoPersona, DemoState } from './state';
