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

import type { DecisionMethod, NominationId, VoteResults } from '@/domain/types';
import {
  closeVoting,
  declareWinner,
  deleteCycle,
  finishReading,
  openCycle,
  readResults,
  startReading,
  startVoting,
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
  seededResults,
  seedNominating,
  seedTallying,
  seedVoting,
  type Persona,
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

function openVoting(options: NominationId[] = ALL_NOMINATIONS, persona = admin) {
  return startVoting(dbAs(env, persona), { cycleId: CYCLE, options, votingDeadline: null });
}

/** Voting closed with these counts per book: [votes, first choices]. */
async function closedWith(counts: Record<NominationId, [number, number]>) {
  const entries = Object.entries(counts);
  const seed = {
    options: entries.map(([id]) => id),
    votes: Object.fromEntries(entries.map(([id, [votes]]) => [id, votes])),
    firsts: Object.fromEntries(entries.map(([id, [, firsts]]) => [id, firsts])),
  };
  await seedTallying(env, seed);
  return seededResults(seed);
}

interface Declaration {
  nominationId: NominationId;
  method: DecisionMethod;
  results: VoteResults;
  startReading?: boolean;
  persona?: Persona;
}

function declare(declaration: Declaration) {
  const { nominationId, method, results, startReading = true, persona = admin } = declaration;
  return declareWinner(dbAs(env, persona), {
    cycleId: CYCLE,
    nominationId,
    book: bookFor(nominationId),
    method,
    results,
    startReading,
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
    await assertFails(setDoc(doc(db, 'cycles', 'z'), cycleData({ options: [N_ANA] })));
    await assertFails(setDoc(doc(db, 'cycles', 'w'), cycleData({ extra: true })));
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

  it('fixes the options and opens a zeroed tally', async () => {
    await assertSucceeds(openVoting());
    const cycle = await getDoc(doc(dbAs(env, ana), 'cycles', CYCLE));
    expect(cycle.get('status')).toBe('voting');
    expect(cycle.get('options')).toEqual(ALL_NOMINATIONS);
  });

  it('is reserved to the admin', async () => {
    await assertFails(openVoting(ALL_NOMINATIONS, ana));
  });

  it('rejects more options than answers received, or repeated options', async () => {
    await assertFails(openVoting([...ALL_NOMINATIONS, 'fake-1', 'fake-2']));
    await assertFails(openVoting([N_ANA, N_ANA]));
  });

  it('rejects a pre-filled or mismatched tally', async () => {
    const db = dbAs(env, admin);
    const attempt = (tally: VoteResults) => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'cycles', CYCLE), {
        status: 'voting',
        options: ALL_NOMINATIONS,
        ballots: 0,
        votingOpenedAt: serverTimestamp(),
        votingDeadline: null,
      });
      batch.set(doc(db, 'cycles', CYCLE, 'tally', 'counts'), tally);
      return batch.commit();
    };
    const zeros = { [N_ANA]: 0, [N_BIA]: 0, [N_ADMIN]: 0 };
    await assertFails(attempt({ votes: { ...zeros, [N_ANA]: 3 }, firsts: zeros }));
    await assertFails(attempt({ votes: zeros, firsts: { [N_ANA]: 0, [N_BIA]: 0 } }));
  });

  it('cannot skip straight to a winner', async () => {
    await assertFails(declare({ nominationId: N_ANA, method: 'votes', results: seededResults() }));
  });
});

describe('the admin and the votes', () => {
  const counts = {
    votes: { [N_ANA]: 3, [N_BIA]: 1, [N_ADMIN]: 0 },
    firsts: { [N_ANA]: 1, [N_BIA]: 1, [N_ADMIN]: 0 },
  };

  beforeEach(async () => {
    await seedVoting(env, counts);
  });

  it('cannot touch the tally', async () => {
    const tally = doc(dbAs(env, admin), 'cycles', CYCLE, 'tally', 'counts');
    await assertFails(updateDoc(tally, { [`votes.${N_ADMIN}`]: increment(5) }));
  });

  it("cannot read or change other members' answers and receipts", async () => {
    const db = dbAs(env, admin);
    await assertFails(getDoc(doc(db, 'cycles', CYCLE, 'answers', ana.uid)));
    await assertFails(getDoc(doc(db, 'cycles', CYCLE, 'receipts', ana.uid)));
    await assertFails(deleteDoc(doc(db, 'cycles', CYCLE, 'answers', ana.uid)));
    await assertFails(updateDoc(doc(db, 'cycles', CYCLE, 'nominations', N_ANA), { book: null }));
  });

  it('reads the tally only after closing the vote', async () => {
    const db = dbAs(env, admin);
    await assertFails(readResults(db, CYCLE));
    await assertSucceeds(closeVoting(db, CYCLE));
    expect(await assertSucceeds(readResults(db, CYCLE))).toEqual(counts);
  });

  it('keeps a closed vote closed', async () => {
    const db = dbAs(env, admin);
    await closeVoting(db, CYCLE);
    await assertFails(
      updateDoc(doc(db, 'cycles', CYCLE), { status: 'voting', votingClosedAt: null }),
    );
  });

  it('is the only one who can close the vote', async () => {
    await assertFails(closeVoting(dbAs(env, bia), CYCLE));
  });
});

