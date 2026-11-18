import { findActiveElection, findCurrentReading, findUpcoming } from '@/domain/cycle';
import type { Cycle } from '@/domain/types';

/** Where the club stands, from the organizer's point of view. */
export type Round =
  | { kind: 'idle' }
  | { kind: 'nominating'; cycle: Cycle }
  | { kind: 'voting'; cycle: Cycle }
  | { kind: 'tallying'; cycle: Cycle }
  | { kind: 'reading'; cycle: Cycle; upcoming: Cycle | null };

export function roundOf(cycles: readonly Cycle[]): Round {
  const election = findActiveElection(cycles);
  if (election?.status === 'nominating') return { kind: 'nominating', cycle: election };
  if (election?.status === 'voting') return { kind: 'voting', cycle: election };
  if (election?.status === 'tallying') return { kind: 'tallying', cycle: election };
  const reading = findCurrentReading(cycles);
  return reading
    ? { kind: 'reading', cycle: reading, upcoming: findUpcoming(cycles) }
    : { kind: 'idle' };
}
