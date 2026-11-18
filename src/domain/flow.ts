import { findActiveElection, findCurrentReading, findUpcoming } from './cycle';
import type { Cycle, CycleStatus } from './types';

/**
 * The cycle moves on by itself once everyone has done their part. Until the
 * club agrees on dates, "everyone" means every member on the allowlist.
 */
export type FlowStep =
  /** Everyone answered and someone nominated: the vote opens. */
  | { kind: 'open-voting'; cycle: Cycle }
  /** Everyone voted (or there was a single nomination): the vote closes. */
  | { kind: 'close-voting'; cycle: Cycle }
  /** Voting closed: count and declare the winner. */
  | { kind: 'declare'; cycle: Cycle }
  /** Everyone finished the book: it ends and the next round opens. */
  | { kind: 'finish-reading'; cycle: Cycle };

export function everyone(count: number, members: number): boolean {
  return members > 0 && count >= members;
}

type StepFor = (cycle: Cycle, members: number) => FlowStep | null;

/** For each election status, the step that becomes ready, if any. */
const ELECTION_STEPS: Partial<Record<CycleStatus, StepFor>> = {
  nominating: (cycle, members) =>
    everyone(cycle.responses, members) && cycle.nominationIds.length > 0
      ? { kind: 'open-voting', cycle }
      : null,
  voting: (cycle, members) =>
    everyone(cycle.ballots, members) || cycle.options.length === 1
      ? { kind: 'close-voting', cycle }
      : null,
  tallying: (cycle) => ({ kind: 'declare', cycle }),
};

function electionStep(election: Cycle, members: number): FlowStep | null {
  return ELECTION_STEPS[election.status]?.(election, members) ?? null;
}

/** The one thing to do next, if anything is ready. */
export function nextFlowStep(cycles: readonly Cycle[], members: number): FlowStep | null {
  const election = findActiveElection(cycles);
  if (election) return electionStep(election, members);
  const reading = findCurrentReading(cycles);
  if (!reading || findUpcoming(cycles)) return null;
  return everyone(reading.finishedReaders, members)
    ? { kind: 'finish-reading', cycle: reading }
    : null;
}

/** Cycles have predictable ids, so the next one can only ever be opened once. */
export function cycleIdFor(number: number): string {
  return `ciclo-${String(number)}`;
}
