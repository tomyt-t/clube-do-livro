import { describe, expect, it } from 'vitest';

import { makeBook, makeCycle } from '@/test/factories';

import { roundOf } from './round';

const winner = {
  nominationId: 'a',
  book: makeBook(),
  method: 'votes' as const,
  decidedAt: new Date(),
  drawnFrom: [],
};

describe('roundOf', () => {
  it('is idle before the first round', () => {
    expect(roundOf([])).toEqual({ kind: 'idle' });
  });

  it('follows the election first', () => {
    const reading = makeCycle({ number: 1, status: 'reading', winner });
    const voting = makeCycle({ number: 2, status: 'voting' });
    expect(roundOf([reading, voting])).toEqual({ kind: 'voting', cycle: voting });
  });

  it('then the book being read, with the one queued behind it', () => {
    const reading = makeCycle({ number: 1, status: 'reading', winner });
    const queued = makeCycle({ number: 2, status: 'upcoming', winner });
    expect(roundOf([reading, queued])).toEqual({
      kind: 'reading',
      cycle: reading,
      upcoming: queued,
    });
  });
});
