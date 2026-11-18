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

import { emptyResults } from '@/domain/tally';
import type { Book, CycleId, DecisionMethod, NominationId, VoteResults } from '@/domain/types';

import { toResults } from './converters';
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
    responses: 0,
    nominationDeadline: input.nominationDeadline,
    votingDeadline: null,
    createdAt: serverTimestamp(),
    options: [],
    ballots: 0,
    votingOpenedAt: null,
    votingClosedAt: null,
    results: null,
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

interface StartVotingInput {
  cycleId: CycleId;
  options: readonly NominationId[];
  votingDeadline: Date | null;
}

/** Fixes the ballot's options and opens an empty tally, in one batch. */
export async function startVoting(db: Firestore, input: StartVotingInput) {
  const { cycleId, options, votingDeadline } = input;
  const batch = writeBatch(db);
  batch.update(refs.cycle(db, cycleId), {
    status: 'voting',
    options: [...options],
    ballots: 0,
    votingOpenedAt: serverTimestamp(),
    votingDeadline,
  });
  batch.set(refs.tally(db, cycleId), emptyResults(options));
  await batch.commit();
}

export async function closeVoting(db: Firestore, cycleId: CycleId) {
  await updateDoc(refs.cycle(db, cycleId), {
    status: 'tallying',
    votingClosedAt: serverTimestamp(),
  });
}

/** The tally becomes readable once voting has closed. */
export async function readResults(db: Firestore, cycleId: CycleId): Promise<VoteResults> {
  const snapshot = await getDoc(refs.tally(db, cycleId));
  const results = toResults(snapshot.data());
  if (!results) throw new Error('Apuração ilegível.');
  return results;
}

interface DeclareWinnerInput {
  cycleId: CycleId;
  nominationId: NominationId;
  /** Must be the nomination's book exactly as stored. */
  book: Book;
  method: DecisionMethod;
  /** Must be the tally exactly as stored. */
  results: VoteResults;
  startReading: boolean;
}

export async function declareWinner(db: Firestore, input: DeclareWinnerInput) {
  const { cycleId, nominationId, book, method, results, startReading } = input;
  await updateDoc(refs.cycle(db, cycleId), {
    status: startReading ? 'reading' : 'upcoming',
    winner: { nominationId, book, method, decidedAt: serverTimestamp() },
    results,
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
