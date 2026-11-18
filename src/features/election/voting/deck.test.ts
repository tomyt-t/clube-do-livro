import { describe, expect, it } from 'vitest';

import { cardAfter, swipeDirection } from './deck';

describe('swipeDirection', () => {
  it('moves on after a long or fast drag, never on a nudge', () => {
    expect(swipeDirection({ offset: { x: -120 }, velocity: { x: 0 } })).toBe(1);
    expect(swipeDirection({ offset: { x: 90 }, velocity: { x: 0 } })).toBe(-1);
    expect(swipeDirection({ offset: { x: -20 }, velocity: { x: -900 } })).toBe(1);
    expect(swipeDirection({ offset: { x: 30 }, velocity: { x: 50 } })).toBe(0);
  });
});

describe('cardAfter', () => {
  it('wraps around both ends', () => {
    expect(cardAfter(4, 1, 5)).toBe(0);
    expect(cardAfter(0, -1, 5)).toBe(4);
    expect(cardAfter(0, 1, 0)).toBe(0);
  });
});
