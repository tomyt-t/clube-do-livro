import { isPastDeadline } from '@/domain/cycle';
import { normalizeBook, validateBook } from '@/domain/book';
import type { Cycle, CycleId, NominationAnswer, NominationId, Round } from '@/domain/types';
import { ownNominationOf, validateBallot } from '@/domain/voting';

import { BackendError, type BallotInput, type ClubPort, type Subscriber } from '../backend';

import { deny, pause, requireMember, requireSelf, type DemoContext } from './context';
import { roundKey, type DemoState } from './state';

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

function isAcceptingVotes(cycle: Cycle, round: Round): boolean {
  return (
    round.status === 'open' && cycle.status === 'voting' && !isPastDeadline(cycle.votingDeadline)
  );
}

function assertCanVote(context: DemoContext, input: BallotInput) {
  const state = context.store.current;
  const cycle = cycleOf(context, input.cycleId);
  const round = state.rounds[input.cycleId]?.find((r) => r.number === input.round) ?? deny();
  const voted = state.receipts[roundKey(input.cycleId, input.round)]?.includes(input.uid) ?? false;
  const own = ownNominationOf(state.answers[input.cycleId]?.[input.uid] ?? null);

  if (voted || !isAcceptingVotes(cycle, round)) deny();
  if (validateBallot(round, own, input.choices) !== null) deny();
}

export function createDemoClub(context: DemoContext): ClubPort {
  const { store } = context;

  return {
    watchCycles: (subscriber) => watch(context, (state) => Object.values(state.cycles), subscriber),

    watchNominations: (cycleId, subscriber) =>
      watch(context, (state) => state.nominations[cycleId] ?? [], subscriber),

    watchRounds: (cycleId, subscriber) =>
      watch(context, (state) => state.rounds[cycleId] ?? [], subscriber),

    watchOwnAnswer: (cycleId, uid, subscriber) =>
      watch(context, (state) => state.answers[cycleId]?.[uid] ?? null, subscriber),

    watchHasVoted: (cycleId, round, uid, subscriber) =>
      watch(
        context,
        (state) => state.receipts[roundKey(cycleId, round)]?.includes(uid) ?? false,
        subscriber,
      ),

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
        if (cycle) cycle.responses += 1;
      });
      return nomination?.id ?? null;
    },

    castBallot: async (input) => {
      await pause(context);
      requireMember(context);
      requireSelf(context, input.uid);
      assertCanVote(context, input);

      const key = roundKey(input.cycleId, input.round);
      store.update((state) => {
        state.receipts[key] = [...(state.receipts[key] ?? []), input.uid];
        const tally = (state.tallies[key] ??= {});
        input.choices.forEach((choice) => {
          tally[choice] = (tally[choice] ?? 0) + 1;
        });
        const round = state.rounds[input.cycleId]?.find((r) => r.number === input.round);
        if (round) round.ballots += 1;
      });
    },
  };
}
