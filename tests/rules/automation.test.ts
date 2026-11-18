import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openingResults } from '@/domain/review';
import type { NominationId } from '@/domain/types';
import {
  closeVoting,
  declareWinner,
  finishAndOpenNext,
  startVoting,
  recordReview,
  startReview,
} from '@/services/firebase/flow-writes';
import { markFinished } from '@/services/firebase/member-writes';

import {
  admin,
  ALL_NOMINATIONS,
  ana,
  bia,
  bookFor,
  caio,
  createEnv,
  cycleData,
  CYCLE,
  dbAs,
  N_ADMIN,
  N_ANA,
  N_BIA,
  seedAnswered,
  seededResults,
  seedReading,
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

/** Caio is a regular member: nothing here relies on the organizer. */
const asCaio = () => dbAs(env, caio);

const openVote = (options: NominationId[]) =>
  startVoting(asCaio(), {
    cycleId: CYCLE,
    options,
    opening: openingResults(options, {}),
    votingDeadline: null,
  });

const CLEAR = { review: { ids: [], groups: [] } };

describe('the review, then the vote', () => {
  it('opens the list for the check once everyone answered', async () => {
    await seedAnswered(env, { responses: 3 });
    await assertFails(startReview(asCaio(), CYCLE));
    await seedAnswered(env);
    await assertSucceeds(startReview(asCaio(), CYCLE));
  });

  it('records the check once, then opens the vote if nothing was flagged', async () => {
    await seedAnswered(env);
    await assertFails(recordReview(asCaio(), CYCLE, [], {}));
    await startReview(asCaio(), CYCLE);
    await assertFails(openVote(ALL_NOMINATIONS));
    await assertSucceeds(recordReview(asCaio(), CYCLE, [], {}));
    await assertFails(recordReview(asCaio(), CYCLE, [], {}));
    await assertSucceeds(openVote(ALL_NOMINATIONS));
  });

  it('waits for the organizer when the check flagged something', async () => {
    await seedAnswered(env, {
      review: { ids: [N_ANA, N_BIA], groups: [{ ids: [N_ANA, N_BIA], reason: 'Igual.' }] },
    });
    await assertFails(openVote(ALL_NOMINATIONS));
  });

  it('refuses a ballot that drops, adds or reorders nominations', async () => {
    await seedAnswered(env, CLEAR);
    await assertFails(openVote([N_ANA, N_BIA]));
    await assertFails(openVote([...ALL_NOMINATIONS, 'made-up']));
    await assertFails(openVote([N_BIA, N_ANA, N_ADMIN]));
  });

  it('stops while the club has no member count', async () => {
    await seedAnswered(env);
    await withoutRules(env, (db) => deleteDoc(doc(db, 'settings', 'club')));
    await assertFails(startReview(asCaio(), CYCLE));
  });
});

describe('closing the vote', () => {
  it('is up to any member once everyone voted', async () => {
    await seedVoting(env, { cycle: { ballots: 4 } });
    await assertSucceeds(closeVoting(asCaio(), CYCLE));
  });

  it('waits for everyone, unless there is a single nomination', async () => {
    await seedVoting(env, { cycle: { ballots: 3 } });
    await assertFails(closeVoting(asCaio(), CYCLE));

    await seedVoting(env, { options: [N_ANA], cycle: { ballots: 0 } });
    await assertSucceeds(closeVoting(asCaio(), CYCLE));
  });
});

describe('declaring the winner', () => {
  it('is up to any member, as long as it follows the rule', async () => {
    const seed = {
      votes: { [N_ANA]: 3, [N_BIA]: 1, [N_ADMIN]: 0 },
      firsts: { [N_ANA]: 2, [N_BIA]: 1, [N_ADMIN]: 0 },
    };
    await seedTallying(env, seed);
    const declare = (nominationId: NominationId) =>
      declareWinner(asCaio(), {
        cycleId: CYCLE,
        nominationId,
        book: bookFor(nominationId),
        method: 'votes',
        drawnFrom: [],
        results: seededResults(seed),
        startReading: true,
      });
    await assertFails(declare(N_BIA));
    await assertSucceeds(declare(N_ANA));
  });
});

describe('Acabei de ler!', () => {
  const finish = (persona: Persona, uid = persona.uid) =>
    markFinished(dbAs(env, persona), CYCLE, uid);

  it('counts each reader once, only for themselves, only while reading', async () => {
    await seedReading(env);
    await assertSucceeds(finish(ana));
    await assertFails(finish(ana));
    await assertFails(finish(bia, caio.uid));

    const cycle = await getDoc(doc(asCaio(), 'cycles', CYCLE));
    expect(cycle.get('finishedReaders')).toBe(1);

    await seedVoting(env);
    await assertFails(finish(caio));
  });

  it('keeps who finished private', async () => {
    await seedReading(env, [ana]);
    await assertSucceeds(getDoc(doc(dbAs(env, ana), 'cycles', CYCLE, 'readers', ana.uid)));
    await assertFails(getDoc(doc(dbAs(env, bia), 'cycles', CYCLE, 'readers', ana.uid)));
  });
});

describe('ending the book', () => {
  it('opens the next round once everyone finished', async () => {
    await seedReading(env, [admin, ana, bia, caio]);
    await assertSucceeds(finishAndOpenNext(asCaio(), { cycleId: CYCLE, nextNumber: 2 }));

    const db = asCaio();
    expect((await getDoc(doc(db, 'cycles', CYCLE))).get('status')).toBe('finished');
    expect((await getDoc(doc(db, 'cycles', 'ciclo-2'))).get('status')).toBe('nominating');
  });

  it('waits for everyone', async () => {
    await seedReading(env, [ana, bia]);
    await assertFails(finishAndOpenNext(asCaio(), { cycleId: CYCLE, nextNumber: 2 }));
  });

  it('never ends the book without opening the next round, or the other way around', async () => {
    await seedReading(env, [admin, ana, bia, caio]);
    const db = asCaio();
    await assertFails(
      updateDoc(doc(db, 'cycles', CYCLE), { status: 'finished', finishedAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db, 'cycles', 'ciclo-2'), {
        ...cycleData({ number: 2 }),
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(finishAndOpenNext(db, { cycleId: CYCLE, nextNumber: 3 }));
  });
});
