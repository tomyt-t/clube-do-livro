import {
  findActiveElection,
  findCurrentReading,
  findUpcoming,
  nextCycleNumber,
  statusAfterDecision,
} from '@/domain/cycle';
import { drawWinner } from '@/domain/draw';
import { decideRound, nextStep, type NextStep } from '@/domain/tally';
import type {
  Cycle,
  CycleId,
  DecisionMethod,
  Nomination,
  NominationId,
  Round,
} from '@/domain/types';
import { rulesFor } from '@/domain/voting';

import type { AdminPort } from './backend';

/**
 * The organizer's actions as complete steps. Each step is safe to retry:
 * if a previous attempt stopped halfway (e.g. the round closed but the
 * results were not recorded), running it again picks up where it stopped.
 */

export type ElectionErrorCode =
  | 'election-in-progress'
  | 'no-nominations'
  | 'round-missing'
  | 'nomination-missing'
  | 'not-a-tiebreak'
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
  rounds: readonly Round[];
}

export type Resolution =
  | { kind: 'winner'; nominationId: NominationId; method: DecisionMethod }
  | { kind: 'runoff'; options: NominationId[] }
  | { kind: 'tiebreak'; candidates: NominationId[] };

export async function openNominations(
  admin: AdminPort,
  cycles: readonly Cycle[],
  nominationDeadline: Date | null,
): Promise<CycleId> {
  if (findActiveElection(cycles)) throw new ElectionError('election-in-progress');
  return admin.openCycle({ number: nextCycleNumber(cycles), nominationDeadline });
}

function currentRound(context: ElectionContext): Round {
  const round = context.rounds.find((r) => r.number === context.cycle.currentRound);
  if (!round) throw new ElectionError('round-missing');
  return round;
}

async function declare(
  admin: AdminPort,
  context: ElectionContext,
  nominationId: NominationId,
  method: DecisionMethod,
): Promise<Resolution> {
  const nomination = context.nominations.find((n) => n.id === nominationId);
  if (!nomination) throw new ElectionError('nomination-missing');

  await admin.declareWinner({
    cycleId: context.cycle.id,
    nominationId,
    book: nomination.book,
    method,
    startReading: statusAfterDecision(context.cycles) === 'reading',
  });
  return { kind: 'winner', nominationId, method };
}

async function applyStep(
  admin: AdminPort,
  context: ElectionContext,
  round: Round,
  step: NextStep,
): Promise<Resolution> {
  switch (step.kind) {
    case 'declare-winner': {
      const method = round.options.length === 1 ? 'unopposed' : 'votes';
      return declare(admin, context, step.nominationId, method);
    }
    case 'open-runoff':
      await admin.openRound({
        cycleId: context.cycle.id,
        number: round.number + 1,
        kind: 'runoff',
        options: step.options,
        votingDeadline: null,
      });
      return { kind: 'runoff', options: step.options };
    case 'draw':
      await admin.enterTiebreak(context.cycle.id);
      return { kind: 'tiebreak', candidates: step.candidates };
  }
}

/** Closes the current round, records its results and moves the cycle on. */
export async function tallyCurrentRound(
  admin: AdminPort,
  context: ElectionContext,
): Promise<Resolution> {
  const round = currentRound(context);
  if (round.status === 'open') await admin.closeRound(context.cycle.id, round.number);
  const results = round.results ?? (await admin.recordResults(context.cycle.id, round.number));
  const step = nextStep(round.kind, decideRound(round.options, results));
  return applyStep(admin, context, round, step);
}

/**
 * Opens round 1 with every nomination. A single nomination wins unopposed
 * right away, without asking anyone to vote.
 */
export async function startVoting(
  admin: AdminPort,
  context: ElectionContext,
  votingDeadline: Date | null,
): Promise<Resolution | null> {
  const options = context.nominations.map((nomination) => nomination.id);
  if (options.length === 0) throw new ElectionError('no-nominations');

  const firstRound = { cycleId: context.cycle.id, number: 1, kind: 'first' as const, options };
  await admin.openRound({ ...firstRound, votingDeadline });
  if (options.length > 1) return null;

  const opened: Round = {
    number: 1,
    kind: 'first',
    options,
    votesPerMember: rulesFor('first').votesPerMember,
    status: 'open',
    ballots: 0,
    openedAt: new Date(),
    closedAt: null,
    results: null,
  };
  const cycle: Cycle = { ...context.cycle, status: 'voting', currentRound: 1 };
  return tallyCurrentRound(admin, { ...context, cycle, rounds: [opened] });
}

/** Picks the winner among the books still tied after the runoff. */
export async function drawTiebreak(
  admin: AdminPort,
  context: ElectionContext,
  random?: () => number,
): Promise<NominationId> {
  if (context.cycle.status !== 'tiebreak') throw new ElectionError('not-a-tiebreak');
  const round = currentRound(context);
  const outcome = decideRound(round.options, round.results ?? {});
  if (outcome.kind !== 'tie') throw new ElectionError('not-a-tiebreak');

  const winner = drawWinner(outcome.tied, random);
  await declare(admin, context, winner, 'draw');
  return winner;
}

/** Ends the current book and starts the queued one, if any. */
export async function finishCurrentReading(admin: AdminPort, cycles: readonly Cycle[]) {
  const reading = findCurrentReading(cycles);
  if (!reading) throw new ElectionError('nothing-to-finish');
  await admin.finishReading(reading.id);

  const upcoming = findUpcoming(cycles);
  if (upcoming) await admin.startReading(upcoming.id);
}
