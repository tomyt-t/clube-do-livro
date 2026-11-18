import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import type { NominationId } from '@/domain/types';
import { deleteCycle, openCycle } from '@/services/firebase/admin-writes';
import { startReview } from '@/services/firebase/flow-writes';
import { answerNominationCall } from '@/services/firebase/member-writes';
import { reopenNominations } from '@/services/firebase/review-writes';
import { makeBook } from '@/test/factories';

import {
  admin,
  ana,
  bia,
  bookFor,
  createEnv,
  CYCLE,
  dbAs,
  N_ADMIN,
  N_ANA,
  N_BIA,
  seedAnswered,
  seedNominating,
  withoutRules,
  type Persona,
} from './helpers';

/**
 * Attacks on firestore.rules by the organizer (allowlist admin: true). The
 * rules promise that not even the organizer can learn who nominated what
 * (except flagged readings during a review), drop or add ballot options, or
 * change other members' data except to let a flagged nomination go.
 */

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

const cycleRef = (db: Firestore) => doc(db, 'cycles', CYCLE);
const asAdmin = () => dbAs(env, admin);
const answerOf = (persona: Persona) =>
  getDoc(doc(asAdmin(), 'cycles', CYCLE, 'answers', persona.uid));

/** The check ran and found nothing to sort out. */
const CLEAR = { review: { ids: [], groups: [] } };

/** The check flagged Ana's and Admin's nominations as the same reading. */
const FLAGGED = {
  review: { ids: [N_ANA, N_ADMIN], groups: [{ ids: [N_ANA, N_ADMIN], reason: 'A mesma obra.' }] },
};

const keyOf = (id: NominationId) => `livro ${id}`;

/** Gives every seeded nomination its title key and title record, as the app writes them. */
async function seedTitles() {
  await withoutRules(env, async (db) => {
    for (const id of [N_ANA, N_BIA, N_ADMIN]) {
      await setDoc(doc(db, 'cycles', CYCLE, 'nominations', id), {
        book: bookFor(id),
        titleKey: keyOf(id),
      });
      await setDoc(doc(db, 'cycles', CYCLE, 'titles', keyOf(id)), {});
    }
  });
}

describe('reading who nominated what', () => {
  it('the organizer cannot flag a nomination the check did not flag, to read its nominator', async () => {
    await seedAnswered(env, CLEAR);
    // The check found nothing. The organizer "flags" Bia's reading by hand...
    await updateDoc(cycleRef(asAdmin()), {
      review: { ids: [N_BIA], groups: [] },
      merged: {},
    }).catch(() => undefined);
    // ...and would learn that Bia nominated it.
    await assertFails(answerOf(bia));
  });

  it('the organizer cannot start the review before everyone answered to peek at the nominations', async () => {
    await seedNominating(env);
    for (const persona of [ana, bia]) {
      await answerNominationCall(dbAs(env, persona), {
        cycleId: CYCLE,
        uid: persona.uid,
        answer: { kind: 'nominate', book: makeBook({ title: `Livro de ${persona.uid}` }) },
      });
    }
    // 2 of 4 answered: the nominations must stay hidden from everyone.
    await startReview(asAdmin(), CYCLE).catch(() => undefined);
    await assertFails(getDocs(collection(asAdmin(), 'cycles', CYCLE, 'nominations')));
  });
});

describe('dropping options from the ballot', () => {
  it('the organizer cannot merge nominations the check never flagged', async () => {
    await seedAnswered(env, CLEAR);
    // Bia's reading would leave the ballot as a "merge" into Ana's.
    await assertFails(
      updateDoc(cycleRef(asAdmin()), { review: CLEAR.review, merged: { [N_BIA]: N_ANA } }),
    );
  });

  it('the organizer cannot drop a flagged nomination from the list without letting it go', async () => {
    await seedAnswered(env, FLAGGED);
    // Ana's reading leaves the list, but stays stored with its title record. (Her answer
    // staying is by design: once it is let go, she answers again.)
    await assertFails(
      updateDoc(cycleRef(asAdmin()), {
        review: null,
        responses: increment(-1),
        nominationIds: arrayRemove(N_ANA),
      }),
    );
  });
});

describe('reopening (the one designed exception)', () => {
  it('the organizer cannot delete the title record of a nomination that is not being reopened', async () => {
    await seedAnswered(env, FLAGGED);
    await seedTitles();
    const db = asAdmin();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'cycles', CYCLE, 'answers', ana.uid));
    batch.delete(doc(db, 'cycles', CYCLE, 'nominations', N_ANA));
    batch.delete(doc(db, 'cycles', CYCLE, 'titles', keyOf(N_ANA)));
    // Bia's reading is not flagged; dropping its record lets anyone nominate it again.
    batch.delete(doc(db, 'cycles', CYCLE, 'titles', keyOf(N_BIA)));
    batch.update(cycleRef(db), {
      review: null,
      responses: increment(-1),
      nominationIds: arrayRemove(N_ANA),
    });
    await assertFails(batch.commit());
  });

  it('the organizer cannot reopen a nomination merged into another (its nominator would count twice)', async () => {
    // Bia's reading was merged into Ana's (Ana starts with Bia's vote), and
    // Bia's is still in a flagged group.
    await seedAnswered(env, {
      review: { ids: [N_BIA, N_ADMIN], groups: [{ ids: [N_BIA, N_ADMIN], reason: 'Igual.' }] },
      merged: { [N_BIA]: N_ANA },
    });
    const reopen = reopenNominations(asAdmin(), { cycleId: CYCLE, nominationIds: [N_BIA] });
    await assertFails(reopen);
  });

  it('the organizer cannot reopen a merge target (the vote could never open)', async () => {
    await seedAnswered(env, {
      review: { ids: [N_ANA, N_ADMIN], groups: [{ ids: [N_ANA, N_ADMIN], reason: 'Igual.' }] },
      merged: { [N_BIA]: N_ANA },
    });
    const reopen = reopenNominations(asAdmin(), { cycleId: CYCLE, nominationIds: [N_ANA] });
    await assertFails(reopen);
  });
});

describe('dropping a round', () => {
  it('the organizer cannot delete a round with answers (re-creating ciclo-1 keeps them as zombies)', async () => {
    await seedAnswered(env);
    await assertFails(deleteCycle(asAdmin(), CYCLE));
  });

  it('demonstration: after delete and re-create, members who answered are locked out', async () => {
    await seedAnswered(env);
    await deleteCycle(asAdmin(), CYCLE).catch(() => undefined);
    const exists = (await getDoc(cycleRef(asAdmin()))).exists();
    if (exists) return; // the delete was refused: nothing to demonstrate
    await assertSucceeds(openCycle(asAdmin(), { number: 1, nominationDeadline: null }));
    const again = answerNominationCall(dbAs(env, ana), {
      cycleId: CYCLE,
      uid: ana.uid,
      answer: { kind: 'nominate', book: makeBook({ title: 'Outra leitura' }) },
    });
    await assertSucceeds(again);
  });
});
