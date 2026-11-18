import { addBallot, emptyResults } from '@/domain/tally';
import type { Cycle, Nomination } from '@/domain/types';

import { DEMO_BOOKS } from './books';
import type { DemoState } from './state';

/**
 * Where the demo's current cycle (number 4) stands, so each screen of the
 * election can be tried without the organizer's controls.
 */
export type DemoScenario = 'nominating' | 'voting';

export const DEMO_SCENARIOS: readonly { id: DemoScenario; label: string }[] = [
  { id: 'nominating', label: 'Indicações' },
  { id: 'voting', label: 'Votação' },
];

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
    id: 'c4',
    number: 4,
    status: 'nominating',
    responses: 0,
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
    finishedAt: null,
    ...changes,
  };
}

/** Three members answered; Marina has not. */
function seedNominating(state: DemoState, now: Date) {
  state.cycles.c4 = currentCycle(now, {
    responses: 3,
    nominationDeadline: new Date(now.getTime() + 3 * DAY),
  });
  state.nominations.c4 = nominations(['ensaio', 'bras']);
  state.answers.c4 = {
    rafa: { kind: 'nominated', nominationId: 'ensaio' },
    julia: { kind: 'nominated', nominationId: 'bras' },
    teo: { kind: 'passed' },
  };
}

const VOTING_OPTIONS: BookKey[] = ['ensaio', 'bras', 'dom', 'vidas', 'quarto'];

/** Five nominations; Téo and Bruno already voted, Marina (who passed) has not. */
function seedVoting(state: DemoState, now: Date) {
  state.cycles.c4 = currentCycle(now, {
    status: 'voting',
    responses: 6,
    options: VOTING_OPTIONS,
    ballots: 2,
    votingOpenedAt: daysAgo(now, 1),
    votingDeadline: new Date(now.getTime() + 2 * DAY),
  });
  state.nominations.c4 = nominations(VOTING_OPTIONS);
  state.answers.c4 = {
    rafa: { kind: 'nominated', nominationId: 'ensaio' },
    julia: { kind: 'nominated', nominationId: 'bras' },
    teo: { kind: 'nominated', nominationId: 'dom' },
    bruno: { kind: 'nominated', nominationId: 'vidas' },
    lia: { kind: 'nominated', nominationId: 'quarto' },
    marina: { kind: 'passed' },
  };
  const opened = emptyResults(VOTING_OPTIONS);
  state.tallies.c4 = addBallot(addBallot(opened, ['bras', 'ensaio']), ['quarto', 'dom']);
  state.receipts.c4 = ['teo', 'bruno'];
}

export function seedCurrentCycle(state: DemoState, now: Date, scenario: DemoScenario) {
  if (scenario === 'voting') seedVoting(state, now);
  else seedNominating(state, now);
}
