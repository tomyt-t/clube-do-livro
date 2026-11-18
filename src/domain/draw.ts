import type { NominationId } from './types';

/**
 * A draw anyone can check: the tied books keep the order of the ballot
 * (fixed when voting opened) and the winner is the one at "milliseconds when
 * voting closed" modulo their count. The server sets that time, so nobody
 * picks the result, and `firestore.rules` recomputes it before accepting the
 * winner.
 */

/** The tied books in the ballot's order, whatever order they are given in. */
export function drawOrder(
  candidates: readonly NominationId[],
  ballot: readonly NominationId[],
): NominationId[] {
  const tied = new Set(candidates);
  return ballot.filter((option) => tied.has(option));
}

export function drawWinner(
  candidates: readonly NominationId[],
  ballot: readonly NominationId[],
  seed: number,
): NominationId {
  const ordered = drawOrder(candidates, ballot);
  const winner = ordered[Math.abs(Math.trunc(seed)) % ordered.length];
  if (winner === undefined) throw new Error('O sorteio precisa de pelo menos um livro.');
  return winner;
}
