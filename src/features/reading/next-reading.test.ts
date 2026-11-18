import { describe, expect, it } from 'vitest';

import { makeBook, makeCycle } from '@/test/factories';

import { nextReadingOf } from './next-reading';

const now = new Date('2026-11-18T12:00:00Z');
const tomorrow = new Date('2026-11-19T12:00:00Z');
const yesterday = new Date('2026-11-17T12:00:00Z');

const winner = (title: string) => ({
  nominationId: 'n1',
  book: makeBook({ title }),
  method: 'votes' as const,
  decidedAt: yesterday,
  drawnFrom: [],
});

describe('nextReadingOf', () => {
  it('shows the queued book before any election', () => {
    const cycles = [
      makeCycle({ number: 1, status: 'reading', winner: winner('Atual') }),
      makeCycle({ number: 2, status: 'upcoming', winner: winner('Próximo') }),
      makeCycle({ number: 3, status: 'nominating' }),
    ];
    expect(nextReadingOf(cycles, now)).toMatchObject({
      kind: 'queued',
      book: { title: 'Próximo' },
    });
  });

  it('follows the election and notices a passed deadline', () => {
    const open = makeCycle({ status: 'nominating', nominationDeadline: tomorrow });
    const late = makeCycle({ status: 'voting', votingDeadline: yesterday });
    expect(nextReadingOf([open], now)).toMatchObject({ kind: 'nominating', closed: false });
    expect(nextReadingOf([late], now)).toMatchObject({ kind: 'voting', closed: true });
  });

  it('knows when votes are being counted, or when nothing is running', () => {
    expect(nextReadingOf([makeCycle({ status: 'tallying' })], now)).toEqual({ kind: 'tallying' });
    expect(nextReadingOf([makeCycle({ status: 'finished' })], now)).toEqual({ kind: 'none' });
    expect(nextReadingOf([], now)).toEqual({ kind: 'none' });
  });
});
