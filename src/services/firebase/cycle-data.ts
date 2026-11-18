import { serverTimestamp } from 'firebase/firestore';

/** A cycle as `firestore.rules` accepts it at creation: nominations open, every counter at zero. */
export function newCycleData(number: number, nominationDeadline: Date | null) {
  return {
    number,
    status: 'nominating',
    responses: 0,
    nominationIds: [],
    nominationDeadline,
    votingDeadline: null,
    createdAt: serverTimestamp(),
    options: [],
    ballots: 0,
    votingOpenedAt: null,
    votingClosedAt: null,
    results: null,
    winner: null,
    readingStartedAt: null,
    finishedReaders: 0,
    finishedAt: null,
  };
}
