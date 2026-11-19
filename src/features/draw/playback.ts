import { useEffect, useState } from 'react';

import type { BattleFrame, Hit } from './games';
import { durationOf, type Match } from './match';

/**
 * Milliseconds of the match played so far. It advances with the screen's
 * frames while `running`, and stops at the end of the match.
 */
export function usePlayback(match: Match, running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const duration = durationOf(match);

  useEffect(() => {
    if (!running) return undefined;
    let last: number | null = null;
    let request = 0;
    const tick = (now: number) => {
      const delta = last === null ? 0 : now - last;
      last = now;
      setElapsed((played) => Math.min(duration, played + delta));
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
    };
  }, [duration, running]);

  return { elapsed, duration, setElapsed };
}

/** The tick on screen and how far it is toward the next one (0 to 1). */
export function tickAt(match: Match, elapsed: number) {
  const exact = Math.min(match.frames.length - 1, Math.max(0, elapsed / match.tickMs));
  const index = Math.floor(exact);
  return { index, between: exact - index };
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Each duck's progress, smooth between ticks. */
export function raceAt(frames: Match['frames'], elapsed: number, tickMs: number): number[] {
  const race = frames as { progress: readonly number[] }[];
  const exact = Math.min(race.length - 1, elapsed / tickMs);
  const index = Math.floor(exact);
  const now = race[index]?.progress ?? [];
  const next = race[index + 1]?.progress ?? now;
  return now.map((at, duck) => lerp(at, next[duck] ?? at, exact - index));
}

/** Where the wrestlers meet, smooth between ticks. */
export function sumoAt(frames: Match['frames'], elapsed: number, tickMs: number): number {
  const bout = frames as { offset: number }[];
  const exact = Math.min(bout.length - 1, elapsed / tickMs);
  const index = Math.floor(exact);
  const now = bout[index]?.offset ?? 0;
  return lerp(now, bout[index + 1]?.offset ?? now, exact - index);
}

export interface BattleMoment {
  hp: readonly number[];
  /** The latest blow and the tick it landed on, which restarts its animation. */
  blow: { hit: Hit; tick: number } | null;
}

export function battleAt(frames: readonly BattleFrame[], index: number): BattleMoment {
  const hp = frames[index]?.hp ?? [];
  for (let tick = index; tick >= 0 && tick > index - 4; tick -= 1) {
    const hit = frames[tick]?.hit;
    if (hit) return { hp, blow: { hit, tick } };
  }
  return { hp, blow: null };
}
