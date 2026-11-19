import {
  battle,
  MAX_TICKS,
  race,
  sumo,
  TARGET_TICKS,
  type BattleFrame,
  type RaceFrame,
  type Run,
  type SumoFrame,
} from './games';
import { pick, seeded, type Random } from './random';

/**
 * The match a device shows for a draw already decided. Many matches are
 * played off screen and the closest one of a good length is kept; the
 * player that won it then wears the winning cover, so the show always ends
 * on the recorded result.
 */

export type GameKind = 'race' | 'battle' | 'sumo';

export const MIN_MS = 8000;
export const MAX_MS = 15_000;
const TICK_MS = 100;
const TRIES = 50;

interface Timing {
  /** How long each tick lasts on screen; the whole match stays within 8–15 s. */
  tickMs: number;
}

export type Match =
  | ({ game: 'race' } & Run<RaceFrame> & Timing)
  | ({ game: 'battle' } & Run<BattleFrame> & Timing)
  | ({ game: 'sumo' } & Run<SumoFrame> & Timing);

export const durationOf = (match: Match) => (match.frames.length - 1) * match.tickMs;

/** Sumo is for two; the race and the battle take any number. */
export function gamesFor(players: number): GameKind[] {
  return players === 2 ? ['race', 'battle', 'sumo'] : ['race', 'battle'];
}

const fits = (run: Run<unknown>) =>
  run.frames.length >= TARGET_TICKS * 0.8 && run.frames.length <= MAX_TICKS;

/** The closest of many matches of a good length (or the closest of all, if none fits). */
function closest<F>(play: () => Run<F>): Run<F> {
  const runs = Array.from({ length: TRIES }, play);
  const fitting = runs.filter(fits);
  const pool = fitting.length > 0 ? fitting : runs;
  return pool.reduce((best, run) => (run.suspense > best.suspense ? run : best));
}

/** Stretched or squeezed, if needed, to last between 8 and 15 seconds. */
function timed(frames: number): Timing {
  const ticks = Math.max(1, frames - 1);
  return { tickMs: Math.min(MAX_MS / ticks, Math.max(MIN_MS / ticks, TICK_MS)) };
}

function play(game: GameKind, random: Random, players: number): Match {
  if (game === 'sumo') {
    const run = closest(() => sumo(random));
    return { game, ...run, ...timed(run.frames.length) };
  }
  if (game === 'battle') {
    const run = closest(() => battle(random, players));
    return { game, ...run, ...timed(run.frames.length) };
  }
  const run = closest(() => race(random, players));
  return { game, ...run, ...timed(run.frames.length) };
}

/** The same seed (the cycle and its draw time) always plays the same match. */
export function planMatch(players: number, seed: string): Match {
  const random = seeded(seed);
  const games = gamesFor(players);
  const game = games[pick(random, games.length)] ?? 'race';
  return play(game, random, players);
}

/**
 * Who plays as whom: the match's winner gets the winning reading; the
 * others take the rest in ballot order.
 */
export function castOf<T>(tied: readonly T[], winner: number, matchWinner: number): T[] {
  const champion = tied[winner];
  if (champion === undefined) return [...tied];
  const others = tied.filter((_, index) => index !== winner);
  return tied.map((_, seat) => (seat === matchWinner ? champion : (others.shift() ?? champion)));
}
