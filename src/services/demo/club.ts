import { isPastDeadline } from '@/domain/cycle';
import { isSecureLink, normalizeBook, validateBook } from '@/domain/book';
import { ballotSeat, isLetGo, isReadingNominator } from '@/domain/review';
import { addBallot } from '@/domain/tally';
import type { Cycle, CycleId, NominationAnswer, NominationId, VoteResults } from '@/domain/types';
import { hasRoomForNomination, ownNominationOf, validateBallot } from '@/domain/voting';

import {
  BackendError,
  type AnswerInput,
  type BallotInput,
  type ClubPort,
  type Subscriber,
  type Unsubscribe,
} from '../backend';

import { deny, pause, requireMember, requireSelf, type DemoContext } from './context';
import type { DemoState } from './state';

function watch<T>(
  context: DemoContext,
  select: (state: DemoState) => T,
  subscriber: Subscriber<T>,
) {
  return context.store.watch(select, subscriber.next);
}

type Guarded<T> = { allowed: true; value: T } | { allowed: false };

/** A read the rules may refuse: like a Firestore listener, a refusal ends it with an error. */
function watchGuarded<T>(
  context: DemoContext,
  select: (state: DemoState) => Guarded<T>,
  subscriber: Subscriber<T>,
): Unsubscribe {
  let stop: () => void = () => undefined;
  stop = context.store.watch(select, (result) => {
    if (result.allowed) {
      subscriber.next(result.value);
      return;
    }
    stop();
    subscriber.error(new BackendError('permission-denied', 'Permissão negada.'));
  });
  return () => {
    stop();
  };
}

/**
 * Mirrors the rules: nominations stay hidden until everyone answered and the
 * review began. A member whose nomination was let go sees the list (everyone
 * saw it during the review), to choose again knowing what is on it.
 */
function isRevealed(state: DemoState, cycleId: CycleId): boolean {
  const cycle = state.cycles[cycleId];
  if (cycle === undefined) return false;
  const answer = state.session ? state.answers[cycleId]?.[state.session] : undefined;
  return cycle.status !== 'nominating' || cycle.review !== null || isLetGo(answer ?? null, cycle);
}

function isOwnNomination(state: DemoState, cycleId: CycleId, nominationId: NominationId) {
  const answer = state.session ? state.answers[cycleId]?.[state.session] : undefined;
  return ownNominationOf(answer ?? null) === nominationId;
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

/**
 * Whether the member may answer now: once, while nominations are open. A
 * member whose nomination was let go answers again, even past the deadline
 * (the vote waits for them).
 */
function isOpenTo(context: DemoContext, cycle: Cycle, uid: string): boolean {
  const previous = context.store.current.answers[cycle.id]?.[uid] ?? null;
  const letGo = isLetGo(previous, cycle);
  if (cycle.status !== 'nominating' || cycle.review !== null) return false;
  if (previous !== null && !letGo) return false;
  return letGo || !isPastDeadline(cycle.nominationDeadline);
}

function assertCanAnswer(context: DemoContext, { cycleId, uid, answer }: AnswerInput) {
  const cycle = cycleOf(context, cycleId);
  const full = answer.kind === 'nominate' && !hasRoomForNomination(cycle.nominationIds);
  if (!isOpenTo(context, cycle, uid)) deny();
  // A reading nominated twice is welcome: the check after the call sorts it out.
  if (full) deny();
}

/** The choices fit the member's seat: never their own reading, one fewer if theirs was merged. */
function isValidBallot(cycle: Cycle, state: DemoState, input: BallotInput): boolean {
  const own = ownNominationOf(state.answers[input.cycleId]?.[input.uid] ?? null);
  const seat = ballotSeat(own, cycle.merged);
  const countsFirst = input.countsFirst ?? true;
  return (
    validateBallot(cycle.options, seat.own, input.choices, seat.merged) === null &&
    countsFirst !== seat.merged
  );
}

function isAcceptingVotes(cycle: Cycle): boolean {
  return cycle.status === 'voting' && !isPastDeadline(cycle.votingDeadline);
}

/** Returns the tally the ballot will be added to. */
function assertCanVote(context: DemoContext, input: BallotInput): VoteResults {
  const state = context.store.current;
  const cycle = cycleOf(context, input.cycleId);
  const voted = state.receipts[input.cycleId]?.includes(input.uid) ?? false;
  if (voted || !isAcceptingVotes(cycle) || input.choices.length === 0) deny();
  if (!isValidBallot(cycle, state, input)) deny();
  return state.tallies[input.cycleId] ?? deny();
}

/** Nominations, read the way the rules allow: hidden until the vote opens. */
function nominationReads(
  context: DemoContext,
): Pick<ClubPort, 'watchNominations' | 'watchOwnNomination'> {
  return {
    watchNominations: (cycleId, subscriber) =>
      watchGuarded(
        context,
        (state) =>
          isRevealed(state, cycleId)
            ? { allowed: true, value: state.nominations[cycleId] ?? [] }
            : { allowed: false },
        subscriber,
      ),

    watchOwnNomination: (cycleId, nominationId, subscriber) =>
      watchGuarded(
        context,
        (state) => {
          if (!isRevealed(state, cycleId) && !isOwnNomination(state, cycleId, nominationId)) {
            return { allowed: false };
          }
          const found = state.nominations[cycleId]?.find(({ id }) => id === nominationId);
          return { allowed: true, value: found ?? null };
        },
        subscriber,
      ),
  };
}

/** Mirrors `editsReadingLink`: only the reading's nominator, only its link, while it is read. */
async function setReadingLink(
  context: DemoContext,
  { cycleId, uid, link }: Parameters<ClubPort['setReadingLink']>[0],
) {
  await pause(context);
  requireSelf(context, uid);
  const cycle = cycleOf(context, cycleId);
  const answer = context.store.current.answers[cycleId]?.[uid] ?? null;
  const clean = link?.trim() ? link.trim() : null;
  const open = cycle.status === 'reading' || cycle.status === 'upcoming';
  if (!open || !isReadingNominator(answer, cycle)) deny();
  if (clean !== null && !isSecureLink(clean)) {
    throw new BackendError('invalid-data', 'Link inválido.');
  }
  context.store.update((state) => {
    const winner = state.cycles[cycleId]?.winner;
    if (winner) winner.book = { ...winner.book, synopsisUrl: clean };
  });
}

export function createDemoClub(context: DemoContext): ClubPort {
  const { store } = context;

  return {
    watchCycles: (subscriber) => watch(context, (state) => Object.values(state.cycles), subscriber),

    ...nominationReads(context),

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

    answerNominationCall: async (input) => {
      const { cycleId, uid, answer } = input;
      await pause(context);
      requireSelf(context, uid);
      assertCanAnswer(context, input);
      const nomination = nominationFrom(answer, crypto.randomUUID());
      const previous = store.current.answers[cycleId]?.[uid];

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
        const replaced = ownNominationOf(previous ?? null);
        cycle.letGo = cycle.letGo.filter((id) => id !== replaced);
      });
      return nomination?.id ?? null;
    },

    setReadingLink: (input) => setReadingLink(context, input),

    castBallot: async (input) => {
      await pause(context);
      requireMember(context);
      requireSelf(context, input.uid);
      const tally = assertCanVote(context, input);

      const { cycleId, uid, choices, countsFirst = true } = input;
      store.update((state) => {
        state.receipts[cycleId] = [...(state.receipts[cycleId] ?? []), uid];
        state.tallies[cycleId] = addBallot(tally, choices, countsFirst);
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
