import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import { emptyTally } from '@/domain/tally';
import type { Book, CycleId, DecisionMethod, NominationId, RoundKind, Tally } from '@/domain/types';
import { rulesFor } from '@/domain/voting';

import { refs } from './refs';

/**
 * Writes reserved to the organizer. `firestore.rules` checks each one as a
 * step of the cycle's state machine, so these mirror its transitions 1:1.
 */

interface OpenCycleInput {
  number: number;
  nominationDeadline: Date | null;
}

export async function openCycle(db: Firestore, input: OpenCycleInput): Promise<CycleId> {
  const cycle = doc(refs.cycles(db));
  await setDoc(cycle, {
    number: input.number,
    status: 'nominating',
    currentRound: 0,
    responses: 0,
    nominationDeadline: input.nominationDeadline,
    votingDeadline: null,
    createdAt: serverTimestamp(),
    winner: null,
    readingStartedAt: null,
    finishedAt: null,
  });
  return cycle.id;
}

export type DeadlineField = 'nominationDeadline' | 'votingDeadline';

export async function setDeadline(
  db: Firestore,
  cycleId: CycleId,
  field: DeadlineField,
  deadline: Date | null,
) {
  await updateDoc(refs.cycle(db, cycleId), { [field]: deadline });
}

/** Only allowed while the cycle is still collecting nominations. */
export async function deleteCycle(db: Firestore, cycleId: CycleId) {
  await deleteDoc(refs.cycle(db, cycleId));
}

interface OpenRoundInput {
  cycleId: CycleId;
  number: number;
  kind: RoundKind;
  options: readonly NominationId[];
  votingDeadline: Date | null;
}

/** Opens round 1 (moving the cycle to voting) or a runoff. */
export async function openRound(db: Firestore, input: OpenRoundInput) {
  const { cycleId, number, kind, options, votingDeadline } = input;
  const cycleChanges =
    kind === 'first'
      ? { status: 'voting', currentRound: number, votingDeadline }
      : { currentRound: number, votingDeadline };

  const batch = writeBatch(db);
  batch.update(refs.cycle(db, cycleId), cycleChanges);
  batch.set(refs.round(db, cycleId, number), {
    number,
    kind,
    options: [...options],
    votesPerMember: rulesFor(kind).votesPerMember,
    status: 'open',
    ballots: 0,
    openedAt: serverTimestamp(),
    closedAt: null,
    results: null,
  });
  batch.set(refs.tally(db, cycleId, number), { counts: emptyTally(options) });
  await batch.commit();
}

export async function closeRound(db: Firestore, cycleId: CycleId, round: number) {
  await updateDoc(refs.round(db, cycleId, round), {
    status: 'closed',
    closedAt: serverTimestamp(),
  });
}

function parseCounts(value: unknown): Tally {
  if (typeof value !== 'object' || value === null) throw new Error('Apuração ilegível.');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.some(([, votes]) => typeof votes !== 'number')) {
    throw new Error('Apuração ilegível.');
  }
  return Object.fromEntries(entries) as Tally;
}

/** Copies the (now readable) tally into the closed round, for history. */
export async function recordResults(db: Firestore, cycleId: CycleId, round: number) {
  const snapshot = await getDoc(refs.tally(db, cycleId, round));
  const results = parseCounts(snapshot.get('counts'));
  await updateDoc(refs.round(db, cycleId, round), { results });
  return results;
}

export async function enterTiebreak(db: Firestore, cycleId: CycleId) {
  await updateDoc(refs.cycle(db, cycleId), { status: 'tiebreak' });
}

interface DeclareWinnerInput {
  cycleId: CycleId;
  nominationId: NominationId;
  /** Must be the nomination's book exactly as stored. */
  book: Book;
  method: DecisionMethod;
  startReading: boolean;
}

export async function declareWinner(db: Firestore, input: DeclareWinnerInput) {
  const { cycleId, nominationId, book, method, startReading } = input;
  await updateDoc(refs.cycle(db, cycleId), {
    status: startReading ? 'reading' : 'upcoming',
    winner: { nominationId, book, method, decidedAt: serverTimestamp() },
    readingStartedAt: startReading ? serverTimestamp() : null,
  });
}

export async function startReading(db: Firestore, cycleId: CycleId) {
  await updateDoc(refs.cycle(db, cycleId), {
    status: 'reading',
    readingStartedAt: serverTimestamp(),
  });
}

export async function finishReading(db: Firestore, cycleId: CycleId) {
  await updateDoc(refs.cycle(db, cycleId), {
    status: 'finished',
    finishedAt: serverTimestamp(),
  });
}

/** Emails must already be normalized (trimmed, lowercase). */
export async function allowEmails(db: Firestore, emails: readonly string[]) {
  const batch = writeBatch(db);
  emails.forEach((email) => {
    batch.set(refs.allowlistEntry(db, email), {});
  });
  await batch.commit();
}

export async function revokeEmail(db: Firestore, email: string) {
  await deleteDoc(refs.allowlistEntry(db, email));
}
