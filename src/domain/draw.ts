import type { NominationId } from './types';

/**
 * A draw anyone can check: the tied books are put in a fixed order (by id)
 * and the winner is the one at "milliseconds when voting closed" modulo
 * their count. The server sets that time, so nobody picks the result, and
 * `firestore.rules` recomputes it before accepting the winner.
 */

/** The fixed order of the tied books: by id, as the rules compare them. */
export function drawOrder(candidates: readonly NominationId[]): NominationId[] {
  return [...candidates].sort((a, b) => (a < b ? -1 : Number(a > b)));
}

export function drawWinner(candidates: readonly NominationId[], seed: number): NominationId {
  const ordered = drawOrder(candidates);
  const winner = ordered[Math.abs(Math.trunc(seed)) % ordered.length];
  if (winner === undefined) throw new Error('O sorteio precisa de pelo menos um livro.');
  return winner;
}
