import type {
  Cycle,
  CycleId,
  MemberId,
  Nomination,
  NominationId,
  OwnAnswer,
  Round,
} from '@/domain/types';

import type { MemberProfile } from '../backend';

/** In-memory mirror of the Firestore layout. */
export interface DemoState {
  session: MemberId | null;
  allowlist: Record<string, { admin: boolean }>;
  members: Record<MemberId, MemberProfile>;
  cycles: Record<CycleId, Cycle>;
  nominations: Record<CycleId, Nomination[] | undefined>;
  answers: Record<CycleId, Record<MemberId, OwnAnswer> | undefined>;
  rounds: Record<CycleId, Round[] | undefined>;
  /** Keyed by `roundKey(cycleId, round)`. */
  tallies: Record<string, Record<NominationId, number> | undefined>;
  receipts: Record<string, MemberId[] | undefined>;
}

export interface DemoPersona {
  uid: MemberId;
  name: string;
  email: string;
}

export function roundKey(cycleId: CycleId, round: number): string {
  return `${cycleId}#${String(round)}`;
}

type Listener = () => void;

/** A minimal observable store; listeners run after every change. */
export class DemoStore {
  private state: DemoState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: DemoState) {
    this.state = initial;
  }

  get current(): DemoState {
    return this.state;
  }

  update(change: (draft: DemoState) => void) {
    const draft = structuredClone(this.state);
    change(draft);
    this.state = draft;
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Emits a copy of the selection now and after every change, asynchronously. */
  watch<T>(select: (state: DemoState) => T, next: (value: T) => void): () => void {
    let active = true;
    const emit = () => {
      queueMicrotask(() => {
        if (active) next(structuredClone(select(this.state)));
      });
    };
    emit();
    const unsubscribe = this.subscribe(emit);
    return () => {
      active = false;
      unsubscribe();
    };
  }
}
