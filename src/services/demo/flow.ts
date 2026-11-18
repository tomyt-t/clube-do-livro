import { everyone, cycleIdFor } from '@/domain/flow';
import { isLetGoSettled, isReviewClear, openingResults } from '@/domain/review';
import { decide } from '@/domain/tally';
import type { Cycle, CycleId, CycleStatus, VoteResults } from '@/domain/types';

import type { DeclareWinnerInput, FlowPort } from '../backend';

import { deny, isAdmin, pause, requireMember, type DemoContext } from './context';
import { newDemoCycle } from './cycles';
import { isFullBallot, reviewSteps } from './review';
import type { DemoState } from './state';

/** Mirrors `firestore.rules`: a member may take a step once it is ready; the organizer always. */
function cycleIn(state: DemoState, cycleId: CycleId, status: CycleStatus): Cycle {
  const cycle = state.cycles[cycleId];
  if (cycle?.status !== status) deny();
  return cycle;
}

function allowWhen(context: DemoContext, ready: boolean) {
  requireMember(context);
  if (!ready && !isAdmin(context)) deny();
}

/** The declared winner and method must be what the club's rule gives. */
function isEarned(cycle: Cycle, results: VoteResults, input: DeclareWinnerInput): boolean {
  const seed = cycle.votingClosedAt?.getTime() ?? 0;
  const decision = decide(cycle.options, results, seed);
  return (
    decision.nominationId === input.nominationId &&
    decision.method === input.method &&
    decision.drawnFrom.join() === input.drawnFrom.join()
  );
}

export function createDemoFlow(context: DemoContext): FlowPort {
  const { store } = context;
  const members = () => store.current.settings.members;

  return {
    ...reviewSteps(context, members),

    startVoting: async ({ cycleId, options, opening, votingDeadline }) => {
      await pause(context);
      const cycle = cycleIn(store.current, cycleId, 'nominating');
      allowWhen(context, isReviewClear(cycle.review));
      if (!isLetGoSettled(cycle)) deny();
      const exact =
        JSON.stringify(opening) === JSON.stringify(openingResults(options, cycle.merged));
      if (options.length === 0 || !isFullBallot(cycle, options) || !exact) deny();
      store.update((state) => {
        Object.assign(cycleIn(state, cycleId, 'nominating'), {
          status: 'voting',
          options: [...options],
          ballots: 0,
          votingOpenedAt: new Date(),
          votingDeadline,
        });
        state.tallies[cycleId] = structuredClone(opening);
      });
    },

    closeVoting: async (cycleId) => {
      await pause(context);
      const cycle = cycleIn(store.current, cycleId, 'voting');
      allowWhen(context, everyone(cycle.ballots, members()) || cycle.options.length === 1);
      store.update((state) => {
        Object.assign(cycleIn(state, cycleId, 'voting'), {
          status: 'tallying',
          votingClosedAt: new Date(),
        });
      });
    },

    readResults: async (cycleId) => {
      await pause(context);
      requireMember(context);
      const status = store.current.cycles[cycleId]?.status;
      if (!status || status === 'nominating' || status === 'voting') deny();
      return structuredClone(store.current.tallies[cycleId] ?? deny());
    },

    declareWinner: async (input) => {
      await pause(context);
      requireMember(context);
      const cycle = cycleIn(store.current, input.cycleId, 'tallying');
      const results = store.current.tallies[input.cycleId] ?? deny();
      if (!isEarned(cycle, results, input)) deny();
      store.update((state) => {
        const { nominationId, book, method, drawnFrom, startReading } = input;
        Object.assign(cycleIn(state, input.cycleId, 'tallying'), {
          winner: { nominationId, book, method, decidedAt: new Date(), drawnFrom: [...drawnFrom] },
          results: structuredClone(results),
          status: startReading ? 'reading' : 'upcoming',
          readingStartedAt: startReading ? new Date() : null,
        });
      });
    },

    finishAndOpenNext: async ({ cycleId, nextNumber }) => {
      await pause(context);
      const cycle = cycleIn(store.current, cycleId, 'reading');
      allowWhen(context, everyone(cycle.finishedReaders, members()));
      const nextId = cycleIdFor(nextNumber);
      if (nextNumber !== cycle.number + 1 || nextId in store.current.cycles) deny();
      store.update((state) => {
        Object.assign(cycleIn(state, cycleId, 'reading'), {
          status: 'finished',
          finishedAt: new Date(),
        });
        state.cycles[nextId] = newDemoCycle(nextId, nextNumber, null);
      });
      return nextId;
    },
  };
}
