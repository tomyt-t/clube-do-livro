import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { DecisionMethod, NominationId } from '@/domain/types';
import {
  closeRound,
  declareWinner,
  deleteCycle,
  enterTiebreak,
  finishReading,
  openCycle,
  openRound,
  recordResults,
  startReading,
} from '@/services/firebase/admin-writes';

import {
  admin,
  ALL_NOMINATIONS,
  ana,
  bia,
  bookFor,
  createEnv,
  cycleData,
  CYCLE,
  dbAs,
  N_ADMIN,
  N_ANA,
  N_BIA,
  seedAllowlist,
  seedAnswered,
  seedNominating,
  seedRound,
  seedVoting,
} from './helpers';

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

function openFirstRound(options: NominationId[] = ALL_NOMINATIONS, persona = admin) {
  return openRound(dbAs(env, persona), {
    cycleId: CYCLE,
    number: 1,
    kind: 'first',
    options,
    votingDeadline: null,
  });
}

function declare(nominationId: NominationId, method: DecisionMethod, startReadingNow = true) {
  return declareWinner(dbAs(env, admin), {
    cycleId: CYCLE,
    nominationId,
    book: bookFor(nominationId),
    method,
    startReading: startReadingNow,
  });
}

describe('opening a cycle', () => {
  beforeEach(async () => {
    await seedAllowlist(env);
  });

  it('is reserved to the admin', async () => {
    const input = { number: 1, nominationDeadline: null };
    await assertFails(openCycle(dbAs(env, ana), input));
    await assertSucceeds(openCycle(dbAs(env, admin), input));
  });

  it('must start at the nomination phase with clean counters', async () => {
    const db = dbAs(env, admin);
    await assertFails(setDoc(doc(db, 'cycles', 'x'), cycleData({ status: 'voting' })));
    await assertFails(setDoc(doc(db, 'cycles', 'y'), cycleData({ responses: 5 })));
    await assertFails(setDoc(doc(db, 'cycles', 'z'), cycleData({ extra: true })));
  });

  it('can be dropped only before voting starts', async () => {
    await seedNominating(env);
    await assertFails(deleteCycle(dbAs(env, ana), CYCLE));
    await assertSucceeds(deleteCycle(dbAs(env, admin), CYCLE));

    await seedVoting(env);
    await assertFails(deleteCycle(dbAs(env, admin), CYCLE));
  });
});

describe('opening the vote', () => {
  beforeEach(async () => {
    await seedAnswered(env);
  });

  it('opens round 1 with a zeroed tally', async () => {
    await assertSucceeds(openFirstRound());
    const cycle = await getDoc(doc(dbAs(env, ana), 'cycles', CYCLE));
    expect(cycle.get('status')).toBe('voting');
  });

  it('is reserved to the admin', async () => {
    await assertFails(openFirstRound(ALL_NOMINATIONS, ana));
  });

  it('rejects more options than answers received', async () => {
    await assertFails(openFirstRound([...ALL_NOMINATIONS, 'fake-1', 'fake-2']));
  });

  it('rejects a pre-filled or mismatched tally', async () => {
    const db = dbAs(env, admin);
    const attempt = (counts: Record<string, number>) => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'cycles', CYCLE), { status: 'voting', currentRound: 1 });
      batch.set(doc(db, 'cycles', CYCLE, 'rounds', '1'), {
        number: 1,
        kind: 'first',
        options: ALL_NOMINATIONS,
        votesPerMember: 2,
        status: 'open',
        ballots: 0,
        openedAt: serverTimestamp(),
        closedAt: null,
        results: null,
      });
      batch.set(doc(db, 'cycles', CYCLE, 'rounds', '1', 'tally', 'counts'), { counts });
      return batch.commit();
    };
    await assertFails(attempt({ [N_ANA]: 3, [N_BIA]: 0, [N_ADMIN]: 0 }));
    await assertFails(attempt({ [N_ANA]: 0, [N_BIA]: 0 }));
  });

  it('cannot skip straight to a winner', async () => {
    await assertFails(declare(N_ANA, 'votes'));
  });
});

