import type { NominationId } from './types';

/** Uniform number in [0, 1) from the platform's cryptographic generator. */
export function secureRandom(): number {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value / 2 ** 32;
}

export function drawWinner(
  candidates: readonly NominationId[],
  random: () => number = secureRandom,
): NominationId {
  const index = Math.floor(random() * candidates.length);
  const winner = candidates[index];
  if (winner === undefined) throw new Error('O sorteio precisa de pelo menos um livro.');
  return winner;
}
