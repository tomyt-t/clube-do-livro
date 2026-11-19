import { between, chance, pick, type Random } from './random';

/**
 * The three games a draw can be staged as. Each one plays a whole match
 * from a random source, tick by tick, and says who won and how close it
 * was. Nothing here knows which book won: the winning player gets the
 * winning cover afterwards (see `match.ts`).
 */

/** About ten seconds at one tick per 100 ms. */
export const TARGET_TICKS = 100;
/** Longer than this is a dull match, passed over when picking one. */
export const MAX_TICKS = 150;

export interface Run<F> {
  frames: F[];
  /** The player that won, by position. */
  winner: number;
  /** Higher is closer: lead changes, a narrow finish, a near loss. */
  suspense: number;
}

const leader = (values: readonly number[]) => values.indexOf(Math.max(...values));

// ------------------------------------------------------------------- race

/** How far each duck has come, from 0 to the finish line at 1. */
export interface RaceFrame {
  progress: readonly number[];
}

interface Duck {
  at: number;
  speed: number;
  /** Ticks left of a sprint (positive) or a stumble (negative). */
  spell: number;
}

/** A sprint almost doubles the pace; a stumble nearly stops the duck. */
function boostOf(spell: number): number {
  if (spell > 0) return 1.9;
  return spell < 0 ? 0.15 : 1;
}

function stepDuck(random: Random, duck: Duck): Duck {
  let { speed, spell } = duck;
  speed = Math.min(1.5, Math.max(0.55, speed + between(random, -0.08, 0.08)));
  if (spell === 0 && chance(random, 0.035)) spell = pick(random, 6) + 4;
  else if (spell === 0 && chance(random, 0.025)) spell = -(pick(random, 5) + 3);
  const at = duck.at + (speed * boostOf(spell)) / TARGET_TICKS;
  return { at, speed, spell: spell - Math.sign(spell) };
}

/** Any number of ducks; the first across the line wins. */
export function race(random: Random, players: number): Run<RaceFrame> {
  let ducks: Duck[] = Array.from({ length: players }, () => ({
    at: 0,
    speed: between(random, 0.85, 1.15),
    spell: 0,
  }));
  const frames: RaceFrame[] = [{ progress: ducks.map(() => 0) }];
  let changes = 0;
  // Every duck keeps moving, so someone always crosses.
  while (Math.max(...ducks.map((d) => d.at)) < 1) {
    const before = leader(ducks.map((d) => d.at));
    ducks = ducks.map((duck) => stepDuck(random, duck));
    if (leader(ducks.map((d) => d.at)) !== before) changes += 1;
    frames.push({ progress: ducks.map((d) => Math.min(1, d.at)) });
  }
  const finish = ducks.map((d) => d.at);
  const winner = leader(finish);
  // Ducks crossing on the same tick: only the winner touches the line.
  frames[frames.length - 1] = {
    progress: finish.map((at, index) => (index === winner ? 1 : Math.min(at, 0.99))),
  };
  const [first = 0, second = 0] = [...finish].sort((a, b) => b - a);
  return { frames, winner, suspense: changes + Math.max(0, 4 - (first - second) * 60) };
}

// ----------------------------------------------------------------- battle

export interface Hit {
  from: number;
  to: number;
  damage: number;
}

/** Each player's health, from 1 to 0 (out), and the blow struck this tick. */
export interface BattleFrame {
  hp: readonly number[];
  hit: Hit | null;
}

/** Fewer, slower blows with few players; quicker ones in a crowd. */
function ticksPerBlowFor(players: number): number {
  if (players <= 3) return 9;
  return players <= 8 ? 6 : 4;
}

function pace(players: number) {
  const ticksPerBlow = ticksPerBlowFor(players);
  const blows = TARGET_TICKS / ticksPerBlow;
  return { ticksPerBlow, damage: (players - 0.4) / blows };
}

function blow(random: Random, hp: readonly number[], damage: number): Hit {
  const alive = hp.flatMap((value, index) => (value > 0 ? [index] : []));
  const from = alive[pick(random, alive.length)] ?? 0;
  const targets = alive.filter((index) => index !== from);
  const to = targets[pick(random, targets.length)] ?? 0;
  const strength = chance(random, 0.12) ? 2 : between(random, 0.5, 1.5);
  return { from, to, damage: damage * strength };
}

/** Everyone against everyone: blows land at random until one is left standing. */
export function battle(random: Random, players: number): Run<BattleFrame> {
  const { ticksPerBlow, damage } = pace(players);
  let hp: number[] = Array.from({ length: players }, () => 1);
  const frames: BattleFrame[] = [{ hp, hit: null }];
  let changes = 0;
  // Every blow takes health, so someone is always left alone.
  while (hp.filter((value) => value > 0).length > 1) {
    const hit = blow(random, hp, damage);
    const before = leader(hp);
    hp = hp.map((value, index) => (index === hit.to ? Math.max(0, value - hit.damage) : value));
    if (leader(hp) !== before) changes += 1;
    frames.push({ hp, hit });
    for (let wait = 1; wait < ticksPerBlow; wait += 1) frames.push({ hp, hit: null });
  }
  const winner = leader(hp);
  return { frames, winner, suspense: changes + (1 - (hp[winner] ?? 1)) * 6 };
}

// ------------------------------------------------------------------- sumo

/** Where the two meet: 0 in the middle; at -1 the left one is out, at 1 the right one. */
export interface SumoFrame {
  offset: number;
}

/** The push of the next tick: momentum, a wobble, now and then a surge, and growing fatigue. */
function nextPush(random: Random, push: number, offset: number, tick: number): number {
  const surge = chance(random, 0.06) ? between(random, -0.05, 0.05) : 0;
  // Late in the bout the one nearer the edge tires, so every bout ends.
  const fatigue = (tick / TARGET_TICKS) ** 2 * 0.004 * (offset < 0 ? -1 : 1);
  const next = push * 0.85 + between(random, -0.012, 0.012) + surge + fatigue;
  return Math.max(-0.035, Math.min(0.035, next));
}

/** Two wrestlers push until one leaves the ring. */
export function sumo(random: Random): Run<SumoFrame> {
  let offset = 0;
  let push = 0;
  let reversals = 0;
  const closest = [0, 0];
  const frames: SumoFrame[] = [{ offset }];
  while (Math.abs(offset) < 1) {
    const next = nextPush(random, push, offset, frames.length);
    if (push !== 0 && Math.sign(next) !== Math.sign(push)) reversals += 1;
    push = next;
    offset = Math.max(-1, Math.min(1, offset + push));
    closest[0] = Math.max(closest[0] ?? 0, -offset);
    closest[1] = Math.max(closest[1] ?? 0, offset);
    frames.push({ offset });
  }
  // At 1 the right one (1) is out, so the left one (0) won; how near the winner came to going out.
  const winner = offset >= 1 ? 0 : 1;
  const nearLoss = closest[winner] ?? 0;
  return { frames, winner, suspense: reversals * 0.3 + nearLoss * 6 };
}
