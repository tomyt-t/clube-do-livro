import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { NominationId } from '@/domain/types';
import { castBallot } from '@/services/firebase/member-writes';

import {
  admin,
  ana,
  bia,
  caio,
  createEnv,
  CYCLE,
  dbAs,
  N_ADMIN,
  N_ANA,
  N_BIA,
  PAST,
  seedTallying,
  seedVoting,
  stranger,
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

function vote(persona: Persona, choices: NominationId[]) {
  return castBallot(dbAs(env, persona), { cycleId: CYCLE, uid: persona.uid, choices });
}

const cycleDoc = (db: Firestore) => doc(db, 'cycles', CYCLE);
const tallyDoc = (db: Firestore) => doc(db, 'cycles', CYCLE, 'tally', 'counts');
const receiptDoc = (db: Firestore, uid: string) => doc(db, 'cycles', CYCLE, 'receipts', uid);

/** Caio's receipt and ballot count, with whatever tally change is given. */
function forgeAsCaio(tallyChange: Record<string, unknown>) {
  const db = dbAs(env, caio);
  const batch = writeBatch(db);
  batch.set(receiptDoc(db, caio.uid), {});
  batch.update(cycleDoc(db), { ballots: increment(1) });
  batch.update(tallyDoc(db), tallyChange);
  return batch.commit();
}

const plusOne = (...keys: string[]) => Object.fromEntries(keys.map((key) => [key, increment(1)]));

describe('ballots', () => {
  beforeEach(async () => {
    await seedVoting(env);
  });

  it('accepts a first and a second choice and counts the ballot, not the voter', async () => {
    await assertSucceeds(vote(ana, [N_BIA, N_ADMIN]));
    const cycle = await getDoc(cycleDoc(dbAs(env, bia)));
    expect(cycle.get('ballots')).toBe(1);
  });

  it('lets a member who passed vote for any two books', async () => {
    await assertSucceeds(vote(caio, [N_ANA, N_BIA]));
  });

  it('keeps receipts private', async () => {
    await vote(ana, [N_BIA, N_ADMIN]);
    await assertSucceeds(getDoc(receiptDoc(dbAs(env, ana), ana.uid)));
    await assertFails(getDoc(receiptDoc(dbAs(env, bia), ana.uid)));
    await assertFails(getDoc(receiptDoc(dbAs(env, admin), ana.uid)));
  });

  it('hides the tally while voting is open, even from the admin', async () => {
    await assertFails(getDoc(tallyDoc(dbAs(env, ana))));
    await assertFails(getDoc(tallyDoc(dbAs(env, admin))));
  });

  it('blocks your own nomination, as first or as second choice', async () => {
    await assertFails(vote(ana, [N_ANA, N_BIA]));
    await assertFails(vote(ana, [N_BIA, N_ANA]));
  });

  it('blocks voting twice', async () => {
    await vote(ana, [N_BIA, N_ADMIN]);
    await assertFails(vote(ana, [N_BIA, N_ADMIN]));
  });

  it.each([
    ['one book', [N_BIA]],
    ['three books', [N_ANA, N_BIA, N_ADMIN]],
    ['a book that is not an option', [N_BIA, 'made-up']],
  ])('blocks a ballot with %s', async (_case, choices) => {
    await assertFails(vote(caio, choices));
  });

  it('blocks casting a ballot for someone else', async () => {
    const forged = castBallot(dbAs(env, ana), {
      cycleId: CYCLE,
      uid: bia.uid,
      choices: [N_ANA, N_ADMIN],
    });
    await assertFails(forged);
  });

  it('blocks outsiders', async () => {
    await assertFails(vote(stranger, [N_ANA, N_BIA]));
  });
});

describe('a short ballot', () => {
  beforeEach(async () => {
    await seedVoting(env, { options: [N_ANA, N_BIA] });
  });

  it('asks for one choice when only one other book is eligible', async () => {
    await assertSucceeds(vote(ana, [N_BIA]));
  });

  it('still asks for two when two books are eligible', async () => {
    await assertFails(vote(caio, [N_ANA]));
    await assertSucceeds(vote(caio, [N_ANA, N_BIA]));
  });
});

describe('forged ballots', () => {
  beforeEach(async () => {
    await seedVoting(env);
  });

  it('blocks giving one book two votes', async () => {
    await assertFails(
      forgeAsCaio({ [`votes.${N_BIA}`]: increment(2), [`firsts.${N_BIA}`]: increment(1) }),
    );
  });

  it('blocks a ballot without a first choice, or with two', async () => {
    await assertFails(forgeAsCaio(plusOne(`votes.${N_ANA}`, `votes.${N_BIA}`)));
    await assertFails(
      forgeAsCaio(
        plusOne(`votes.${N_ANA}`, `votes.${N_BIA}`, `firsts.${N_ANA}`, `firsts.${N_BIA}`),
      ),
    );
  });

  it('blocks a first choice for a book the ballot does not vote for', async () => {
    await assertFails(
      forgeAsCaio(plusOne(`votes.${N_BIA}`, `votes.${N_ADMIN}`, `firsts.${N_ANA}`)),
    );
  });

  it('blocks votes without a receipt', async () => {
    const db = dbAs(env, caio);
    const batch = writeBatch(db);
    batch.update(cycleDoc(db), { ballots: increment(1) });
    batch.update(tallyDoc(db), plusOne(`votes.${N_ANA}`, `votes.${N_BIA}`, `firsts.${N_ANA}`));
    await assertFails(batch.commit());
  });

  it('blocks a receipt without a vote', async () => {
    const db = dbAs(env, caio);
    await assertFails(setDoc(receiptDoc(db, caio.uid), {}));

    const batch = writeBatch(db);
    batch.set(receiptDoc(db, caio.uid), {});
    batch.update(cycleDoc(db), { ballots: increment(1) });
    await assertFails(batch.commit());
  });

  it('blocks rewriting or lowering the tally', async () => {
    const db = dbAs(env, caio);
    const batch = writeBatch(db);
    batch.set(receiptDoc(db, caio.uid), {});
    batch.update(cycleDoc(db), { ballots: increment(1) });
    batch.set(tallyDoc(db), {
      votes: { [N_ANA]: 9, [N_BIA]: 9, [N_ADMIN]: 0 },
      firsts: { [N_ANA]: 9, [N_BIA]: 0, [N_ADMIN]: 0 },
    });
    await assertFails(batch.commit());

    await assertFails(updateDoc(tallyDoc(db), { [`votes.${N_ANA}`]: increment(-1) }));
  });

  it('blocks adding a new option to the tally', async () => {
    await assertFails(
      forgeAsCaio({
        ...plusOne(`votes.${N_ANA}`, `votes.${N_BIA}`, `firsts.${N_ANA}`),
        'votes.extra': 1,
      }),
    );
  });

  it('blocks members from closing the vote or changing the ballot', async () => {
    const db = dbAs(env, ana);
    await assertFails(updateDoc(cycleDoc(db), { status: 'tallying' }));
    await assertFails(updateDoc(cycleDoc(db), { ballots: 0 }));
    await assertFails(updateDoc(cycleDoc(db), { options: [N_ANA] }));
  });
});

describe('timing', () => {
  it('blocks votes once voting is closed', async () => {
    await seedTallying(env);
    await assertFails(vote(caio, [N_ANA, N_BIA]));
  });

  it('blocks votes after the deadline', async () => {
    await seedVoting(env, { cycle: { votingDeadline: PAST } });
    await assertFails(vote(caio, [N_ANA, N_BIA]));
  });

  it('shows the tally once voting is closed', async () => {
    await seedTallying(env);
    await assertSucceeds(getDoc(tallyDoc(dbAs(env, ana))));
  });
});
