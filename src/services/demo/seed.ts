import type { Cycle, DecisionMethod, Nomination, VoteResults } from '@/domain/types';

import { DEMO_BOOKS } from './books';
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

type BookKey = keyof typeof DEMO_BOOKS;

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY);
}

function nominations(keys: BookKey[]): Nomination[] {
  return keys.map((key) => ({ id: key, book: DEMO_BOOKS[key] }));
}

interface PastCycle {
  id: string;
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

function pastCycle(now: Date, past: PastCycle): Cycle {
  const decidedAt = daysAgo(now, past.startedDaysAgo);
  return {
    id: past.id,
    number: past.number,
    status: past.finishedDaysAgo === null ? 'reading' : 'finished',
    responses: 6,
    nominationDeadline: null,
    votingDeadline: null,
    createdAt: daysAgo(now, past.startedDaysAgo + 7),
    options: Object.keys(past.results),
    ballots: 6,
    votingOpenedAt: daysAgo(now, past.startedDaysAgo + 3),
    votingClosedAt: decidedAt,
    results: resultsOf(past),
    winner: {
      nominationId: past.winner,
      book: DEMO_BOOKS[past.winner],
      method: past.method,
      decidedAt,
    },
    readingStartedAt: decidedAt,
    finishedAt: past.finishedDaysAgo === null ? null : daysAgo(now, past.finishedDaysAgo),
  };
}

/** One cycle for each way of winning: votes, first choices and a draw. */
const PAST_CYCLES: PastCycle[] = [
  {
    id: 'c1',
    number: 1,
    winner: 'hora',
    method: 'votes',
    results: { hora: [5, 3], dom: [3, 1], vidas: [2, 1], quarto: [2, 1] },
    startedDaysAgo: 120,
    finishedDaysAgo: 90,
  },
  {
    id: 'c2',
    number: 2,
    winner: 'torto',
    method: 'first-choices',
    results: { torto: [4, 3], ensaio: [4, 1], bras: [2, 1], avesso: [2, 1] },
    startedDaysAgo: 85,
    finishedDaysAgo: 45,
  },
  {
    id: 'c3',
    number: 3,
    winner: 'cem',
    method: 'draw',
    results: { cem: [4, 2], avesso: [4, 2], quarto: [4, 2] },
    startedDaysAgo: 40,
    finishedDaysAgo: null,
  },
];

function seedPastCycle(state: DemoState, now: Date, past: PastCycle) {
  const cycle = pastCycle(now, past);
  state.cycles[past.id] = cycle;
  state.nominations[past.id] = nominations(cycle.options as BookKey[]);
  state.tallies[past.id] = cycle.results ?? undefined;
}

/** Cycle 4 is collecting nominations; Marina has not answered yet. */
function seedOpenCycle(state: DemoState, now: Date) {
  state.cycles.c4 = {
    id: 'c4',
    number: 4,
    status: 'nominating',
    responses: 3,
    nominationDeadline: new Date(now.getTime() + 3 * DAY),
    votingDeadline: null,
    createdAt: daysAgo(now, 2),
    options: [],
    ballots: 0,
    votingOpenedAt: null,
    votingClosedAt: null,
    results: null,
    winner: null,
    readingStartedAt: null,
    finishedAt: null,
  };
  state.nominations.c4 = nominations(['ensaio', 'bras']);
  state.answers.c4 = {
    rafa: { kind: 'nominated', nominationId: 'ensaio' },
    julia: { kind: 'nominated', nominationId: 'bras' },
    teo: { kind: 'passed' },
  };
}

export function createDemoState(now: Date = new Date()): DemoState {
  const state: DemoState = {
    session: null,
    allowlist: {},
    members: {},
    cycles: {},
    nominations: {},
    answers: {},
    tallies: {},
    receipts: {},
  };
  DEMO_PERSONAS.filter((persona) => persona.uid !== OUTSIDER).forEach((persona) => {
    state.allowlist[persona.email] = { admin: persona.uid === DEMO_ADMIN };
    state.members[persona.uid] = { uid: persona.uid, name: persona.name, photoURL: null };
  });
  PAST_CYCLES.forEach((past) => {
    seedPastCycle(state, now, past);
  });
  seedOpenCycle(state, now);
  return state;
}

/** Only the allowlist and members: for tests that build their own cycles. */
export function createEmptyDemoState(): DemoState {
  const state = createDemoState();
  return { ...state, cycles: {}, nominations: {}, answers: {}, tallies: {} };
}
