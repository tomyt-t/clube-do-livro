import {
  findActiveElection,
  findCurrentReading,
  findUpcoming,
  nextCycleNumber,
  statusAfterDecision,
} from '@/domain/cycle';
import { decide, type Decision } from '@/domain/tally';
import type { Cycle, CycleId, Nomination } from '@/domain/types';

import type { AdminPort } from './backend';

/**
 * The organizer's actions as complete steps. Each step is safe to retry:
 * if a previous attempt stopped halfway (e.g. voting closed but no winner
 * was declared), running it again picks up where it stopped.
 */

export type ElectionErrorCode =
  | 'election-in-progress'
  | 'no-nominations'
  | 'not-voting'
  | 'nomination-missing'
  | 'nothing-to-finish';

export class ElectionError extends Error {
  readonly code: ElectionErrorCode;

  constructor(code: ElectionErrorCode) {
    super(code);
    this.name = 'ElectionError';
    this.code = code;
  }
}

export interface ElectionContext {
  /** Every cycle, to know whether another book is being read. */
  cycles: readonly Cycle[];
  cycle: Cycle;
  nominations: readonly Nomination[];
}

export async function openNominations(
  admin: AdminPort,
  cycles: readonly Cycle[],
  nominationDeadline: Date | null,
): Promise<CycleId> {
  if (findActiveElection(cycles)) throw new ElectionError('election-in-progress');
  return admin.openCycle({ number: nextCycleNumber(cycles), nominationDeadline });
}

/**
 * Closes voting, counts and declares the winner: most votes, then most
 * first choices, then a draw among the books still tied.
 */
export async function tallyVotes(
  admin: AdminPort,
  context: ElectionContext,
  random?: () => number,
): Promise<Decision> {
  const { cycle } = context;
  if (cycle.status !== 'voting' && cycle.status !== 'tallying') {
    throw new ElectionError('not-voting');
  }
  if (cycle.status === 'voting') await admin.closeVoting(cycle.id);

  const results = await admin.readResults(cycle.id);
  const decision = decide(cycle.options, results, random);
  const nomination = context.nominations.find((n) => n.id === decision.nominationId);
  if (!nomination) throw new ElectionError('nomination-missing');

  await admin.declareWinner({
    cycleId: cycle.id,
    nominationId: nomination.id,
    book: nomination.book,
    method: decision.method,
    results,
    startReading: statusAfterDecision(context.cycles) === 'reading',
  });
  return decision;
}

/**
 * Opens voting with every nomination. A single nomination wins unopposed
 * right away, without asking anyone to vote.
 */
export async function startVoting(
  admin: AdminPort,
  context: ElectionContext,
  votingDeadline: Date | null,
): Promise<Decision | null> {
  const options = context.nominations.map((nomination) => nomination.id);
  if (options.length === 0) throw new ElectionError('no-nominations');

  await admin.startVoting({ cycleId: context.cycle.id, options, votingDeadline });
  if (options.length > 1) return null;

  const cycle: Cycle = { ...context.cycle, status: 'voting', options };
  return tallyVotes(admin, { ...context, cycle });
}

/** Ends the current book and starts the queued one, if any. */
export async function finishCurrentReading(admin: AdminPort, cycles: readonly Cycle[]) {
  const reading = findCurrentReading(cycles);
  if (!reading) throw new ElectionError('nothing-to-finish');
  await admin.finishReading(reading.id);

  const upcoming = findUpcoming(cycles);
  if (upcoming) await admin.startReading(upcoming.id);
}
