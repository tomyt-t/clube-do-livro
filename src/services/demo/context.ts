import { BackendError } from '../backend';

import type { DemoPersona, DemoStore } from './state';

export interface DemoContext {
  store: DemoStore;
  personas: readonly DemoPersona[];
  /** Artificial latency so loading states are visible in the demo. */
  latencyMs: number;
}

export function pause(context: DemoContext): Promise<void> {
  if (context.latencyMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, context.latencyMs));
}

export function deny(): never {
  throw new BackendError('permission-denied', 'Permissão negada.');
}

export function personaByUid(context: DemoContext, uid: string | null): DemoPersona | null {
  return context.personas.find((persona) => persona.uid === uid) ?? null;
}

/** The signed-in persona, if it is on the allowlist. Mirrors `isMember()`. */
export function requireMember(context: DemoContext): DemoPersona {
  const persona = personaByUid(context, context.store.current.session);
  if (!persona || !(persona.email in context.store.current.allowlist)) deny();
  return persona;
}

/** Mirrors `isAdmin()`. */
export function requireAdmin(context: DemoContext): DemoPersona {
  const persona = requireMember(context);
  if (context.store.current.allowlist[persona.email]?.admin !== true) deny();
  return persona;
}

export function requireSelf(context: DemoContext, uid: string): DemoPersona {
  const persona = requireMember(context);
  if (persona.uid !== uid) deny();
  return persona;
}
