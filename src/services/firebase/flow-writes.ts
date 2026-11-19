import {
  arrayUnion,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import { cycleIdFor } from '@/domain/flow';
import { conflictIds, type ConflictGroup } from '@/domain/review';
import type { Book, CycleId, DecisionMethod, NominationId, VoteResults } from '@/domain/types';

import { toResults } from './converters';
import { newCycleData } from './cycle-data';
import { refs } from './refs';

/**
 * The steps that move a cycle along. `firestore.rules` lets any member take
 * one once everyone has done their part, and the organizer at any time.
 */

interface StartVotingInput {
  cycleId: CycleId;
  options: readonly NominationId[];
  opening: VoteResults;
  votingDeadline: Date | null;
}

/** How a review is stored: every flagged id (null while the check runs) and the groups. */
export function reviewData(groups: readonly ConflictGroup[] | null) {
  if (groups === null) return { ids: null, groups: [] };
  return {
    ids: conflictIds(groups),
    groups: groups.map(({ ids, reason }) => ({ ids: [...ids], reason })),
  };
}

/** Everyone answered: the list opens for the duplicate check, and no more nominations come in. */
export async function startReview(db: Firestore, cycleId: CycleId) {
  await updateDoc(refs.cycle(db, cycleId), { review: reviewData(null) });
}

/** What the check found, recorded once for the organizer; flagged readings join the round's tally. */
export async function recordReview(
  db: Firestore,
  cycleId: CycleId,
  groups: readonly ConflictGroup[],
) {
  const ids = conflictIds(groups);
  await updateDoc(refs.cycle(db, cycleId), {
    review: reviewData(groups),
    ...(ids.length > 0 ? { flagged: arrayUnion(...ids) } : {}),
  });
}

/** Fixes the ballot's options and opens the tally (merged readings ahead), in one batch. */
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
  batch.set(refs.tally(db, cycleId), input.opening);
  await batch.commit();
}

/** The server's closing time also fixes any draw. */
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
  drawnFrom: readonly NominationId[];
  /** Must be the tally exactly as stored. */
  results: VoteResults;
  startReading: boolean;
}

export async function declareWinner(db: Firestore, input: DeclareWinnerInput) {
  const { cycleId, nominationId, book, method, drawnFrom, results, startReading } = input;
  await updateDoc(refs.cycle(db, cycleId), {
    status: startReading ? 'reading' : 'upcoming',
    winner: { nominationId, book, method, decidedAt: serverTimestamp(), drawnFrom: [...drawnFrom] },
    results,
    readingStartedAt: startReading ? serverTimestamp() : null,
  });
}

/**
 * The rules hold the winner's book to the nomination's exactly as stored.
 * Read through the converter, an older nomination gains a key it was saved
 * without (`coverSourceUrl`), so the book is copied from the stored document.
 */
export async function declareStoredWinner(db: Firestore, input: DeclareWinnerInput) {
  const nomination = await getDoc(refs.nomination(db, input.cycleId, input.nominationId));
  const stored = nomination.get('book') as Book | undefined;
  await declareWinner(db, { ...input, book: stored ?? input.book });
}

/** Ends the book and opens the next round in one batch, so it happens once. */
export async function finishAndOpenNext(
  db: Firestore,
  { cycleId, nextNumber }: { cycleId: CycleId; nextNumber: number },
): Promise<CycleId> {
  const nextId = cycleIdFor(nextNumber);
  const batch = writeBatch(db);
  batch.update(refs.cycle(db, cycleId), { status: 'finished', finishedAt: serverTimestamp() });
  batch.set(refs.cycle(db, nextId), newCycleData(nextNumber, null));
  await batch.commit();
  return nextId;
}
