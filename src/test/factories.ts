import type { Book, Cycle } from '@/domain/types';

export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    title: 'Torto Arado, Itamar Vieira Junior',
    synopsis:
      'Duas irmãs crescem numa fazenda do sertão baiano, marcadas por um acidente na infância.',
    synopsisSource: null,
    synopsisUrl: 'https://example.com/torto-arado',
    coverUrl: 'https://covers.openlibrary.org/b/id/12369648-L.jpg',
    ...overrides,
  };
}

export function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: `cycle-${String(overrides.number ?? 1)}`,
    number: 1,
    status: 'nominating',
    responses: 0,
    nominationIds: [],
    nominationDeadline: null,
    votingDeadline: null,
    createdAt: new Date('2026-01-01T12:00:00Z'),
    options: [],
    ballots: 0,
    votingOpenedAt: null,
    votingClosedAt: null,
    results: null,
    winner: null,
    readingStartedAt: null,
    finishedReaders: 0,
    finishedAt: null,
    ...overrides,
  };
}
