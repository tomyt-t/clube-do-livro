import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import type { ReadingMaterials } from '@/domain/types';
import { setReadingMaterials } from '@/services/firebase/member-writes';

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

// The reading's nominator may set its link, how its synopsis shows and its PDF;
// nothing else, nobody else.

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
const PDF = 'https://drive.google.com/file/d/torto-arado/view';
const NONE: ReadingMaterials = { link: null, display: 'text', pdfUrl: null };

const materialsAs = (persona: Persona, materials: Partial<ReadingMaterials>) =>
  setReadingMaterials(dbAs(env, persona), CYCLE, { ...NONE, ...materials });
const linkAs = (persona: Persona, link: string | null) => materialsAs(persona, { link });

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

describe('the materials of the reading', () => {
  it('take how the synopsis shows and a PDF link from whoever nominated it', async () => {
    await assertSucceeds(materialsAs(ana, { link: LINK, display: 'link', pdfUrl: PDF }));
    await assertSucceeds(materialsAs(ana, { display: 'text', pdfUrl: null }));
  });

  it('cannot be changed by another member or the organizer', async () => {
    await assertFails(materialsAs(bia, { pdfUrl: PDF }));
    await assertFails(materialsAs(admin, { display: 'link' }));
  });

  it('take only the two displays and an https PDF link', async () => {
    const db = dbAs(env, ana);
    const cycle = doc(db, 'cycles', CYCLE);
    await assertFails(updateDoc(cycle, { 'winner.display': 'hidden' }));
    await assertFails(updateDoc(cycle, { 'winner.display': 1 }));
    await assertFails(updateDoc(cycle, { 'winner.pdfUrl': 'http://example.com/livro.pdf' }));
    await assertFails(updateDoc(cycle, { 'winner.pdfUrl': 'javascript:alert(1)' }));
    await assertSucceeds(updateDoc(cycle, { 'winner.pdfUrl': PDF }));
  });

  it('touch nothing else of the winner or the cycle', async () => {
    const cycle = doc(dbAs(env, ana), 'cycles', CYCLE);
    await assertFails(updateDoc(cycle, { 'winner.pdfUrl': PDF, 'winner.notes': 'oi' }));
    await assertFails(updateDoc(cycle, { 'winner.pdfUrl': PDF, 'winner.nominationId': N_BIA }));
    await assertFails(updateDoc(cycle, { 'winner.pdfUrl': PDF, finishedReaders: 3 }));
  });

  it('are closed once the reading is over', async () => {
    await withoutRules(env, (db) => updateDoc(doc(db, 'cycles', CYCLE), { status: 'finished' }));
    await assertFails(materialsAs(ana, { pdfUrl: PDF }));
  });
});
