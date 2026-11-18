import type { AppConfig } from '@/config/env';

import type { Backend } from './backend';

/** Demo latency: long enough to see loading states, short enough not to annoy. */
const DEMO_LATENCY_MS = 350;

/**
 * Loads only the backend in use, so the demo build never downloads the
 * Firebase SDK and the real site never ships the demo data.
 */
export async function loadBackend(config: AppConfig): Promise<Backend> {
  if (config.mode === 'demo') {
    const { createDemoBackend } = await import('./demo');
    return createDemoBackend({ latencyMs: DEMO_LATENCY_MS });
  }
  const { createFirebaseBackend } = await import('./firebase');
  return createFirebaseBackend(config);
}
