import { emptyTally } from '@/domain/tally';
import type { Cycle, CycleId, CycleStatus, Round } from '@/domain/types';
import { rulesFor } from '@/domain/voting';

import type { AdminPort, OpenRoundInput } from '../backend';

import { deny, pause, requireAdmin, type DemoContext } from './context';
import { roundKey, type DemoState } from './state';

type AsAdmin = (change: (state: DemoState) => void) => Promise<void>;

function cycleIn(state: DemoState, cycleId: CycleId, allowed: CycleStatus[]): Cycle {
  const cycle = state.cycles[cycleId];
  if (!cycle || !allowed.includes(cycle.status)) deny();
  return cycle;
}

function roundIn(state: DemoState, cycleId: CycleId, number: number): Round {
  return state.rounds[cycleId]?.find((round) => round.number === number) ?? deny();
}

function newCycle(id: CycleId, number: number, nominationDeadline: Date | null): Cycle {
  return {
    id,
    number,
    status: 'nominating',
    currentRound: 0,
    responses: 0,
    nominationDeadline,
    votingDeadline: null,
    createdAt: new Date(),
    winner: null,
    readingStartedAt: null,
    finishedAt: null,
  };
}

function newRound(input: OpenRoundInput): Round {
  return {
    number: input.number,
    kind: input.kind,
    options: [...input.options],
    votesPerMember: rulesFor(input.kind).votesPerMember,
    status: 'open',
    ballots: 0,
    openedAt: new Date(),
    closedAt: null,
    results: null,
  };
}

function cycleActions(asAdmin: AsAdmin) {
  return {
    openCycle: async ({ number, nominationDeadline }) => {
      const id = crypto.randomUUID();
      await asAdmin((state) => {
        state.cycles[id] = newCycle(id, number, nominationDeadline);
      });
      return id;
    },

    setDeadline: (cycleId, field, deadline) =>
      asAdmin((state) => {
        const status = field === 'nominationDeadline' ? 'nominating' : 'voting';
        cycleIn(state, cycleId, [status])[field] = deadline;
      }),

    deleteCycle: (cycleId) =>
      asAdmin((state) => {
        cycleIn(state, cycleId, ['nominating']);
        // Removes a key from the demo store, not user-controlled input.
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete state.cycles[cycleId];
      }),

    enterTiebreak: (cycleId) =>
      asAdmin((state) => {
        cycleIn(state, cycleId, ['voting']).status = 'tiebreak';
      }),

    declareWinner: ({ cycleId, nominationId, book, method, startReading }) =>
      asAdmin((state) => {
        const cycle = cycleIn(state, cycleId, ['voting', 'tiebreak']);
        cycle.winner = { nominationId, book, method, decidedAt: new Date() };
        cycle.status = startReading ? 'reading' : 'upcoming';
        cycle.readingStartedAt = startReading ? new Date() : null;
      }),

    startReading: (cycleId) =>
      asAdmin((state) => {
        const cycle = cycleIn(state, cycleId, ['upcoming']);
        cycle.status = 'reading';
        cycle.readingStartedAt = new Date();
      }),

    finishReading: (cycleId) =>
      asAdmin((state) => {
        const cycle = cycleIn(state, cycleId, ['reading']);
        cycle.status = 'finished';
        cycle.finishedAt = new Date();
      }),
  } satisfies Partial<AdminPort>;
}

function roundActions(asAdmin: AsAdmin) {
  return {
    openRound: (input) =>
      asAdmin((state) => {
        const allowed: CycleStatus[] = input.kind === 'first' ? ['nominating'] : ['voting'];
        const cycle = cycleIn(state, input.cycleId, allowed);
        cycle.status = 'voting';
        cycle.currentRound = input.number;
        cycle.votingDeadline = input.votingDeadline;
        state.rounds[input.cycleId] = [...(state.rounds[input.cycleId] ?? []), newRound(input)];
        state.tallies[roundKey(input.cycleId, input.number)] = { ...emptyTally(input.options) };
      }),

    closeRound: (cycleId, number) =>
      asAdmin((state) => {
        const round = roundIn(state, cycleId, number);
        if (round.status !== 'open') deny();
        round.status = 'closed';
        round.closedAt = new Date();
      }),

    recordResults: async (cycleId, number) => {
      let results = {};
      await asAdmin((state) => {
        const round = roundIn(state, cycleId, number);
        if (round.status !== 'closed') deny();
        results = { ...state.tallies[roundKey(cycleId, number)] };
        round.results = results;
      });
      return results;
    },
  } satisfies Partial<AdminPort>;
}

function allowlistActions(context: DemoContext, asAdmin: AsAdmin) {
  return {
    watchAllowlist: (subscriber) => {
      requireAdmin(context);
      return context.store.watch(
        (state) =>
          Object.entries(state.allowlist).map(([email, entry]) => ({
            email,
            isAdmin: entry.admin,
          })),
        subscriber.next,
      );
    },

    allowEmails: (emails) =>
      asAdmin((state) => {
        emails.forEach((email) => {
          state.allowlist[email] ??= { admin: false };
        });
      }),

    revokeEmail: (email) =>
      asAdmin((state) => {
        if (requireAdmin(context).email === email) deny();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete state.allowlist[email];
      }),
  } satisfies Partial<AdminPort>;
}

export function createDemoAdmin(context: DemoContext): AdminPort {
  const asAdmin: AsAdmin = async (change) => {
    await pause(context);
    requireAdmin(context);
    context.store.update(change);
  };
  return {
    ...cycleActions(asAdmin),
    ...roundActions(asAdmin),
    ...allowlistActions(context, asAdmin),
  };
}
