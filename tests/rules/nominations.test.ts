import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { titleKey } from '@/domain/title-key';
import { answerNominationCall } from '@/services/firebase/member-writes';
import { makeBook } from '@/test/factories';

import {
  admin,
  ana,
  bia,
  createEnv,
  CYCLE,
  dbAs,
  PAST,
  seedNominating,
  stranger,
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
  await seedNominating(env);
});

function nominate(persona: Persona, book = makeBook()) {
  return answerNominationCall(dbAs(env, persona), {
    cycleId: CYCLE,
    uid: persona.uid,
    answer: { kind: 'nominate', book },
  });
}

function pass(persona: Persona) {
  return answerNominationCall(dbAs(env, persona), {
    cycleId: CYCLE,
    uid: persona.uid,
    answer: { kind: 'pass' },
  });
}

/** The same batch the app sends, but with an arbitrary (unvalidated) book and title key. */
async function rawNominate(
  db: Firestore,
  uid: string,
  book: Record<string, unknown>,
  options: { nominationId?: string; key?: string } = {},
) {
  // Ids in the app's format: 20 letters and digits.
  const fallbackId = `raw${uid.replace(/[^A-Za-z0-9]/g, '')}`.padEnd(20, '0').slice(0, 20);
  const { nominationId = fallbackId, key = `titulo ${uid}` } = options;
  const batch = writeBatch(db);
  batch.set(doc(db, 'cycles', CYCLE, 'nominations', nominationId), { book, titleKey: key });
  batch.set(doc(db, 'cycles', CYCLE, 'answers', uid), { nominationId });
  batch.update(doc(db, 'cycles', CYCLE), {
    responses: increment(1),
    nominationIds: arrayUnion(nominationId),
  });
  await batch.commit();
}

async function responses() {
  const snapshot = await getDoc(doc(dbAs(env, bia), 'cycles', CYCLE));
  return snapshot.get('responses') as number;
}

describe('answering the nomination call', () => {
  it('accepts a nomination and counts the response', async () => {
    const nominationId = await assertSucceeds(nominate(ana));
    expect(nominationId).toEqual(expect.any(String));
    expect(await responses()).toBe(1);
  });

  it('accepts passing without a nomination', async () => {
    await assertSucceeds(pass(ana));
    expect(await responses()).toBe(1);
  });

  it('never records who nominated a book', async () => {
    const nominationId = await nominate(ana);
    const nomination = await getDoc(
      doc(dbAs(env, ana), 'cycles', CYCLE, 'nominations', `${nominationId}`),
    );
    expect(Object.keys(nomination.data() ?? {}).sort()).toEqual(['book', 'titleKey']);
  });

  it('keeps each answer visible only to its author', async () => {
    await nominate(ana);
    await assertSucceeds(getDoc(doc(dbAs(env, ana), 'cycles', CYCLE, 'answers', ana.uid)));
    await assertFails(getDoc(doc(dbAs(env, bia), 'cycles', CYCLE, 'answers', ana.uid)));
  });

  it('blocks outsiders', async () => {
    await assertFails(pass(stranger));
  });
});

describe('hidden nominations', () => {
  const nominationOf = (persona: Persona, id: string) =>
    getDoc(doc(dbAs(env, persona), 'cycles', CYCLE, 'nominations', id));
  const allAs = (persona: Persona) =>
    getDocs(collection(dbAs(env, persona), 'cycles', CYCLE, 'nominations'));

  it('show each member only their own until the vote opens, organizer included', async () => {
    const id = `${await nominate(ana)}`;
    await assertSucceeds(nominationOf(ana, id));
    await assertFails(nominationOf(bia, id));
    await assertFails(nominationOf(admin, id));
    await assertFails(allAs(ana));
    await assertFails(allAs(admin));

    await withoutRules(env, (db) => updateDoc(doc(db, 'cycles', CYCLE), { status: 'voting' }));
    await assertSucceeds(nominationOf(bia, id));
    expect((await assertSucceeds(allAs(bia))).size).toBe(1);
  });
});

describe('a reading nominated twice', () => {
  it('is taken: the check after the call sorts it out', async () => {
    await nominate(ana, makeBook({ title: 'Dom Casmurro, Machado de Assis' }));
    await assertSucceeds(nominate(bia, makeBook({ title: 'dom casmurro / MACHADO DE ASSIS' })));
  });

  it('still needs a well-formed title key', async () => {
    const db = dbAs(env, ana);
    for (const key of [' torto', 'torto  arado', '', 'a/b']) {
      await assertFails(rawNominate(db, ana.uid, { ...makeBook() }, { key }));
    }
  });

  it('leaves the old title records out of reach', async () => {
    const key = titleKey('Dom Casmurro');
    await withoutRules(env, (db) => setDoc(doc(db, 'cycles', CYCLE, 'titles', key), {}));
    const record = doc(dbAs(env, ana), 'cycles', CYCLE, 'titles', key);
    await assertFails(getDoc(record));
    await assertFails(getDocs(collection(dbAs(env, admin), 'cycles', CYCLE, 'titles')));
    await assertFails(setDoc(doc(dbAs(env, ana), 'cycles', CYCLE, 'titles', 'novo'), {}));
    await assertFails(deleteDoc(record));
  });
});

describe('answers are final', () => {
  it('blocks answering twice', async () => {
    await nominate(ana);
    await assertFails(pass(ana));
    await assertFails(nominate(ana));
  });

  it('blocks editing or deleting an answer or nomination', async () => {
    const nominationId = `${await nominate(ana)}`;
    const db = dbAs(env, ana);
    const answer = doc(db, 'cycles', CYCLE, 'answers', ana.uid);
    const nomination = doc(db, 'cycles', CYCLE, 'nominations', nominationId);

    await assertFails(updateDoc(answer, { nominationId: null }));
    await assertFails(deleteDoc(answer));
    await assertFails(updateDoc(nomination, { 'book.title': 'Outro livro' }));
    await assertFails(deleteDoc(nomination));
  });
});

