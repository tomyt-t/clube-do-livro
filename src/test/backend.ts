import { nextFlowStep } from '@/domain/flow';
import type { Book, ClubSettings, Cycle, CycleId } from '@/domain/types';
import { createDemoBackend, createEmptyDemoState, type DemoBackend } from '@/services/demo';
import { advance, readOnce } from '@/services/election';

import { makeBook } from './factories';

/** The six demo members on the allowlist, organizer first. */
export const MEMBERS = ['marina', 'rafa', 'julia', 'teo', 'bruno', 'lia'] as const;

/** Resolves with the first value a watch emits, then unsubscribes. */
export const firstValue = readOnce;

/** A demo club with its six members but no cycles, signed in as the organizer. */
export function emptyClub(): DemoBackend {
  const backend = createDemoBackend({ state: createEmptyDemoState() });
  backend.auth.signInAs('marina');
  return backend;
}

export function cyclesOf(backend: DemoBackend): Promise<Cycle[]> {
  return firstValue<Cycle[]>((s) => backend.club.watchCycles(s));
}

export async function cycleOf(backend: DemoBackend, cycleId: CycleId): Promise<Cycle> {
  const cycle = (await cyclesOf(backend)).find((c) => c.id === cycleId);
  if (!cycle) throw new Error(`Cycle ${cycleId} not found`);
  return cycle;
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
  ballot: { cycleId: CycleId; uid: string; choices: string[]; countsFirst?: boolean },
) {
  backend.auth.signInAs(ballot.uid);
  try {
    await backend.club.castBallot(ballot);
  } finally {
    backend.auth.signInAs('marina');
  }
}

export async function finishAs(backend: DemoBackend, cycleId: CycleId, uid: string) {
  backend.auth.signInAs(uid);
  try {
    await backend.club.markFinished({ cycleId, uid });
  } finally {
    backend.auth.signInAs('marina');
  }
}

/**
 * A round where rafa nominates `book` and everyone else passes: once the
 * flow settles, it is the book being read (or queued behind another).
 */
export async function soloRound(
  backend: DemoBackend,
  book: Book = makeBook({ title: 'Livro de rafa' }),
) {
  const cycles = await cyclesOf(backend);
  const number = cycles.reduce((max, cycle) => Math.max(max, cycle.number), 0) + 1;
  const cycleId = await backend.admin.openCycle({ number, nominationDeadline: null });
  await answerAs(backend, cycleId, 'rafa', book);
  for (const uid of MEMBERS.filter((member) => member !== 'rafa')) {
    await answerAs(backend, cycleId, uid, null);
  }
  await settle(backend);
  return cycleId;
}

/**
 * Takes every step that is ready, as the members' devices would, as `uid`
 * (a regular member by default, so nothing relies on the organizer).
 */
export async function settle(backend: DemoBackend, uid = 'rafa') {
  backend.auth.signInAs(uid);
  try {
    for (let guard = 0; guard < 10; guard += 1) {
      const settings = await firstValue<ClubSettings>((s) => backend.club.watchSettings(s));
      const cycles = await cyclesOf(backend);
      const step = nextFlowStep(cycles, settings.members);
      if (!step) return;
      await advance(backend, step, cycles);
    }
    throw new Error('The flow did not settle.');
  } finally {
    backend.auth.signInAs('marina');
  }
}
