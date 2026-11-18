import type { Book, Cycle, CycleId, Nomination, Round } from '@/domain/types';
import type { Subscriber, Unsubscribe } from '@/services/backend';
import { createDemoBackend, createEmptyDemoState, type DemoBackend } from '@/services/demo';
import type { ElectionContext } from '@/services/election';

import { makeBook } from './factories';

/** Resolves with the first value a watch emits, then unsubscribes. */
export function firstValue<T>(watch: (subscriber: Subscriber<T>) => Unsubscribe): Promise<T> {
  return new Promise((resolve, reject) => {
    const unsubscribe = watch({
      next: (value) => {
        queueMicrotask(() => {
          unsubscribe();
        });
        resolve(value);
      },
      error: reject,
    });
  });
}

/** A demo club with members but no cycles, signed in as the organizer. */
export function emptyClub(): DemoBackend {
  const backend = createDemoBackend({ state: createEmptyDemoState() });
  backend.auth.signInAs('marina');
  return backend;
}

export async function electionContext(
  backend: DemoBackend,
  cycleId: CycleId,
): Promise<ElectionContext> {
  const cycles = await firstValue<Cycle[]>((s) => backend.club.watchCycles(s));
  const cycle = cycles.find((c) => c.id === cycleId);
  if (!cycle) throw new Error(`Cycle ${cycleId} not found`);
  const nominations = await firstValue<Nomination[]>((s) =>
    backend.club.watchNominations(cycleId, s),
  );
  const rounds = await firstValue<Round[]>((s) => backend.club.watchRounds(cycleId, s));
  return { cycles, cycle, nominations, rounds };
}

/** Signs in as `uid`, sends their answer, then returns to the organizer. */
export async function answerAs(
  backend: DemoBackend,
  cycleId: CycleId,
  uid: string,
  book: Book | null = makeBook({ title: `Livro de ${uid}` }),
) {
  backend.auth.signInAs(uid);
  const answer = book ? { kind: 'nominate' as const, book } : { kind: 'pass' as const };
  const nominationId = await backend.club.answerNominationCall({ cycleId, uid, answer });
  backend.auth.signInAs('marina');
  return nominationId;
}

export async function voteAs(
  backend: DemoBackend,
  ballot: { cycleId: CycleId; round: number; uid: string; choices: string[] },
) {
  backend.auth.signInAs(ballot.uid);
  try {
    await backend.club.castBallot(ballot);
  } finally {
    backend.auth.signInAs('marina');
  }
}
