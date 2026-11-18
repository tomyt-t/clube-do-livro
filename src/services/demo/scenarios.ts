import { cycleIdFor } from '@/domain/flow';
import { addBallot, emptyResults } from '@/domain/tally';
import type { Cycle, Nomination } from '@/domain/types';

import { DEMO_BOOKS } from './books';
import type { DemoState } from './state';

/**
 * Where the demo's current cycle (number 4) stands, so each screen of the
 * election can be tried without the organizer's controls.
 */
export type DemoScenario = 'nominating' | 'voting' | 'reading';

export const DEMO_SCENARIOS: readonly { id: DemoScenario; label: string }[] = [
  { id: 'nominating', label: 'Indicações' },
  { id: 'voting', label: 'Votação' },
  { id: 'reading', label: 'Lendo' },
];

const READING = cycleIdFor(3);
const CURRENT = cycleIdFor(4);

export type BookKey = keyof typeof DEMO_BOOKS;

export const DAY = 24 * 60 * 60 * 1000;

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY);
}

export function nominations(keys: readonly BookKey[]): Nomination[] {
  return keys.map((key) => ({ id: key, book: DEMO_BOOKS[key] }));
}

function currentCycle(now: Date, changes: Partial<Cycle>): Cycle {
  return {
    id: CURRENT,
    number: 4,
    status: 'nominating',
    responses: 0,
    nominationIds: [],
    nominationDeadline: null,
    votingDeadline: null,
    createdAt: daysAgo(now, 4),
    options: [],
    ballots: 0,
    votingOpenedAt: null,
    votingClosedAt: null,
    results: null,
    winner: null,
    readingStartedAt: null,
    finishedReaders: 0,
    finishedAt: null,
    ...changes,
  };
}

/** Three members answered; Marina has not. */
function seedNominating(state: DemoState, now: Date) {
  state.cycles[CURRENT] = currentCycle(now, { responses: 3, nominationIds: ['ensaio', 'bras'] });
  state.nominations[CURRENT] = nominations(['ensaio', 'bras']);
  state.answers[CURRENT] = {
    rafa: { kind: 'nominated', nominationId: 'ensaio' },
    julia: { kind: 'nominated', nominationId: 'bras' },
    teo: { kind: 'passed' },
  };
}

const VOTING_OPTIONS: BookKey[] = ['ensaio', 'bras', 'dom', 'vidas', 'quarto'];

/** Five nominations; Téo and Bruno already voted, Marina (who passed) has not. */
function seedVoting(state: DemoState, now: Date) {
  state.cycles[CURRENT] = currentCycle(now, {
    status: 'voting',
    responses: 6,
    nominationIds: VOTING_OPTIONS,
    options: VOTING_OPTIONS,
    ballots: 2,
    votingOpenedAt: daysAgo(now, 1),
  });
  state.nominations[CURRENT] = nominations(VOTING_OPTIONS);
  state.answers[CURRENT] = {
    rafa: { kind: 'nominated', nominationId: 'ensaio' },
    julia: { kind: 'nominated', nominationId: 'bras' },
    teo: { kind: 'nominated', nominationId: 'dom' },
    bruno: { kind: 'nominated', nominationId: 'vidas' },
    lia: { kind: 'nominated', nominationId: 'quarto' },
    marina: { kind: 'passed' },
  };
  const opened = emptyResults(VOTING_OPTIONS);
  state.tallies[CURRENT] = addBallot(addBallot(opened, ['bras', 'ensaio']), ['quarto', 'dom']);
  state.receipts[CURRENT] = ['teo', 'bruno'];
}

/** No election yet: everyone but Marina finished the book, so her mark opens round 4. */
function seedReading(state: DemoState) {
  const readers = ['rafa', 'julia', 'teo', 'bruno', 'lia'];
  state.readers[READING] = readers;
  const reading = state.cycles[READING];
  if (reading) reading.finishedReaders = readers.length;
}

export function seedCurrentCycle(state: DemoState, now: Date, scenario: DemoScenario) {
  if (scenario === 'voting') seedVoting(state, now);
  else if (scenario === 'reading') seedReading(state);
  else seedNominating(state, now);
  if (scenario !== 'reading') state.readers[READING] = ['teo', 'lia'];
  const reading = state.cycles[READING];
  if (reading && scenario !== 'reading') reading.finishedReaders = 2;
}
