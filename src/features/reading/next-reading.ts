import { findActiveElection, findUpcoming, isPastDeadline } from '@/domain/cycle';
import type { Book, Cycle } from '@/domain/types';

/** What comes after the current book, from the club's point of view. */
export type NextReading =
  | { kind: 'queued'; book: Book }
  | { kind: 'nominating'; cycle: Cycle; closed: boolean }
  | { kind: 'voting'; cycle: Cycle; closed: boolean }
  | { kind: 'tallying' }
  | { kind: 'none' };

/** A book already chosen comes first; then whatever election is running. */
export function nextReadingOf(cycles: readonly Cycle[], now: Date = new Date()): NextReading {
  const queued = findUpcoming(cycles)?.winner;
  if (queued) return { kind: 'queued', book: queued.book };

  const election = findActiveElection(cycles);
  if (election?.status === 'nominating') {
    const closed = isPastDeadline(election.nominationDeadline, now);
    return { kind: 'nominating', cycle: election, closed };
  }
  if (election?.status === 'voting') {
    const closed = isPastDeadline(election.votingDeadline, now);
    return { kind: 'voting', cycle: election, closed };
  }
  return election?.status === 'tallying' ? { kind: 'tallying' } : { kind: 'none' };
}
