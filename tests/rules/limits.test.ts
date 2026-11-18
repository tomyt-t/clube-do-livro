import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { drawOrder, drawWinner } from '@/domain/draw';
import type { DecisionMethod, NominationId, VoteResults } from '@/domain/types';
import { ballotOptions, MAX_MERGED, openingResults } from '@/domain/review';
import { MAX_OPTIONS } from '@/domain/voting';
import { declareWinner, startVoting } from '@/services/firebase/flow-writes';
import { answerNominationCall, castBallot } from '@/services/firebase/member-writes';

import {
  bookFor,
  caio,
  CLOSED_AT,
  createEnv,
  CYCLE,
  dbAs,
  seedAnswered,
  seededResults,
  seedNominating,
  seedTallying,
  seedVoting,
  withoutRules,
} from './helpers';

// Firestore evaluates at most 1000 expressions per request. These cases are
// the most expensive ones the club can produce, at the largest ballot.

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const OPTIONS = Array.from(
  { length: MAX_OPTIONS },
  (_, i): NominationId => `nomination-${String(i).padStart(2, '0')}`,
);

const LAST = OPTIONS[MAX_OPTIONS - 1] ?? '';
const BEFORE_LAST = OPTIONS[MAX_OPTIONS - 2] ?? '';

/** Every option at [votes, first choices], except the ones given. */
async function closedWith(base: [number, number], changes: Record<NominationId, [number, number]>) {
  const counts = (index: 0 | 1) =>
    Object.fromEntries(OPTIONS.map((id) => [id, (changes[id] ?? base)[index]]));
  const seed = { options: OPTIONS, votes: counts(0), firsts: counts(1) };
  await seedTallying(env, seed);
  return seededResults(seed);
}

interface Declared {
  drawnFrom?: NominationId[];
  startReading?: boolean;
}

async function declare(
  nominationId: NominationId,
  method: DecisionMethod,
  results: VoteResults,
  { drawnFrom = [], startReading = true }: Declared = {},
) {
  await withoutRules(env, (db) =>
    setDoc(doc(db, 'cycles', CYCLE, 'nominations', nominationId), {
      book: bookFor(nominationId),
    }),
  );
  return declareWinner(dbAs(env, caio), {
    cycleId: CYCLE,
    nominationId,
    book: bookFor(nominationId),
    method,
    drawnFrom,
    results,
    startReading,
  });
}

describe(`a ballot of ${String(MAX_OPTIONS)} books`, () => {
  it('takes a vote for the last two books', async () => {
    await seedVoting(env, { options: OPTIONS });
    const ballot = { cycleId: CYCLE, uid: caio.uid, choices: [LAST, BEFORE_LAST] };
    await assertSucceeds(castBallot(dbAs(env, caio), ballot));
  });

  it('has no room for one more nomination, but still takes a pass', async () => {
    await seedNominating(env, { nominationIds: OPTIONS, responses: MAX_OPTIONS });
    const db = dbAs(env, caio);
    const input = { cycleId: CYCLE, uid: caio.uid };
    const book = bookFor('extra');
    await assertFails(answerNominationCall(db, { ...input, answer: { kind: 'nominate', book } }));
    await assertSucceeds(answerNominationCall(db, { ...input, answer: { kind: 'pass' } }));
  });

  it('declares a clear winner', async () => {
    const results = await closedWith([1, 0], { [LAST]: [2, 0] });
    await assertSucceeds(declare(LAST, 'votes', results));
  });

  it('declares a win on first choices over all the others, tied on votes', async () => {
    const results = await closedWith([2, 1], { [LAST]: [2, 2] });
    await assertSucceeds(declare(LAST, 'first-choices', results));
  });

  it('declares a draw among all of them, as when nobody voted', async () => {
    const results = await closedWith([0, 0], {});
    const winner = drawWinner(OPTIONS, OPTIONS, CLOSED_AT.toMillis());
    await assertSucceeds(
      declare(winner, 'draw', results, { drawnFrom: drawOrder(OPTIONS, OPTIONS) }),
    );
  });

  it('declares a draw among all of them while the round before is still being read', async () => {
    const results = await closedWith([0, 0], {});
    // Round 1's "round before" is ciclo-0: being read, so the winner waits its turn.
    await withoutRules(env, (db) =>
      setDoc(doc(db, 'cycles', 'ciclo-0'), { number: 0, status: 'reading' }),
    );
    const winner = drawWinner(OPTIONS, OPTIONS, CLOSED_AT.toMillis());
    const order = drawOrder(OPTIONS, OPTIONS);
    await assertFails(declare(winner, 'draw', results, { drawnFrom: order }));
    await assertSucceeds(
      declare(winner, 'draw', results, { drawnFrom: order, startReading: false }),
    );
  });

  it('declares a draw among all of them but one', async () => {
    const [behind = '', ...tied] = OPTIONS;
    const results = await closedWith([2, 1], { [behind]: [2, 0] });
    const winner = drawWinner(tied, OPTIONS, CLOSED_AT.toMillis());
    await assertSucceeds(declare(winner, 'draw', results, { drawnFrom: drawOrder(tied, OPTIONS) }));
  });
});

describe('merged readings at the largest ballot', () => {
  it("takes a merged nominator's single vote on a ballot of 20", async () => {
    await seedVoting(env, { options: OPTIONS, cycle: { merged: { 'nomination-merged': LAST } } });
    await withoutRules(env, (db) =>
      setDoc(doc(db, 'cycles', CYCLE, 'answers', caio.uid), { nominationId: 'nomination-merged' }),
    );
    const ballot = { cycleId: CYCLE, uid: caio.uid, choices: [BEFORE_LAST], countsFirst: false };
    await assertSucceeds(castBallot(dbAs(env, caio), ballot));
  });

  it(`opens the vote with ${String(MAX_MERGED)} merges, each checked`, async () => {
    const merged = Object.fromEntries(
      OPTIONS.slice(MAX_OPTIONS - MAX_MERGED).map((id, index) => [id, OPTIONS[index] ?? '']),
    );
    const options = ballotOptions(OPTIONS, merged);
    await seedAnswered(env, {
      nominationIds: OPTIONS,
      responses: MAX_OPTIONS,
      review: { ids: [], groups: [] },
      merged,
    });
    const input = {
      cycleId: CYCLE,
      options,
      opening: openingResults(options, merged),
      votingDeadline: null,
    };
    await assertSucceeds(startVoting(dbAs(env, caio), input));
  });
});
