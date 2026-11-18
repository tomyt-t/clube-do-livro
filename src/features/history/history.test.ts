import { describe, expect, it } from 'vitest';

import { makeBook, makeCycle } from '@/test/factories';

import { chartRows, decidedCycles, formatClosingTime, joinNames, readingPeriod } from './history';

const winner = (nominationId: string) => ({
  nominationId,
  book: makeBook(),
  method: 'votes' as const,
  decidedAt: new Date(2026, 9, 9, 12),
  drawnFrom: [],
});

describe('decidedCycles', () => {
  it('keeps the cycles that chose a book, newest first', () => {
    const cycles = [
      makeCycle({ number: 1, status: 'finished', winner: winner('a') }),
      makeCycle({ number: 3, status: 'nominating' }),
      makeCycle({ number: 2, status: 'reading', winner: winner('b') }),
    ];
    expect(decidedCycles(cycles).map((cycle) => cycle.number)).toEqual([2, 1]);
  });
});

describe('chartRows', () => {
  it('orders by votes, then first choices, and splits first and second choices', () => {
    const cycle = makeCycle({
      options: ['a', 'b', 'c'],
      results: { votes: { a: 3, b: 4, c: 3 }, firsts: { a: 2, b: 1, c: 0 } },
      winner: winner('b'),
    });
    const nominations = [
      { id: 'a', book: makeBook({ title: 'Torto Arado, Itamar Vieira Junior' }) },
      { id: 'b', book: makeBook({ title: 'Watchmen / Alan Moore' }) },
      { id: 'c', book: makeBook({ title: 'Berserk' }) },
    ];
    expect(chartRows(cycle, nominations)).toEqual([
      {
        id: 'b',
        title: 'Watchmen',
        author: 'Alan Moore',
        votes: 4,
        firsts: 1,
        seconds: 3,
        winner: true,
      },
      {
        id: 'a',
        title: 'Torto Arado',
        author: 'Itamar Vieira Junior',
        votes: 3,
        firsts: 2,
        seconds: 1,
        winner: false,
      },
      { id: 'c', title: 'Berserk', author: null, votes: 3, firsts: 0, seconds: 3, winner: false },
    ]);
  });
});

describe('readingPeriod', () => {
  const start = new Date(2026, 9, 9, 12);
  const end = new Date(2026, 10, 12, 12);

  it('says when the book was read, is being read or is waiting', () => {
    expect(
      readingPeriod(makeCycle({ status: 'finished', readingStartedAt: start, finishedAt: end })),
    ).toBe('Lida de 9 de out. a 12 de nov.');
    expect(readingPeriod(makeCycle({ status: 'reading', readingStartedAt: start }))).toBe(
      'Lendo desde 9 de out.',
    );
    expect(readingPeriod(makeCycle({ status: 'upcoming' }))).toBe('Na fila para ser lida');
  });
});

describe('small formats', () => {
  it('joins names the Portuguese way', () => {
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A e B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B e C');
  });

  it('shows the closing time down to the millisecond', () => {
    expect(formatClosingTime(new Date(2026, 10, 18, 21, 3, 12, 4))).toBe('21:03:12,004');
  });
});
