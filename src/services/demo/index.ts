import type { Backend } from '../backend';

import { sameTitleChecker } from '../duplicates/same-title';

import { createDemoAdmin } from './admin';
import { createDemoAuth, type DemoAuthPort } from './auth';
import { createDemoClub } from './club';
import { createDemoFlow } from './flow';
import { DEMO_ADMIN, DEMO_PERSONAS, createDemoState } from './seed';
import type { DemoScenario } from './scenarios';
import { DemoStore, type DemoPersona, type DemoState } from './state';

export interface DemoBackend extends Backend {
  kind: 'demo';
  auth: DemoAuthPort;
  personas: readonly DemoPersona[];
  /** Puts the current cycle at another stage; whoever is signed in stays. */
  loadScenario(scenario: DemoScenario): void;
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
    flow: createDemoFlow(context),
    admin: createDemoAdmin(context),
    checker: sameTitleChecker,
    personas: DEMO_PERSONAS,
    loadScenario: (scenario) => {
      context.store.update((draft) => {
        Object.assign(draft, createDemoState(new Date(), scenario), { session: draft.session });
      });
    },
  };
}

export { createDemoState, createEmptyDemoState, DEMO_ADMIN, DEMO_PERSONAS } from './seed';
export { DEMO_SCENARIOS, type DemoScenario } from './scenarios';
export type { DemoPersona, DemoState } from './state';
