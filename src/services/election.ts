import {
  findActiveElection,
  findCurrentReading,
  findUpcoming,
  nextCycleNumber,
  statusAfterDecision,
} from '@/domain/cycle';
import type { FlowStep } from '@/domain/flow';
import { ballotOptions, openingResults, type ConflictGroup } from '@/domain/review';
import { decide, type Decision } from '@/domain/tally';
import type { Cycle, CycleId, Nomination } from '@/domain/types';

import type {
  AdminPort,
  Backend,
  DuplicateChecker,
  FlowPort,
  Subscriber,
  Unsubscribe,
} from './backend';

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
  /** The nominations of the cycle the step is about (read only for the steps that need them). */
  nominations: readonly Nomination[];
  checker: DuplicateChecker;
  /**
   * Whether this device may flag readings: only the organizer's. Flags let
   * the organizer see who nominated those readings, so a member's device
   * may only record that nothing was found and leaves flags to the organizer.
   */
  canFlag: boolean;
}

/** Opens the vote with every nomination left after merges, merged ones ahead by their nominators. */
export async function openVoting(flow: FlowPort, cycle: Cycle) {
  const options = ballotOptions(cycle.nominationIds, cycle.merged);
  if (options.length === 0) throw new ElectionError('no-nominations');
  await flow.startVoting({
    cycleId: cycle.id,
    options,
    opening: openingResults(options, cycle.merged),
    votingDeadline: null,
  });
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
    startReading: statusAfterDecision(context.cycles, cycle) === 'reading',
  });
  return decision;
}

/**
 * Runs the duplicate check on what would be on the ballot: the round's list,
 * minus readings merged away. A group made only of readings flagged earlier
 * this round was already sorted out (kept apart), so it is not raised again.
 */
async function checkNominations(
  checker: DuplicateChecker,
  cycle: Cycle,
  nominations: readonly Nomination[],
): Promise<ConflictGroup[]> {
  const listed = nominations.filter(
    ({ id }) => cycle.nominationIds.includes(id) && !(id in cycle.merged),
  );
  const groups = await checker.findDuplicates(listed);
  return groups.filter(({ ids }) => !ids.every((id) => cycle.flagged.includes(id)));
}

export async function takeFlowStep(
  flow: FlowPort,
  step: FlowStep,
  context: FlowContext,
): Promise<void> {
  const { cycle } = step;
  switch (step.kind) {
    case 'start-review':
      await flow.startReview(cycle.id);
      return;
    case 'check': {
      const groups = await checkNominations(context.checker, cycle, context.nominations);
      if (groups.length === 0 || context.canFlag) await flow.recordReview(cycle.id, groups);
      return;
    }
    case 'open-voting':
      await openVoting(flow, cycle);
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

/**
 * Takes a step with the nominations it needs, read once from the backend.
 * Only declaring the winner needs them, and only then may they be read:
 * they stay hidden until the vote opens.
 */
export async function advance(
  backend: Backend,
  step: FlowStep,
  cycles: readonly Cycle[],
  { canFlag }: { canFlag: boolean },
) {
  const nominations =
    step.kind === 'declare' || step.kind === 'check'
      ? await readOnce<Nomination[]>((s) => backend.club.watchNominations(step.cycle.id, s))
      : [];
  await takeFlowStep(backend.flow, step, {
    cycles,
    nominations,
    checker: backend.checker,
    canFlag,
  });
}

/** The organizer's manual way to end a book: the queued one starts, if any. */
export async function finishCurrentReading(admin: AdminPort, cycles: readonly Cycle[]) {
  const reading = findCurrentReading(cycles);
  if (!reading) throw new ElectionError('nothing-to-finish');
  await admin.finishReading(reading.id);

  const upcoming = findUpcoming(cycles);
  if (upcoming) await admin.startReading(upcoming.id);
}
