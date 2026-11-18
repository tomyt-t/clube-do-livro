import { describe, expect, it } from 'vitest';

import { addBallot, decide, emptyResults, finalists, rankStandings } from './tally';
import type { VoteResults } from './types';

const results = (votes: Record<string, number>, firsts: Record<string, number>): VoteResults => ({
  votes,
  firsts,
});

describe('emptyResults and addBallot', () => {
  it('counts every choice as a vote and the first one also as a first choice', () => {
    let tally = emptyResults(['a', 'b', 'c']);
    tally = addBallot(tally, ['b', 'c']);
    tally = addBallot(tally, ['c', 'a']);
    expect(tally).toEqual({ votes: { a: 1, b: 1, c: 2 }, firsts: { a: 0, b: 1, c: 1 } });
  });
});

describe('rankStandings', () => {
  it('orders by votes, then by first choices, and computes shares', () => {
    const ranked = rankStandings(
      ['a', 'b', 'c'],
      results({ a: 2, b: 4, c: 2 }, { a: 0, b: 1, c: 2 }),
    );
    expect(ranked).toEqual([
      { nominationId: 'b', votes: 4, firsts: 1, share: 0.5 },
      { nominationId: 'c', votes: 2, firsts: 2, share: 0.25 },
      { nominationId: 'a', votes: 2, firsts: 0, share: 0.25 },
    ]);
  });

  it('avoids dividing by zero', () => {
    expect(rankStandings(['a'], emptyResults(['a']))[0]?.share).toBe(0);
  });
});

describe('finalists', () => {
  it('keeps the books tied on votes and on first choices', () => {
    const tied = results({ a: 5, b: 5, c: 5, d: 1 }, { a: 2, b: 2, c: 1, d: 1 });
    expect(finalists(['a', 'b', 'c', 'd'], tied)).toEqual(['a', 'b']);
  });

  it('narrows down to one book when the rule decides', () => {
    expect(finalists(['a', 'b'], results({ a: 3, b: 2 }, { a: 0, b: 2 }))).toEqual(['a']);
  });
});

describe('decide', () => {
  it('gives it to the most votes, whatever the first choices say', () => {
    // 2 first + 8 second (10 votes) beats 7 first + 2 second (9 votes).
    const decision = decide(['a', 'b'], results({ a: 10, b: 9 }, { a: 2, b: 7 }), 0);
    expect(decision).toEqual({ nominationId: 'a', method: 'votes', drawnFrom: [] });
  });

  it('breaks a tie by first choices', () => {
    const decision = decide(
      ['a', 'b', 'c'],
      results({ a: 5, b: 5, c: 5 }, { a: 1, b: 3, c: 1 }),
      0,
    );
    expect(decision).toEqual({ nominationId: 'b', method: 'first-choices', drawnFrom: [] });
  });

  it("draws among the books still tied, in the ballot's order, by the closing time", () => {
    const tied = results({ a: 5, b: 5, c: 5 }, { a: 2, b: 2, c: 1 });
    expect(decide(['c', 'b', 'a'], tied, 1_000)).toEqual({
      nominationId: 'b',
      method: 'draw',
      drawnFrom: ['b', 'a'],
    });
    expect(decide(['c', 'b', 'a'], tied, 1_001).nominationId).toBe('a');
  });

  it('treats a single nomination as unopposed', () => {
    expect(decide(['a'], emptyResults(['a']), 0).method).toBe('unopposed');
  });

  it('draws among everyone when nobody voted', () => {
    expect(decide(['a', 'b'], emptyResults(['a', 'b']), 0).method).toBe('draw');
  });

  it('refuses to decide without options', () => {
    expect(() => decide([], emptyResults([]), 0)).toThrow();
  });
});
