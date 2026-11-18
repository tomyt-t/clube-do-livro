import { emptyResults } from '@/domain/tally';
import type { Cycle, CycleId, CycleStatus, VoteResults } from '@/domain/types';

import type { AdminPort } from '../backend';

import { deny, pause, requireAdmin, type DemoContext } from './context';
import type { DemoState } from './state';

type AsAdmin = (change: (state: DemoState) => void) => Promise<void>;

function cycleIn(state: DemoState, cycleId: CycleId, allowed: CycleStatus[]): Cycle {
  const cycle = state.cycles[cycleId];
  if (!cycle || !allowed.includes(cycle.status)) deny();
  return cycle;
}

function newCycle(id: CycleId, number: number, nominationDeadline: Date | null): Cycle {
  return {
    id,
    number,
    status: 'nominating',
    responses: 0,
    nominationDeadline,
    votingDeadline: null,
    createdAt: new Date(),
    options: [],
    ballots: 0,
    votingOpenedAt: null,
    votingClosedAt: null,
    results: null,
    winner: null,
    readingStartedAt: null,
    finishedAt: null,
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

    declareWinner: ({ cycleId, nominationId, book, method, results, startReading }) =>
      asAdmin((state) => {
        const cycle = cycleIn(state, cycleId, ['tallying']);
        if (!cycle.options.includes(nominationId)) deny();
        cycle.winner = { nominationId, book, method, decidedAt: new Date() };
        cycle.results = results;
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

function votingActions(asAdmin: AsAdmin) {
  return {
    startVoting: ({ cycleId, options, votingDeadline }) =>
      asAdmin((state) => {
        const cycle = cycleIn(state, cycleId, ['nominating']);
        if (options.length === 0) deny();
        cycle.status = 'voting';
        cycle.options = [...options];
        cycle.ballots = 0;
        cycle.votingOpenedAt = new Date();
        cycle.votingDeadline = votingDeadline;
        state.tallies[cycleId] = emptyResults(options);
      }),

    closeVoting: (cycleId) =>
      asAdmin((state) => {
        const cycle = cycleIn(state, cycleId, ['voting']);
        cycle.status = 'tallying';
        cycle.votingClosedAt = new Date();
      }),

    readResults: async (cycleId) => {
      let results: VoteResults | undefined;
      await asAdmin((state) => {
        cycleIn(state, cycleId, ['tallying', 'upcoming', 'reading', 'finished']);
        results = state.tallies[cycleId];
      });
      return results ?? deny();
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
    ...votingActions(asAdmin),
    ...allowlistActions(context, asAdmin),
  };
}
