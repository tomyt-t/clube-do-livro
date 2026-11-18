import { describe, expect, it } from 'vitest';

import { decideRound, emptyTally, nextStep, rankStandings } from './tally';

describe('emptyTally', () => {
  it('starts every option at zero', () => {
    expect(emptyTally(['a', 'b'])).toEqual({ a: 0, b: 0 });
  });
});

describe('rankStandings', () => {
  it('orders by votes and computes each share', () => {
    expect(rankStandings(['a', 'b', 'c'], { a: 1, b: 3, c: 0 })).toEqual([
      { nominationId: 'b', votes: 3, share: 0.75 },
      { nominationId: 'a', votes: 1, share: 0.25 },
      { nominationId: 'c', votes: 0, share: 0 },
    ]);
  });

  it('keeps option order between tied options', () => {
    const ranked = rankStandings(['a', 'b', 'c'], { a: 2, b: 2, c: 2 });
    expect(ranked.map((standing) => standing.nominationId)).toEqual(['a', 'b', 'c']);
  });

  it('treats missing counts as zero and avoids dividing by zero', () => {
    expect(rankStandings(['a'], {})).toEqual([{ nominationId: 'a', votes: 0, share: 0 }]);
  });
});

describe('decideRound', () => {
  it('declares the single leader the winner', () => {
    expect(decideRound(['a', 'b'], { a: 3, b: 1 })).toEqual({ kind: 'winner', nominationId: 'a' });
  });

  it('reports every option tied at the top', () => {
    expect(decideRound(['a', 'b', 'c'], { a: 2, b: 1, c: 2 })).toEqual({
      kind: 'tie',
      tied: ['a', 'c'],
    });
  });

  it('treats a round with no votes as a tie between all options', () => {
    expect(decideRound(['a', 'b'], {})).toEqual({ kind: 'tie', tied: ['a', 'b'] });
  });

  it('refuses to decide a round without options', () => {
    expect(() => decideRound([], {})).toThrow();
  });
});

describe('nextStep', () => {
  it('declares the winner when there is one', () => {
    expect(nextStep('first', { kind: 'winner', nominationId: 'a' })).toEqual({
      kind: 'declare-winner',
      nominationId: 'a',
    });
  });

  it('sends a first-round tie to a runoff', () => {
    expect(nextStep('first', { kind: 'tie', tied: ['a', 'b'] })).toEqual({
      kind: 'open-runoff',
      options: ['a', 'b'],
    });
  });

  it('sends a runoff tie to a draw', () => {
    expect(nextStep('runoff', { kind: 'tie', tied: ['a', 'b'] })).toEqual({
      kind: 'draw',
      candidates: ['a', 'b'],
    });
  });
});
