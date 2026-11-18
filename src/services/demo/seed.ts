import type { Cycle, Nomination, Round, Tally } from '@/domain/types';

import { DEMO_BOOKS } from './books';
import { roundKey, type DemoPersona, type DemoState } from './state';

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { uid: 'marina', name: 'Marina', email: 'marina@example.com' },
  { uid: 'rafa', name: 'Rafa', email: 'rafa@example.com' },
  { uid: 'julia', name: 'Júlia', email: 'julia@example.com' },
  { uid: 'teo', name: 'Téo', email: 'teo@example.com' },
  { uid: 'bruno', name: 'Bruno', email: 'bruno@example.com' },
  { uid: 'lia', name: 'Lia', email: 'lia@example.com' },
  { uid: 'visitante', name: 'Visitante', email: 'visitante@example.com' },
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

function closedRound(number: number, results: Tally, at: Date): Round {
  const options = Object.keys(results);
  return {
    number,
    kind: number === 1 ? 'first' : 'runoff',
    options,
    votesPerMember: number === 1 ? 2 : 1,
    status: 'closed',
    ballots: 6,
    openedAt: at,
    closedAt: at,
    results,
  };
}

interface PastCycle {
  id: string;
  number: number;
  winner: BookKey;
  method: 'votes' | 'draw';
  rounds: Tally[];
  startedDaysAgo: number;
  finishedDaysAgo: number | null;
}

function pastCycle(now: Date, past: PastCycle): Cycle {
  const decidedAt = daysAgo(now, past.startedDaysAgo);
  return {
    id: past.id,
    number: past.number,
    status: past.finishedDaysAgo === null ? 'reading' : 'finished',
    currentRound: past.rounds.length,
    responses: 6,
    nominationDeadline: null,
    votingDeadline: null,
    createdAt: daysAgo(now, past.startedDaysAgo + 7),
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

const PAST_CYCLES: PastCycle[] = [
  {
    id: 'c1',
    number: 1,
    winner: 'hora',
    method: 'votes',
    rounds: [{ hora: 5, dom: 3, vidas: 2, quarto: 2 }],
    startedDaysAgo: 120,
    finishedDaysAgo: 90,
  },
  {
    id: 'c2',
    number: 2,
    winner: 'torto',
    method: 'votes',
    rounds: [
      { torto: 4, ensaio: 4, bras: 2, avesso: 2 },
      { torto: 4, ensaio: 2 },
    ],
    startedDaysAgo: 85,
    finishedDaysAgo: 45,
  },
  {
    id: 'c3',
    number: 3,
    winner: 'cem',
    method: 'draw',
    rounds: [
      { cem: 4, avesso: 4, quarto: 4 },
      { cem: 3, avesso: 3, quarto: 0 },
    ],
    startedDaysAgo: 40,
    finishedDaysAgo: null,
  },
];

function seedPastCycle(state: DemoState, now: Date, past: PastCycle) {
  const at = daysAgo(now, past.startedDaysAgo);
  state.cycles[past.id] = pastCycle(now, past);
  state.nominations[past.id] = nominations(Object.keys(past.rounds[0] ?? {}) as BookKey[]);
  state.rounds[past.id] = past.rounds.map((results, index) => closedRound(index + 1, results, at));
  past.rounds.forEach((results, index) => {
    state.tallies[roundKey(past.id, index + 1)] = { ...results };
  });
}

/** Cycle 4 is collecting nominations; Marina has not answered yet. */
function seedOpenCycle(state: DemoState, now: Date) {
  state.cycles.c4 = {
    id: 'c4',
    number: 4,
    status: 'nominating',
    currentRound: 0,
    responses: 3,
    nominationDeadline: new Date(now.getTime() + 3 * DAY),
    votingDeadline: null,
    createdAt: daysAgo(now, 2),
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
    rounds: {},
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
  return { ...state, cycles: {}, nominations: {}, answers: {}, rounds: {}, tallies: {} };
}
