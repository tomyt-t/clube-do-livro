import { describe, expect, it } from 'vitest';

import { castOf, durationOf, gamesFor, MAX_MS, MIN_MS, planMatch, type Match } from './match';

const lastFrame = (match: Match) => match.frames[match.frames.length - 1];

/** Who is ahead at the end, read from the last frame as the screen shows it. */
function shownWinner(match: Match): number {
  const frame = lastFrame(match);
  if (!frame) throw new Error('A match without frames.');
  if ('progress' in frame) return frame.progress.indexOf(Math.max(...frame.progress));
  if ('hp' in frame) return frame.hp.findIndex((hp) => hp > 0);
  return frame.offset >= 1 ? 0 : 1;
}

describe('planMatch', () => {
  it('plays the same match for the same seed, and another for another seed', () => {
    const one = planMatch(5, 'ciclo-3:1700000000001');
    expect(planMatch(5, 'ciclo-3:1700000000001')).toEqual(one);
    const others = ['a', 'b', 'c', 'd'].map((seed) => planMatch(5, seed));
    expect(others.some((match) => JSON.stringify(match) !== JSON.stringify(one))).toBe(true);
  });

  it('lasts 8 to 15 seconds and ends on the winner it reports, from 2 to 16 players', () => {
    for (let players = 2; players <= 16; players += 1) {
      for (const seed of ['x', 'y', 'z']) {
        const match = planMatch(players, `${seed}${String(players)}`);
        expect(durationOf(match)).toBeGreaterThanOrEqual(MIN_MS - 1);
        expect(durationOf(match)).toBeLessThanOrEqual(MAX_MS + 1);
        expect(shownWinner(match)).toBe(match.winner);
        expect(match.winner).toBeLessThan(players);
      }
    }
  });

  it('wrestles only with two players, and every game comes up', () => {
    expect(gamesFor(2)).toContain('sumo');
    expect(gamesFor(3)).not.toContain('sumo');
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => planMatch(2, `seed-${String(i)}`).game),
    );
    expect(seen).toEqual(new Set(['race', 'battle', 'sumo']));
  });
});

describe('castOf', () => {
  it('puts the recorded winner on the player that wins the match', () => {
    const tied = ['avesso', 'cem', 'quarto'];
    for (let seat = 0; seat < 3; seat += 1) {
      const cast = castOf(tied, 1, seat);
      expect(cast[seat]).toBe('cem');
      expect([...cast].sort()).toEqual([...tied].sort());
    }
  });
});
