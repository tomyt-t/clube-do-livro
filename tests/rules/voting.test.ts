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

function vote(persona: Persona, choices: NominationId[], round = 1) {
  return castBallot(dbAs(env, persona), { cycleId: CYCLE, round, uid: persona.uid, choices });
}

const roundDoc = (db: Firestore, round = 1) => doc(db, 'cycles', CYCLE, 'rounds', String(round));
const tallyDoc = (db: Firestore, round = 1) =>
  doc(db, 'cycles', CYCLE, 'rounds', String(round), 'tally', 'counts');
const receiptDoc = (db: Firestore, uid: string) =>
  doc(db, 'cycles', CYCLE, 'rounds', '1', 'receipts', uid);

describe('first round', () => {
  beforeEach(async () => {
    await seedVoting(env);
  });

  it('accepts two votes and counts the ballot, not the voter', async () => {
    await assertSucceeds(vote(ana, [N_BIA, N_ADMIN]));
    const round = await getDoc(roundDoc(dbAs(env, bia)));
    expect(round.get('ballots')).toBe(1);
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

  it('blocks voting for your own nomination', async () => {
    await assertFails(vote(ana, [N_ANA, N_BIA]));
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
      round: 1,
      uid: bia.uid,
      choices: [N_ANA, N_ADMIN],
    });
    await assertFails(forged);
  });

  it('blocks outsiders', async () => {
    await assertFails(vote(stranger, [N_ANA, N_BIA]));
  });
});

describe('forged ballots', () => {
  beforeEach(async () => {
    await seedVoting(env);
  });

  it('blocks giving one book two votes', async () => {
    const db = dbAs(env, caio);
    const batch = writeBatch(db);
    batch.set(receiptDoc(db, caio.uid), {});
    batch.update(roundDoc(db), { ballots: increment(1) });
    batch.update(tallyDoc(db), { [`counts.${N_BIA}`]: increment(2) });
    await assertFails(batch.commit());
  });

  it('blocks votes without a receipt', async () => {
    const db = dbAs(env, caio);
    const batch = writeBatch(db);
    batch.update(roundDoc(db), { ballots: increment(1) });
    batch.update(tallyDoc(db), {
      [`counts.${N_ANA}`]: increment(1),
      [`counts.${N_BIA}`]: increment(1),
    });
    await assertFails(batch.commit());
  });

  it('blocks a receipt without a vote', async () => {
    const db = dbAs(env, caio);
    await assertFails(setDoc(receiptDoc(db, caio.uid), {}));

    const batch = writeBatch(db);
    batch.set(receiptDoc(db, caio.uid), {});
    batch.update(roundDoc(db), { ballots: increment(1) });
    await assertFails(batch.commit());
  });

  it('blocks rewriting or lowering the tally', async () => {
    const db = dbAs(env, caio);
    const batch = writeBatch(db);
    batch.set(receiptDoc(db, caio.uid), {});
    batch.update(roundDoc(db), { ballots: increment(1) });
    batch.set(tallyDoc(db), { counts: { [N_ANA]: 9, [N_BIA]: 9, [N_ADMIN]: 0 } });
    await assertFails(batch.commit());

    await assertFails(updateDoc(tallyDoc(db), { [`counts.${N_ANA}`]: increment(-1) }));
  });

  it('blocks adding a new option to the tally', async () => {
    const db = dbAs(env, caio);
    const batch = writeBatch(db);
    batch.set(receiptDoc(db, caio.uid), {});
    batch.update(roundDoc(db), { ballots: increment(1) });
    batch.update(tallyDoc(db), { [`counts.${N_ANA}`]: increment(1), 'counts.extra': 1 });
    await assertFails(batch.commit());
  });

  it('blocks members from closing the round or moving the cycle', async () => {
    const db = dbAs(env, ana);
    await assertFails(updateDoc(roundDoc(db), { status: 'closed' }));
    await assertFails(updateDoc(roundDoc(db), { ballots: 0 }));
    await assertFails(updateDoc(doc(db, 'cycles', CYCLE), { status: 'tiebreak' }));
  });
});

describe('timing', () => {
  it('blocks votes once the round is closed', async () => {
    await seedVoting(env, { round: { status: 'closed' } });
    await assertFails(vote(caio, [N_ANA, N_BIA]));
  });

  it('blocks votes after the deadline', async () => {
    await seedVoting(env, { cycle: { votingDeadline: PAST } });
    await assertFails(vote(caio, [N_ANA, N_BIA]));
  });

  it('shows the tally once the round is closed', async () => {
    await seedVoting(env, { round: { status: 'closed' } });
    await assertSucceeds(getDoc(tallyDoc(dbAs(env, ana))));
  });
});

describe('runoff', () => {
  beforeEach(async () => {
    await seedVoting(env, { round: { number: 2, kind: 'runoff', options: [N_ANA, N_BIA] } });
  });

  it('lets you vote for your own book', async () => {
    await assertSucceeds(vote(ana, [N_ANA], 2));
  });

  it('allows a single vote', async () => {
    await assertFails(vote(caio, [N_ANA, N_BIA], 2));
  });

  it('only accepts books that are in the runoff', async () => {
    await assertFails(vote(caio, [N_ADMIN], 2));
  });
});
