import { isPastDeadline } from '@/domain/cycle';
import { normalizeBook, validateBook } from '@/domain/book';
import { addBallot } from '@/domain/tally';
import type { Cycle, CycleId, NominationAnswer, NominationId, VoteResults } from '@/domain/types';
import { ownNominationOf, validateBallot } from '@/domain/voting';

import { BackendError, type BallotInput, type ClubPort, type Subscriber } from '../backend';

import { deny, pause, requireMember, requireSelf, type DemoContext } from './context';
import type { DemoState } from './state';

function watch<T>(
  context: DemoContext,
  select: (state: DemoState) => T,
  subscriber: Subscriber<T>,
) {
  return context.store.watch(select, subscriber.next);
}

function cycleOf(context: DemoContext, cycleId: CycleId): Cycle {
  return context.store.current.cycles[cycleId] ?? deny();
}

function nominationFrom(answer: NominationAnswer, id: NominationId) {
  if (answer.kind === 'pass') return null;
  const book = normalizeBook(answer.book);
  if (validateBook(book).length > 0) throw new BackendError('invalid-data', 'Livro inválido.');
  return { id, book };
}

function assertCanAnswer(context: DemoContext, cycleId: CycleId, uid: string) {
  const cycle = cycleOf(context, cycleId);
  const answered = context.store.current.answers[cycleId]?.[uid] !== undefined;
  if (cycle.status !== 'nominating' || isPastDeadline(cycle.nominationDeadline) || answered) {
    deny();
  }
}

function isAcceptingVotes(cycle: Cycle): boolean {
  return cycle.status === 'voting' && !isPastDeadline(cycle.votingDeadline);
}

/** Returns the tally the ballot will be added to. */
function assertCanVote(context: DemoContext, input: BallotInput): VoteResults {
  const state = context.store.current;
  const cycle = cycleOf(context, input.cycleId);
  const voted = state.receipts[input.cycleId]?.includes(input.uid) ?? false;
  const own = ownNominationOf(state.answers[input.cycleId]?.[input.uid] ?? null);

  if (voted || !isAcceptingVotes(cycle) || input.choices.length === 0) deny();
  if (validateBallot(cycle.options, own, input.choices) !== null) deny();
  return state.tallies[input.cycleId] ?? deny();
}

export function createDemoClub(context: DemoContext): ClubPort {
  const { store } = context;

  return {
    watchCycles: (subscriber) => watch(context, (state) => Object.values(state.cycles), subscriber),

    watchNominations: (cycleId, subscriber) =>
      watch(context, (state) => state.nominations[cycleId] ?? [], subscriber),

    watchOwnAnswer: (cycleId, uid, subscriber) =>
      watch(context, (state) => state.answers[cycleId]?.[uid] ?? null, subscriber),

    watchHasVoted: (cycleId, uid, subscriber) =>
      watch(context, (state) => state.receipts[cycleId]?.includes(uid) ?? false, subscriber),

    watchMembers: (subscriber) =>
      watch(context, (state) => Object.values(state.members), subscriber),

    saveProfile: async (profile) => {
      await pause(context);
      requireSelf(context, profile.uid);
      store.update((state) => {
        state.members[profile.uid] = profile;
      });
    },

    answerNominationCall: async ({ cycleId, uid, answer }) => {
      await pause(context);
      requireSelf(context, uid);
      assertCanAnswer(context, cycleId, uid);
      const nomination = nominationFrom(answer, crypto.randomUUID());

      store.update((state) => {
        if (nomination)
          state.nominations[cycleId] = [...(state.nominations[cycleId] ?? []), nomination];
        state.answers[cycleId] = {
          ...state.answers[cycleId],
          [uid]: nomination
            ? { kind: 'nominated', nominationId: nomination.id }
            : { kind: 'passed' },
        };
        const cycle = state.cycles[cycleId];
        if (!cycle) return;
        cycle.responses += 1;
        if (nomination) cycle.nominationIds = [...cycle.nominationIds, nomination.id];
      });
      return nomination?.id ?? null;
    },

    castBallot: async (input) => {
      await pause(context);
      requireMember(context);
      requireSelf(context, input.uid);
      const tally = assertCanVote(context, input);

      const { cycleId, uid, choices } = input;
      store.update((state) => {
        state.receipts[cycleId] = [...(state.receipts[cycleId] ?? []), uid];
        state.tallies[cycleId] = addBallot(tally, choices);
        const cycle = state.cycles[cycleId];
        if (cycle) cycle.ballots += 1;
      });
    },

    watchSettings: (subscriber) => watch(context, (state) => state.settings, subscriber),

    watchHasFinished: (cycleId, uid, subscriber) =>
      watch(context, (state) => state.readers[cycleId]?.includes(uid) ?? false, subscriber),

    markFinished: async ({ cycleId, uid }) => {
      await pause(context);
      requireSelf(context, uid);
      const finished = store.current.readers[cycleId]?.includes(uid) ?? false;
      if (cycleOf(context, cycleId).status !== 'reading' || finished) deny();
      store.update((state) => {
        state.readers[cycleId] = [...(state.readers[cycleId] ?? []), uid];
        const cycle = state.cycles[cycleId];
        if (cycle) cycle.finishedReaders += 1;
      });
    },
  };
}
