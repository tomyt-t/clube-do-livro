import type { Cycle, CycleId } from '@/domain/types';

/** A cycle just opened: nominations open, every counter at zero. */
export function newDemoCycle(id: CycleId, number: number, nominationDeadline: Date | null): Cycle {
  return {
    id,
    number,
    status: 'nominating',
    responses: 0,
    nominationIds: [],
    nominationDeadline,
    votingDeadline: null,
    createdAt: new Date(),
    options: [],
    ballots: 0,
    votingOpenedAt: null,
    votingClosedAt: null,
    results: null,
    winner: null,
    readingStartedAt: null,
    finishedReaders: 0,
    finishedAt: null,
    review: null,
    merged: {},
    letGo: [],
    letGoAt: null,
    flagged: [],
  };
}
