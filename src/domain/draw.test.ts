import { describe, expect, it } from 'vitest';

import { drawWinner, secureRandom } from './draw';

describe('drawWinner', () => {
  it('maps the random value onto the candidate list', () => {
    expect(drawWinner(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(drawWinner(['a', 'b', 'c'], () => 0.5)).toBe('b');
    expect(drawWinner(['a', 'b', 'c'], () => 0.9999)).toBe('c');
  });

  it('only ever returns one of the candidates', () => {
    const candidates = ['a', 'b'];
    for (let i = 0; i < 50; i += 1) {
      expect(candidates).toContain(drawWinner(candidates));
    }
  });

  it('fails loudly without candidates', () => {
    expect(() => drawWinner([], () => 0)).toThrow();
  });
});

describe('secureRandom', () => {
  it('stays within [0, 1)', () => {
    for (let i = 0; i < 50; i += 1) {
      const value = secureRandom();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
