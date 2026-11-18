import { drawOrder, drawWinner } from '@/domain/draw';
import { cycleIdFor } from '@/domain/flow';
import { finalists } from '@/domain/tally';
import type { Cycle, DecisionMethod, VoteResults } from '@/domain/types';

import { DEMO_BOOKS } from './books';
import {
  daysAgo,
  nominations,
  seedCurrentCycle,
  type BookKey,
  type DemoScenario,
} from './scenarios';
import type { DemoPersona, DemoState } from './state';

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { uid: 'marina', name: 'Marina', email: 'marina@example.com', note: 'organiza' },
  { uid: 'rafa', name: 'Rafa', email: 'rafa@example.com' },
  { uid: 'julia', name: 'Júlia', email: 'julia@example.com' },
  { uid: 'teo', name: 'Téo', email: 'teo@example.com' },
  { uid: 'bruno', name: 'Bruno', email: 'bruno@example.com' },
  { uid: 'lia', name: 'Lia', email: 'lia@example.com' },
  { uid: 'visitante', name: 'Visitante', email: 'visitante@example.com', note: 'fora da lista' },
];

/** Marina organizes the club; the visitor is not on the allowlist. */
export const DEMO_ADMIN = 'marina';
const OUTSIDER = 'visitante';

interface PastCycle {
  number: number;
  winner: BookKey;
  method: DecisionMethod;
  /** Six members, two votes each: [votes, first choices] per book. */
  results: Partial<Record<BookKey, [number, number]>>;
  startedDaysAgo: number;
  finishedDaysAgo: number | null;
}

function resultsOf(past: PastCycle): VoteResults {
  const entries = Object.entries(past.results);
  return {
    votes: Object.fromEntries(entries.map(([key, [votes]]) => [key, votes])),
    firsts: Object.fromEntries(entries.map(([key, [, firsts]]) => [key, firsts])),
  };
}

/**
 * A draw is fixed by the closing time, so the demo picks the first closing
 * time from `around` that really gives the seeded winner: anyone can check it
 * like a real one.
 */
function closingTimeFor(past: PastCycle, around: Date): Date {
  if (past.method !== 'draw') return around;
  const options = Object.keys(past.results);
  const tied = finalists(options, resultsOf(past));
  let ms = around.getTime();
  while (drawWinner(tied, options, ms) !== past.winner) ms += 1;
  return new Date(ms);
}

function pastCycle(now: Date, past: PastCycle): Cycle {
  const decidedAt = closingTimeFor(past, daysAgo(now, past.startedDaysAgo));
  const options = Object.keys(past.results);
  const results = resultsOf(past);
  return {
    id: cycleIdFor(past.number),
    number: past.number,
    status: past.finishedDaysAgo === null ? 'reading' : 'finished',
    responses: 6,
    nominationIds: options,
    nominationDeadline: null,
    votingDeadline: null,
    createdAt: daysAgo(now, past.startedDaysAgo + 7),
    options,
    ballots: 6,
    votingOpenedAt: daysAgo(now, past.startedDaysAgo + 3),
    votingClosedAt: decidedAt,
    results,
    winner: {
      nominationId: past.winner,
      book: DEMO_BOOKS[past.winner],
      method: past.method,
      decidedAt,
      drawnFrom: past.method === 'draw' ? drawOrder(finalists(options, results), options) : [],
    },
    readingStartedAt: decidedAt,
    finishedReaders: past.finishedDaysAgo === null ? 0 : 6,
    finishedAt: past.finishedDaysAgo === null ? null : daysAgo(now, past.finishedDaysAgo),
    review: { conflicts: [] },
    merged: {},
    letGo: [],
    letGoAt: null,
    flagged: [],
  };
}

/** One cycle for each way of winning: votes, first choices and a draw. */
const PAST_CYCLES: PastCycle[] = [
  {
    number: 1,
    winner: 'hora',
    method: 'votes',
    results: { hora: [5, 3], dom: [3, 1], vidas: [2, 1], quarto: [2, 1] },
    startedDaysAgo: 120,
    finishedDaysAgo: 90,
  },
  {
    number: 2,
    winner: 'torto',
    method: 'first-choices',
    results: { torto: [4, 3], ensaio: [4, 1], bras: [2, 1], avesso: [2, 1] },
    startedDaysAgo: 85,
    finishedDaysAgo: 45,
  },
  {
    number: 3,
    winner: 'cem',
    method: 'draw',
    results: { avesso: [4, 2], cem: [4, 2], quarto: [4, 2] },
    startedDaysAgo: 40,
    finishedDaysAgo: null,
  },
];

function seedPastCycle(state: DemoState, now: Date, past: PastCycle) {
  const cycle = pastCycle(now, past);
  state.cycles[cycle.id] = cycle;
  state.nominations[cycle.id] = nominations(cycle.options as BookKey[]);
  state.tallies[cycle.id] = cycle.results ?? undefined;
}

export function createDemoState(
  now: Date = new Date(),
  scenario: DemoScenario = 'nominating',
): DemoState {
  const state: DemoState = {
    session: null,
    allowlist: {},
    members: {},
    cycles: {},
    nominations: {},
    answers: {},
    tallies: {},
    receipts: {},
    readers: {},
    settings: { members: 0 },
  };
  DEMO_PERSONAS.filter((persona) => persona.uid !== OUTSIDER).forEach((persona) => {
    state.allowlist[persona.email] = { admin: persona.uid === DEMO_ADMIN };
    state.members[persona.uid] = { uid: persona.uid, name: persona.name, photoURL: null };
  });
  state.settings.members = Object.keys(state.allowlist).length;
  PAST_CYCLES.forEach((past) => {
    seedPastCycle(state, now, past);
  });
  seedCurrentCycle(state, now, scenario);
  return state;
}

/** Only the allowlist and members: for tests that build their own cycles. */
export function createEmptyDemoState(): DemoState {
  const state = createDemoState();
  return { ...state, cycles: {}, nominations: {}, answers: {}, tallies: {}, readers: {} };
}