describe('forged writes', () => {
  it('blocks answering on behalf of someone else', async () => {
    const forged = answerNominationCall(dbAs(env, ana), {
      cycleId: CYCLE,
      uid: bia.uid,
      answer: { kind: 'pass' },
    });
    await assertFails(forged);
  });

  it('blocks a nomination that is not tied to an answer', async () => {
    const db = dbAs(env, ana);
    const batch = writeBatch(db);
    batch.set(doc(db, 'cycles', CYCLE, 'nominations', 'loose'), { book: makeBook() });
    batch.update(doc(db, 'cycles', CYCLE), { responses: increment(1) });
    await assertFails(batch.commit());
  });

  it('blocks two nominations from one member', async () => {
    const db = dbAs(env, ana);
    const batch = writeBatch(db);
    batch.set(doc(db, 'cycles', CYCLE, 'nominations', 'first'), { book: makeBook() });
    batch.set(doc(db, 'cycles', CYCLE, 'nominations', 'second'), { book: makeBook() });
    batch.set(doc(db, 'cycles', CYCLE, 'answers', ana.uid), { nominationId: 'first' });
    batch.update(doc(db, 'cycles', CYCLE), {
      responses: increment(1),
      nominationIds: arrayUnion('first'),
    });
    await assertFails(batch.commit());
  });

  it('keeps the list of nominations honest', async () => {
    const db = dbAs(env, ana);
    const answerAndList = (nominationIds: unknown) => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'cycles', CYCLE, 'answers', ana.uid), { nominationId: null });
      batch.update(doc(db, 'cycles', CYCLE), { responses: increment(1), nominationIds });
      return batch.commit();
    };
    // Passing cannot slip a book into the ballot...
    await assertFails(answerAndList(arrayUnion('slipped-in')));
    // ...nor drop the ones already there.
    await rawNominate(dbAs(env, bia), bia.uid, { ...makeBook() });
    await assertFails(answerAndList([]));
  });

  it('blocks inflating the response count', async () => {
    const db = dbAs(env, ana);
    await assertFails(updateDoc(doc(db, 'cycles', CYCLE), { responses: increment(1) }));

    const batch = writeBatch(db);
    batch.set(doc(db, 'cycles', CYCLE, 'answers', ana.uid), { nominationId: null });
    batch.update(doc(db, 'cycles', CYCLE), { responses: increment(2) });
    await assertFails(batch.commit());
  });

  it('blocks members from changing anything else in the cycle', async () => {
    const db = dbAs(env, ana);
    await assertFails(updateDoc(doc(db, 'cycles', CYCLE), { status: 'voting' }));
    await assertFails(updateDoc(doc(db, 'cycles', CYCLE), { nominationDeadline: null }));
  });
});

describe('timing', () => {
  it('blocks nominations once voting has started', async () => {
    await withoutRules(env, (db) => updateDoc(doc(db, 'cycles', CYCLE), { status: 'voting' }));
    await assertFails(nominate(ana));
  });

  it('blocks nominations after the deadline', async () => {
    await withoutRules(env, (db) =>
      updateDoc(doc(db, 'cycles', CYCLE), { nominationDeadline: PAST }),
    );
    await assertFails(pass(ana));
  });
});

describe('book validation', () => {
  const valid = { ...makeBook() };

  it('accepts a valid book sent without the client helpers', async () => {
    await assertSucceeds(rawNominate(dbAs(env, ana), ana.uid, valid));
  });

  it('accepts an uploaded cover image', async () => {
    const coverUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';
    await assertSucceeds(rawNominate(dbAs(env, ana), ana.uid, { ...valid, coverUrl }));
  });

  it('accepts a synopsis credited to a catalog, or none at all', async () => {
    await assertSucceeds(
      rawNominate(dbAs(env, ana), ana.uid, { ...valid, synopsisSource: 'wikipedia' }),
    );
    await assertSucceeds(
      rawNominate(dbAs(env, bia), bia.uid, { ...valid, synopsis: null, synopsisSource: null }),
    );
  });

  it.each([
    ['an empty title', { title: '' }],
    ['an unknown field', { nominatedBy: 'ana' }],
    ['a synopsis over 2000 characters', { synopsis: 'x'.repeat(2001) }],
    ['an empty synopsis', { synopsis: '' }],
    ['an unknown synopsis source', { synopsisSource: 'blog' }],
    ['a source without a synopsis', { synopsis: null, synopsisSource: 'anilist' }],
    ['a non-https synopsis link', { synopsisUrl: 'http://example.com/sinopse' }],
    ['a script link as cover', { coverUrl: 'javascript:alert(1)' }],
    ['an SVG upload', { coverUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }],
    ['an oversized upload', { coverUrl: `data:image/jpeg;base64,${'A'.repeat(200_001)}` }],
    ['a title over 200 characters', { title: 'x'.repeat(201) }],
    ['a title that is not text', { title: 42 }],
  ])('rejects %s', async (_case, change) => {
    await assertFails(rawNominate(dbAs(env, ana), ana.uid, { ...valid, ...change }));
  });

  it('rejects a book missing a field', async () => {
    const partial: Record<string, unknown> = { ...valid };
    delete partial.synopsisUrl;
    await assertFails(rawNominate(dbAs(env, ana), ana.uid, partial));
  });
});
