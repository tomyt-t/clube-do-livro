import { describe, expect, it } from 'vitest';

import { drawOrder, drawWinner } from './draw';

describe('drawOrder', () => {
  it('puts the tied books in a fixed order, whatever order they came in', () => {
    expect(drawOrder(['c', 'a', 'b'])).toEqual(['a', 'b', 'c']);
    expect(drawOrder(['b', 'c', 'a'])).toEqual(['a', 'b', 'c']);
  });
});

describe('drawWinner', () => {
  it('picks the book at the closing time modulo the number of books', () => {
    const closedAt = new Date('2026-11-18T21:00:00.004Z').getTime();
    expect(closedAt % 3).toBe(1);
    expect(drawWinner(['c', 'a', 'b'], closedAt)).toBe('b');
  });

  it('gives the same answer to everyone who checks', () => {
    expect(drawWinner(['x', 'y'], 1_700_000_000_001)).toBe(
      drawWinner(['y', 'x'], 1_700_000_000_001),
    );
  });

  it('fails loudly without candidates', () => {
    expect(() => drawWinner([], 5)).toThrow();
  });
});
