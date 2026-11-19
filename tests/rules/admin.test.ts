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

import { openingResults } from '@/domain/review';
import { drawWinner } from '@/domain/draw';
import type { DecisionMethod, NominationId, VoteResults } from '@/domain/types';
import {
  deleteCycle,
  finishReading,
  openCycle,
  startReading,
} from '@/services/firebase/admin-writes';
import { toBook } from '@/services/firebase/converters';
import {
  closeVoting,
  declareStoredWinner,
  declareWinner,
  readResults,
  startVoting,
} from '@/services/firebase/flow-writes';

import {
  admin,
  ALL_NOMINATIONS,
  ana,
  bia,
  bookFor,
  CLOSED_AT,
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
  withoutRules,
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
  return startVoting(dbAs(env, persona), {
    cycleId: CYCLE,
    options,
    opening: openingResults(options, {}),
    votingDeadline: null,
  });
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
  drawnFrom?: NominationId[];
  startReading?: boolean;
  persona?: Persona;
}

function declare(declaration: Declaration) {
  const { nominationId, method, results, drawnFrom = [], startReading = true } = declaration;
  return declareWinner(dbAs(env, declaration.persona ?? admin), {
    cycleId: CYCLE,
    nominationId,
    book: bookFor(nominationId),
    method,
    drawnFrom,
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
    const create = (id: string, changes: Record<string, unknown>) =>
      setDoc(doc(db, 'cycles', id), { ...cycleData(changes), createdAt: serverTimestamp() });
    await assertSucceeds(create('ciclo-1', {}));
    await assertFails(create('ciclo-2', { number: 2, status: 'voting' }));
    await assertFails(create('ciclo-3', { number: 3, responses: 5 }));
    await assertFails(create('ciclo-4', { number: 4, nominationIds: [N_ANA] }));
    await assertFails(create('ciclo-5', { number: 5, extra: true }));
    await assertFails(create('qualquer-nome', { number: 6 }));
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

  it('is up to the admin alone until everyone answered', async () => {
    await seedAnswered(env, { responses: 3 });
    await assertFails(openVoting(ALL_NOMINATIONS, ana));
    await assertSucceeds(openVoting());
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

  it('is the only one who can close the vote early', async () => {
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

  it('copies an older book as stored, though the app reads it with a key it lacks', async () => {
    // Saved before covers named their source: no coverSourceUrl at all.
    const older = Object.fromEntries(
      Object.entries(bookFor(N_ANA)).filter(([key]) => key !== 'coverSourceUrl'),
    );
    await withoutRules(env, async (db) => {
      await updateDoc(doc(db, 'cycles', CYCLE, 'nominations', N_ANA), { book: older });
    });
    const read = toBook(older);
    if (!read) throw new Error('The older book should still read.');
    expect(read.coverSourceUrl).toBeNull();
    const input = {
      cycleId: CYCLE,
      nominationId: N_ANA,
      book: read,
      method: 'votes',
      drawnFrom: [],
      results,
      startReading: true,
    } as const;

    await assertFails(declareWinner(dbAs(env, admin), input));
    await assertSucceeds(declareStoredWinner(dbAs(env, admin), input));
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
      drawnFrom: [],
      results,
      startReading: true,
    });
    await assertFails(forged);
  });

  it('rejects any other method for a clear winner', async () => {
    for (const method of ['first-choices', 'draw', 'unopposed'] as const) {
      await assertFails(declare({ nominationId: N_ANA, method, results }));
    }
    await assertFails(
      declare({ nominationId: N_ANA, method: 'votes', results, drawnFrom: [N_ANA, N_BIA] }),
    );
  });

  it('never changes a declared winner', async () => {
    await declare({ nominationId: N_ANA, method: 'votes', results });
    await assertFails(declare({ nominationId: N_BIA, method: 'votes', results }));
  });

  it('queues the book while the round before is read, then moves it through reading', async () => {
    // Nothing is being read: the winner cannot wait.
    await assertFails(
      declare({ nominationId: N_ANA, method: 'votes', results, startReading: false }),
    );
    await withoutRules(env, (db) =>
      setDoc(doc(db, 'cycles', 'ciclo-0'), { number: 0, status: 'reading' }),
    );
    // The round before is being read: the winner cannot start too.
    await assertFails(declare({ nominationId: N_ANA, method: 'votes', results }));
    await assertSucceeds(
      declare({ nominationId: N_ANA, method: 'votes', results, startReading: false }),
    );
    const db = dbAs(env, admin);
    await assertFails(finishReading(db, CYCLE));
    await assertSucceeds(startReading(db, CYCLE));
    await assertSucceeds(finishReading(db, CYCLE));
  });

  it('takes the same checks from any member', async () => {
    await assertFails(declare({ nominationId: N_BIA, method: 'votes', results, persona: bia }));
    await assertSucceeds(declare({ nominationId: N_ANA, method: 'votes', results, persona: bia }));
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

  it('still tied, go to a draw fixed by the closing time', async () => {
    const results = await closedWith({ [N_ANA]: [3, 2], [N_BIA]: [3, 2], [N_ADMIN]: [2, 0] });
    // The tied books in the ballot's order; the closing time's number picks the first of 2.
    const drawnFrom = [N_ANA, N_BIA];
    expect(drawWinner(drawnFrom, ALL_NOMINATIONS, CLOSED_AT.toMillis())).toBe(N_ANA);
    const draw = (nominationId: NominationId, list: NominationId[]) =>
      declare({ nominationId, method: 'draw', results, drawnFrom: list });

    await assertFails(declare({ nominationId: N_ANA, method: 'first-choices', results }));
    await assertFails(draw(N_BIA, drawnFrom));
    await assertFails(draw(N_BIA, [N_BIA, N_ANA]));
    await assertFails(draw(N_ANA, [N_ANA, N_BIA, N_ADMIN]));
    await assertFails(draw(N_ANA, [N_ANA]));
    await assertFails(draw(N_ADMIN, [N_ADMIN, N_BIA]));
    await assertSucceeds(draw(N_ANA, drawnFrom));
  });
});

describe('a single nomination', () => {
  it('wins unopposed', async () => {
    const results = await closedWith({ [N_ANA]: [0, 0] });
    await assertFails(declare({ nominationId: N_ANA, method: 'votes', results }));
    await assertSucceeds(declare({ nominationId: N_ANA, method: 'unopposed', results }));
  });
});
