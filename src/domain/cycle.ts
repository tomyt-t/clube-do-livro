import { isLetGoSettled } from './review';
import type { Cycle, CycleStatus } from './types';

const ELECTION_STATUSES: readonly CycleStatus[] = ['nominating', 'voting', 'tallying'];

function latest(cycles: readonly Cycle[], statuses: readonly CycleStatus[]): Cycle | null {
  return cycles
    .filter((cycle) => statuses.includes(cycle.status))
    .reduce<Cycle | null>(
      (best, cycle) => (!best || cycle.number > best.number ? cycle : best),
      null,
    );
}

/** The cycle currently collecting nominations or votes, if any. */
export function findActiveElection(cycles: readonly Cycle[]): Cycle | null {
  return latest(cycles, ELECTION_STATUSES);
}

export function findCurrentReading(cycles: readonly Cycle[]): Cycle | null {
  return latest(cycles, ['reading']);
}

export function findUpcoming(cycles: readonly Cycle[]): Cycle | null {
  return latest(cycles, ['upcoming']);
}

/** Books already read, newest first. */
export function finishedCycles(cycles: readonly Cycle[]): Cycle[] {
  return cycles.filter((cycle) => cycle.status === 'finished').sort((a, b) => b.number - a.number);
}

export function nextCycleNumber(cycles: readonly Cycle[]): number {
  return cycles.reduce((max, cycle) => Math.max(max, cycle.number), 0) + 1;
}

/**
 * A decided book starts right away, unless the round before is still being
 * read (or waiting to be): then it waits its turn. The rules check the same.
 */
export function statusAfterDecision(
  cycles: readonly Cycle[],
  decided: Pick<Cycle, 'number'>,
): 'reading' | 'upcoming' {
  const previous = cycles.find((cycle) => cycle.number === decided.number - 1);
  const busy = previous?.status === 'reading' || previous?.status === 'upcoming';
  return busy ? 'upcoming' : 'reading';
}

export type ElectionStep = 'nominations' | 'voting' | 'result';

export function electionStep(status: CycleStatus): ElectionStep {
  if (status === 'nominating') return 'nominations';
  if (status === 'voting' || status === 'tallying') return 'voting';
  return 'result';
}

export function isPastDeadline(deadline: Date | null, now: Date = new Date()): boolean {
  return deadline !== null && now.getTime() >= deadline.getTime();
}

/**
 * A round nobody nominated in, once it can get no more nominations (everyone
 * answered, or the deadline is over): there is nothing to vote on, so it can
 * only end. The rules check the same.
 */
export function isEmptyRoundOver(cycle: Cycle, members: number, now = new Date()): boolean {
  return (
    cycle.status === 'nominating' &&
    cycle.nominationIds.length === 0 &&
    isLetGoSettled(cycle, now) &&
    (cycle.responses >= members ||
      (cycle.nominationDeadline !== null && now > cycle.nominationDeadline))
  );
}
