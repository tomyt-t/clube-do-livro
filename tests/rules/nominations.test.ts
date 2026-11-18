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
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { answerNominationCall } from '@/services/firebase/member-writes';
import { makeBook } from '@/test/factories';

import {
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

/** The same batch the app sends, but with an arbitrary (unvalidated) book. */
async function rawNominate(db: Firestore, uid: string, book: Record<string, unknown>) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'cycles', CYCLE, 'nominations', 'raw'), { book });
  batch.set(doc(db, 'cycles', CYCLE, 'answers', uid), { nominationId: 'raw' });
  batch.update(doc(db, 'cycles', CYCLE), { responses: increment(1) });
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
      doc(dbAs(env, bia), 'cycles', CYCLE, 'nominations', `${nominationId}`),
    );
    expect(Object.keys(nomination.data() ?? {})).toEqual(['book']);
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
    batch.update(doc(db, 'cycles', CYCLE), { responses: increment(1) });
    await assertFails(batch.commit());
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

  it.each([
    ['an empty title', { title: '' }],
    ['an unknown field', { nominatedBy: 'ana' }],
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
