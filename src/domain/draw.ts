import type { NominationId } from './types';

/**
 * A draw anyone can check: a pseudo-random number generator, started from
 * the milliseconds when voting closed, picks one of the tied books in the
 * ballot's order. The server sets that time, so nobody picks the result, and
 * `firestore.rules` runs the same generator before accepting the winner.
 *
 * The generator is a linear congruential one (the C library's constants),
 * because Firestore rules have only integer arithmetic: no bit operations.
 * BigInt keeps every step exact, as the rules' 64-bit integers do.
 */
const MODULUS = 2n ** 31n;
const MULTIPLIER = 1_103_515_245n;
const INCREMENT = 12_345n;
const STEPS = 3;
/** The low bits of this generator repeat quickly; the number uses the high 15. */
const LOW_BITS = 2n ** 16n;

/** The pseudo-random number (0 to 32767) a closing time gives. */
export function drawNumber(closedAtMillis: number): number {
  let state = BigInt(Math.abs(Math.trunc(closedAtMillis))) % MODULUS;
  for (let step = 0; step < STEPS; step += 1) {
    state = (MULTIPLIER * state + INCREMENT) % MODULUS;
  }
  return Number(state / LOW_BITS);
}

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
  closedAtMillis: number,
): NominationId {
  const ordered = drawOrder(candidates, ballot);
  const winner = ordered[drawNumber(closedAtMillis) % ordered.length];
  if (winner === undefined) throw new Error('O sorteio precisa de pelo menos um livro.');
  return winner;
}