describe('the admin and the votes', () => {
  beforeEach(async () => {
    await seedVoting(env);
  });

  it('cannot touch the tally', async () => {
    const tally = doc(dbAs(env, admin), 'cycles', CYCLE, 'rounds', '1', 'tally', 'counts');
    await assertFails(updateDoc(tally, { [`counts.${N_ADMIN}`]: increment(5) }));
  });

  it("cannot read or change other members' answers and receipts", async () => {
    const db = dbAs(env, admin);
    await assertFails(getDoc(doc(db, 'cycles', CYCLE, 'answers', ana.uid)));
    await assertFails(getDoc(doc(db, 'cycles', CYCLE, 'rounds', '1', 'receipts', ana.uid)));
    await assertFails(deleteDoc(doc(db, 'cycles', CYCLE, 'answers', ana.uid)));
    await assertFails(updateDoc(doc(db, 'cycles', CYCLE, 'nominations', N_ANA), { book: null }));
  });

  it('closes the round and records exactly the tally', async () => {
    await seedRound(env, { counts: { [N_ANA]: 3, [N_BIA]: 1, [N_ADMIN]: 0 } });
    await assertSucceeds(closeRound(dbAs(env, admin), CYCLE, 1));
    const results = await assertSucceeds(recordResults(dbAs(env, admin), CYCLE, 1));
    expect(results).toEqual({ [N_ANA]: 3, [N_BIA]: 1, [N_ADMIN]: 0 });
  });

  it('rejects made-up results', async () => {
    await closeRound(dbAs(env, admin), CYCLE, 1);
    const round = doc(dbAs(env, admin), 'cycles', CYCLE, 'rounds', '1');
    await assertFails(updateDoc(round, { results: { [N_ANA]: 0, [N_BIA]: 0, [N_ADMIN]: 9 } }));
  });

  it('keeps a closed round closed', async () => {
    await closeRound(dbAs(env, admin), CYCLE, 1);
    const round = doc(dbAs(env, admin), 'cycles', CYCLE, 'rounds', '1');
    await assertFails(updateDoc(round, { status: 'open', closedAt: null }));
  });
});

describe('declaring a winner', () => {
  beforeEach(async () => {
    await seedVoting(env, {
      round: {
        status: 'closed',
        withResults: true,
        counts: { [N_ANA]: 3, [N_BIA]: 1, [N_ADMIN]: 0 },
      },
    });
  });

  it('accepts the book with the most votes', async () => {
    await assertSucceeds(declare(N_ANA, 'votes'));
  });

  it('rejects a book that did not lead', async () => {
    await assertFails(declare(N_BIA, 'votes'));
  });

  it('rejects a winner whose book was altered', async () => {
    const forged = declareWinner(dbAs(env, admin), {
      cycleId: CYCLE,
      nominationId: N_ANA,
      book: { ...bookFor(N_ANA), title: 'Outro livro' },
      method: 'votes',
      startReading: true,
    });
    await assertFails(forged);
  });

  it('rejects a draw or a walkover when there was a clear winner', async () => {
    await assertFails(declare(N_ANA, 'draw'));
    await assertFails(declare(N_ANA, 'unopposed'));
  });

  it('never changes a declared winner', async () => {
    await declare(N_ANA, 'votes');
    await assertFails(declare(N_BIA, 'votes'));
  });

  it('queues the book, then moves it through reading', async () => {
    await assertSucceeds(declare(N_ANA, 'votes', false));
    const db = dbAs(env, admin);
    await assertFails(finishReading(db, CYCLE));
    await assertSucceeds(startReading(db, CYCLE));
    await assertSucceeds(finishReading(db, CYCLE));
  });
});

describe('ties', () => {
  const tied = { [N_ANA]: 2, [N_BIA]: 2, [N_ADMIN]: 1 };

  function openRunoff(options: NominationId[]) {
    return openRound(dbAs(env, admin), {
      cycleId: CYCLE,
      number: 2,
      kind: 'runoff',
      options,
      votingDeadline: null,
    });
  }

  beforeEach(async () => {
    await seedVoting(env, { round: { status: 'closed', withResults: true, counts: tied } });
  });

  it('opens a runoff between exactly the tied books', async () => {
    await assertSucceeds(openRunoff([N_ANA, N_BIA]));
  });

  it('rejects a runoff that adds or drops books', async () => {
    await assertFails(openRunoff([N_ANA, N_BIA, N_ADMIN]));
    await assertFails(openRunoff([N_ANA, N_ADMIN]));
  });

  it('cannot declare a winner from a tied round', async () => {
    await assertFails(declare(N_ANA, 'votes'));
  });

  it('draws only after a tied runoff, among the tied books', async () => {
    await seedVoting(env, {
      round: {
        number: 2,
        kind: 'runoff',
        options: [N_ANA, N_BIA],
        status: 'closed',
        withResults: true,
        counts: { [N_ANA]: 1, [N_BIA]: 1 },
      },
    });
    await assertFails(declare(N_ANA, 'draw'));
    await assertSucceeds(enterTiebreak(dbAs(env, admin), CYCLE));
    await assertFails(declare(N_ADMIN, 'draw'));
    await assertSucceeds(declare(N_BIA, 'draw'));
  });
});

describe('a single nomination', () => {
  it('wins unopposed', async () => {
    await seedVoting(env, {
      round: { options: [N_ANA], status: 'closed', withResults: true, counts: { [N_ANA]: 0 } },
    });
    await assertSucceeds(declare(N_ANA, 'unopposed'));
  });
});

describe('members', () => {
  it('cannot drive any transition', async () => {
    await seedVoting(env, {
      round: {
        status: 'closed',
        withResults: true,
        counts: { [N_ANA]: 3, [N_BIA]: 0, [N_ADMIN]: 0 },
      },
    });
    const forged = declareWinner(dbAs(env, bia), {
      cycleId: CYCLE,
      nominationId: N_ANA,
      book: bookFor(N_ANA),
      method: 'votes',
      startReading: true,
    });
    await assertFails(forged);
    await assertFails(closeRound(dbAs(env, bia), CYCLE, 1));
  });
});
