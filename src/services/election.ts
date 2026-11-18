import {
  findActiveElection,
  findCurrentReading,
  findUpcoming,
  nextCycleNumber,
  statusAfterDecision,
} from '@/domain/cycle';
import type { FlowStep } from '@/domain/flow';
import { decide, type Decision } from '@/domain/tally';
import type { Cycle, CycleId, Nomination } from '@/domain/types';

import type { AdminPort, Backend, FlowPort, Subscriber, Unsubscribe } from './backend';

/**
 * The cycle's steps as complete operations. Each one is safe to retry and
 * safe to race: if someone else already took the step, the server refuses
 * the repeat and nothing changes.
 */

export type ElectionErrorCode =
  | 'election-in-progress'
  | 'no-nominations'
  | 'not-closed'
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

export interface FlowContext {
  /** Every cycle, to know whether another book is being read. */
  cycles: readonly Cycle[];
  /** The nominations of the cycle the step is about. */
  nominations: readonly Nomination[];
}

/** The organizer opens the first round; later rounds open by themselves. */
export async function openNominations(
  admin: AdminPort,
  cycles: readonly Cycle[],
  nominationDeadline: Date | null,
): Promise<CycleId> {
  if (findActiveElection(cycles)) throw new ElectionError('election-in-progress');
  return admin.openCycle({ number: nextCycleNumber(cycles), nominationDeadline });
}

/**
 * Counts and declares the winner of a closed vote: most votes, then most
 * first choices, then a draw fixed by the closing time.
 */
export async function declareResult(
  flow: FlowPort,
  cycle: Cycle,
  context: FlowContext,
): Promise<Decision> {
  const closedAt = cycle.votingClosedAt?.getTime();
  if (cycle.status !== 'tallying' || closedAt === undefined) throw new ElectionError('not-closed');
  const results = await flow.readResults(cycle.id);
  const decision = decide(cycle.options, results, closedAt);
  const nomination = context.nominations.find((n) => n.id === decision.nominationId);
  if (!nomination) throw new ElectionError('nomination-missing');

  await flow.declareWinner({
    cycleId: cycle.id,
    nominationId: nomination.id,
    book: nomination.book,
    method: decision.method,
    drawnFrom: decision.drawnFrom,
    results,
    startReading: statusAfterDecision(context.cycles) === 'reading',
  });
  return decision;
}

export async function takeFlowStep(
  flow: FlowPort,
  step: FlowStep,
  context: FlowContext,
): Promise<void> {
  const { cycle } = step;
  switch (step.kind) {
    case 'open-voting':
      // Exactly the nominations, in arrival order: what the server checks.
      if (cycle.nominationIds.length === 0) throw new ElectionError('no-nominations');
      await flow.startVoting({
        cycleId: cycle.id,
        options: cycle.nominationIds,
        votingDeadline: null,
      });
      return;
    case 'close-voting':
      await flow.closeVoting(cycle.id);
      return;
    case 'declare':
      await declareResult(flow, cycle, context);
      return;
    case 'finish-reading':
      await flow.finishAndOpenNext({ cycleId: cycle.id, nextNumber: cycle.number + 1 });
  }
}

/** The first value a watch emits, then it stops listening. */
export function readOnce<T>(watch: (subscriber: Subscriber<T>) => Unsubscribe): Promise<T> {
  return new Promise((resolve, reject) => {
    const unsubscribe = watch({
      next: (value) => {
        // Watches emit asynchronously, so `unsubscribe` is assigned by now.
        queueMicrotask(() => {
          unsubscribe();
        });
        resolve(value);
      },
      error: reject,
    });
  });
}

/** Takes a step with the nominations it needs, read once from the backend. */
export async function advance(backend: Backend, step: FlowStep, cycles: readonly Cycle[]) {
  const nominations = await readOnce<Nomination[]>((s) =>
    backend.club.watchNominations(step.cycle.id, s),
  );
  await takeFlowStep(backend.flow, step, { cycles, nominations });
}

/** The organizer's manual way to end a book: the queued one starts, if any. */
export async function finishCurrentReading(admin: AdminPort, cycles: readonly Cycle[]) {
  const reading = findCurrentReading(cycles);
  if (!reading) throw new ElectionError('nothing-to-finish');
  await admin.finishReading(reading.id);

  const upcoming = findUpcoming(cycles);
  if (upcoming) await admin.startReading(upcoming.id);
}