describe('declaring a clear winner', () => {
  let results: VoteResults;

  beforeEach(async () => {
    results = await closedWith({ [N_ANA]: [3, 1], [N_BIA]: [1, 1], [N_ADMIN]: [0, 0] });
  });

  it('accepts the book with the most votes', async () => {
    await assertSucceeds(declare({ nominationId: N_ANA, method: 'votes', results }));
  });

  it('rejects a book that did not lead', async () => {
    await assertFails(declare({ nominationId: N_BIA, method: 'votes', results }));
  });

  it('rejects made-up results', async () => {
    const forged = {
      votes: { [N_ANA]: 0, [N_BIA]: 0, [N_ADMIN]: 9 },
      firsts: { [N_ANA]: 0, [N_BIA]: 0, [N_ADMIN]: 3 },
    };
    await assertFails(declare({ nominationId: N_ADMIN, method: 'votes', results: forged }));
  });

  it('rejects a winner whose book was altered', async () => {
    const forged = declareWinner(dbAs(env, admin), {
      cycleId: CYCLE,
      nominationId: N_ANA,
      book: { ...bookFor(N_ANA), title: 'Outro livro' },
      method: 'votes',
      results,
      startReading: true,
    });
    await assertFails(forged);
  });

  it('rejects any other method for a clear winner', async () => {
    for (const method of ['first-choices', 'draw', 'unopposed'] as const) {
      await assertFails(declare({ nominationId: N_ANA, method, results }));
    }
  });

  it('never changes a declared winner', async () => {
    await declare({ nominationId: N_ANA, method: 'votes', results });
    await assertFails(declare({ nominationId: N_BIA, method: 'votes', results }));
  });

  it('queues the book, then moves it through reading', async () => {
    await assertSucceeds(
      declare({ nominationId: N_ANA, method: 'votes', results, startReading: false }),
    );
    const db = dbAs(env, admin);
    await assertFails(finishReading(db, CYCLE));
    await assertSucceeds(startReading(db, CYCLE));
    await assertSucceeds(finishReading(db, CYCLE));
  });

  it('is reserved to the admin', async () => {
    await assertFails(declare({ nominationId: N_ANA, method: 'votes', results, persona: bia }));
  });
});

describe('ties', () => {
  it('go to the most first choices', async () => {
    const results = await closedWith({ [N_ANA]: [3, 2], [N_BIA]: [3, 1], [N_ADMIN]: [2, 1] });
    await assertFails(declare({ nominationId: N_ANA, method: 'votes', results }));
    await assertFails(declare({ nominationId: N_BIA, method: 'first-choices', results }));
    await assertFails(declare({ nominationId: N_ANA, method: 'draw', results }));
    await assertSucceeds(declare({ nominationId: N_ANA, method: 'first-choices', results }));
  });

  it('still tied, go to a draw among the tied books only', async () => {
    const results = await closedWith({ [N_ANA]: [3, 2], [N_BIA]: [3, 2], [N_ADMIN]: [2, 0] });
    await assertFails(declare({ nominationId: N_ANA, method: 'first-choices', results }));
    await assertFails(declare({ nominationId: N_ADMIN, method: 'draw', results }));
    await assertSucceeds(declare({ nominationId: N_BIA, method: 'draw', results }));
  });
});

describe('a single nomination', () => {
  it('wins unopposed', async () => {
    const results = await closedWith({ [N_ANA]: [0, 0] });
    await assertFails(declare({ nominationId: N_ANA, method: 'votes', results }));
    await assertSucceeds(declare({ nominationId: N_ANA, method: 'unopposed', results }));
  });
});
