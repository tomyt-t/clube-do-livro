/** A number from 0 (inclusive) to 1 (exclusive). */
export type Random = () => number;

/** A string hashed to 32 bits (MurmurHash3's mixing), the seed of `seeded`. */
function hash(text: string): number {
  let h = 1_779_033_703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3_432_918_353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/**
 * Mulberry32: small, fast and good enough to stage a match. The same seed
 * always plays the same match, so it is never the source of the result
 * (the draw in `domain/draw.ts` is), only of how it looks.
 */
export function seeded(seed: string): Random {
  let state = hash(seed);
  const next = () => {
    state = (state + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  // Seeds that differ in one character start out alike; a few rounds mix them apart.
  for (let warmUp = 0; warmUp < 4; warmUp += 1) next();
  return next;
}

export const between = (random: Random, low: number, high: number) => low + (high - low) * random();

export const chance = (random: Random, probability: number) => random() < probability;

/** A whole number from 0 to `count - 1`. */
export const pick = (random: Random, count: number) => Math.floor(random() * count);
