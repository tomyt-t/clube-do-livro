import { describe, expect, it } from 'vitest';

import { drawOrder, drawWinner } from './draw';

const BALLOT = ['c', 'a', 'd', 'b'];

describe('drawOrder', () => {
  it("keeps the ballot's order, whatever order the tied books come in", () => {
    expect(drawOrder(['a', 'b', 'c'], BALLOT)).toEqual(['c', 'a', 'b']);
    expect(drawOrder(['b', 'c', 'a'], BALLOT)).toEqual(['c', 'a', 'b']);
  });
});

describe('drawWinner', () => {
  it('picks the book at the closing time modulo the number of books', () => {
    const closedAt = new Date('2026-11-18T21:00:00.004Z').getTime();
    expect(closedAt % 3).toBe(1);
    expect(drawWinner(['b', 'c', 'a'], BALLOT, closedAt)).toBe('a');
  });

  it('gives the same answer to everyone who checks', () => {
    expect(drawWinner(['d', 'a'], BALLOT, 1_700_000_000_001)).toBe(
      drawWinner(['a', 'd'], BALLOT, 1_700_000_000_001),
    );
  });

  it('fails loudly without candidates', () => {
    expect(() => drawWinner([], BALLOT, 5)).toThrow();
  });
});
