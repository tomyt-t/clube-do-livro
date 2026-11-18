import type {
  ClubSettings,
  Cycle,
  CycleId,
  MemberId,
  Nomination,
  OwnAnswer,
  VoteResults,
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
  tallies: Record<CycleId, VoteResults | undefined>;
  receipts: Record<CycleId, MemberId[] | undefined>;
  /** Who marked "Acabei de ler!", per cycle. */
  readers: Record<CycleId, MemberId[] | undefined>;
  settings: ClubSettings;
}

export interface DemoPersona {
  uid: MemberId;
  name: string;
  email: string;
  /** Shown next to the name in the demo switcher, e.g. "organiza". */
  note?: string;
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

  /**
   * Emits a copy of the selection now and whenever it changes, asynchronously.
   * Like Firestore listeners, unrelated changes to the store emit nothing.
   */
  watch<T>(select: (state: DemoState) => T, next: (value: T) => void): () => void {
    let active = true;
    let last: string | undefined;
    const emit = () => {
      queueMicrotask(() => {
        if (!active) return;
        const value = select(this.state);
        const signature = JSON.stringify(value) as string | undefined;
        if (last !== undefined && signature === last) return;
        last = signature ?? 'undefined';
        next(structuredClone(value));
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
