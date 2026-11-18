import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { setReadingLink } from '@/services/firebase/member-writes';

import {
  admin,
  ana,
  bia,
  createEnv,
  CYCLE,
  dbAs,
  N_ANA,
  N_BIA,
  seedReading,
  withoutRules,
  type Persona,
} from './helpers';

// The reading's nominator may set or clear its link; nothing else, nobody else.

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Ana's reading won; Bia passed.
  await seedReading(env);
  await withoutRules(env, async (db) => {
    await setDoc(doc(db, 'cycles', CYCLE, 'answers', ana.uid), { nominationId: N_ANA });
    await setDoc(doc(db, 'cycles', CYCLE, 'answers', bia.uid), { nominationId: null });
  });
});

const LINK = 'https://pt.wikipedia.org/wiki/Torto_Arado';
const linkAs = (persona: Persona, link: string | null) =>
  setReadingLink(dbAs(env, persona), CYCLE, link);

describe('the link of the reading', () => {
  it('can be set and cleared by whoever nominated it', async () => {
    await assertSucceeds(linkAs(ana, LINK));
    await assertSucceeds(linkAs(ana, null));
  });

  it('cannot be changed by anyone else, not even the organizer', async () => {
    await assertFails(linkAs(bia, LINK));
    await assertFails(linkAs(admin, LINK));
  });

  it('can be changed by a nominator whose reading was merged into it', async () => {
    await withoutRules(env, async (db) => {
      await updateDoc(doc(db, 'cycles', CYCLE), { merged: { [N_BIA]: N_ANA } });
      await setDoc(doc(db, 'cycles', CYCLE, 'answers', bia.uid), { nominationId: N_BIA });
    });
    await assertSucceeds(linkAs(bia, LINK));
  });

  it('takes only an https link, and touches nothing else of the reading', async () => {
    const db = dbAs(env, ana);
    await assertFails(
      updateDoc(doc(db, 'cycles', CYCLE), { 'winner.book.synopsisUrl': 'javascript:alert(1)' }),
    );
    await assertFails(updateDoc(doc(db, 'cycles', CYCLE), { 'winner.book.title': 'Outro título' }));
    await assertFails(
      updateDoc(doc(db, 'cycles', CYCLE), {
        'winner.book.synopsisUrl': LINK,
        'winner.method': 'votes',
      }),
    );
  });

  it('is closed once the reading is over', async () => {
    await withoutRules(env, (db) => updateDoc(doc(db, 'cycles', CYCLE), { status: 'finished' }));
    await assertFails(linkAs(ana, LINK));
  });
});
