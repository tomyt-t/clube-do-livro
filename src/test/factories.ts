import type { Book, Cycle, Round } from '@/domain/types';

export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    title: 'Torto Arado',
    authors: ['Itamar Vieira Junior'],
    synopsis: 'Duas irmãs no sertão baiano.',
    synopsisUrl: 'https://example.com/torto-arado',
    coverUrl: 'https://covers.openlibrary.org/b/id/12369648-L.jpg',
    publishedYear: 2019,
    pageCount: 264,
    ...overrides,
  };
}

export function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: `cycle-${String(overrides.number ?? 1)}`,
    number: 1,
    status: 'nominating',
    currentRound: 0,
    responses: 0,
    nominationDeadline: null,
    votingDeadline: null,
    createdAt: new Date('2026-01-01T12:00:00Z'),
    winner: null,
    readingStartedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

export function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    number: 1,
    kind: 'first',
    options: ['a', 'b', 'c'],
    votesPerMember: 2,
    status: 'open',
    ballots: 0,
    openedAt: new Date('2026-01-02T12:00:00Z'),
    closedAt: null,
    results: null,
    ...overrides,
  };
}
