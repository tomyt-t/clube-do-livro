import type { AppConfig } from '@/config/env';

import type { Backend } from './backend';

/** Demo latency: long enough to see loading states, short enough not to annoy. */
const DEMO_LATENCY_MS = 350;

/**
 * Whether this is a demo build. Read straight from the build's environment,
 * so in the real site's build it is a constant `false` and the bundler
 * drops every demo import: the demo cannot be switched on there at all.
 */
export const DEMO_BUILD = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * Loads only the backend in use, so the demo build never downloads the
 * Firebase SDK and the real site never ships the demo data.
 */
export async function loadBackend(config: AppConfig): Promise<Backend> {
  if (DEMO_BUILD && config.mode === 'demo') {
    const { createDemoBackend } = await import('./demo');
    return createDemoBackend({ latencyMs: DEMO_LATENCY_MS });
  }
  if (config.mode === 'demo') throw new Error('Esta versão do site não inclui o demo.');
  const { createFirebaseBackend } = await import('./firebase');
  return createFirebaseBackend(config);
}
