import { cycleIdFor } from '@/domain/flow';
import type { Cycle, CycleId, CycleStatus } from '@/domain/types';

import type { AdminPort } from '../backend';

import { deny, pause, requireAdmin, type DemoContext } from './context';
import { newDemoCycle } from './cycles';
import type { DemoState } from './state';

type AsAdmin = (change: (state: DemoState) => void) => Promise<void>;

function cycleIn(state: DemoState, cycleId: CycleId, allowed: CycleStatus[]): Cycle {
  const cycle = state.cycles[cycleId];
  if (!cycle || !allowed.includes(cycle.status)) deny();
  return cycle;
}

function cycleActions(asAdmin: AsAdmin) {
  return {
    openCycle: async ({ number, nominationDeadline }) => {
      const id = cycleIdFor(number);
      await asAdmin((state) => {
        if (id in state.cycles) deny();
        state.cycles[id] = newDemoCycle(id, number, nominationDeadline);
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

    setMemberCount: (members) =>
      asAdmin((state) => {
        state.settings.members = members;
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
    ...allowlistActions(context, asAdmin),
  };
}
