import { describe, expect, it } from 'vitest';

import { drawNumber, drawOrder, drawWinner } from './draw';

const BALLOT = ['c', 'a', 'd', 'b'];

describe('drawNumber', () => {
  it('gives the same number for the same closing time, as the server rules do', () => {
    // Pinned: firestore.rules computes these exact values too.
    expect(drawNumber(0)).toBe(9988);
    expect(drawNumber(1)).toBe(10113);
    expect(drawNumber(1_700_000_000_001)).toBe(25876);
  });

  it('spreads closing times evenly among the tied books', () => {
    const counts = [0, 0, 0];
    for (let ms = 1_700_000_000_000; ms < 1_700_000_030_000; ms += 1) {
      const index = drawNumber(ms) % 3;
      counts[index] = (counts[index] ?? 0) + 1;
    }
    for (const count of counts) expect(count).toBeGreaterThan(9_700);
  });
});

describe('drawOrder', () => {
  it("keeps the ballot's order, whatever order the tied books come in", () => {
    expect(drawOrder(['a', 'b', 'c'], BALLOT)).toEqual(['c', 'a', 'b']);
    expect(drawOrder(['b', 'c', 'a'], BALLOT)).toEqual(['c', 'a', 'b']);
  });
});

describe('drawWinner', () => {
  it("picks the book the closing time's number lands on", () => {
    const closedAt = new Date('2026-11-18T21:00:00.004Z').getTime();
    expect(drawNumber(closedAt) % 3).toBe(1);
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
