import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { allowEmails, revokeEmail } from '@/services/firebase/admin-writes';
import { claimSeat, saveMemberProfile } from '@/services/firebase/member-writes';

import {
  admin,
  ana,
  bia,
  caio,
  createEnv,
  CYCLE,
  dbAs,
  type Persona,
  guestDb,
  seedNominating,
  stranger,
  withoutRules,
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

describe('who gets in', () => {
  it('denies guests', async () => {
    await assertFails(getDocs(collection(guestDb(env), 'cycles')));
  });

  it('denies verified emails that are not on the allowlist', async () => {
    await assertFails(getDocs(collection(dbAs(env, stranger), 'cycles')));
  });

  it('denies unverified emails even when they are on the allowlist', async () => {
    await assertFails(getDocs(collection(dbAs(env, ana, false), 'cycles')));
  });

  it('lets members in', async () => {
    await assertSucceeds(getDocs(collection(dbAs(env, ana), 'cycles')));
  });

  it('matches the allowlist regardless of email case', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, caio), 'cycles', CYCLE)));
  });
});

describe('seats', () => {
  const dani: Persona = { uid: 'dani-uid', email: 'dani@example.com' };
  const daniAgain: Persona = { uid: 'dani-uid-recreated', email: dani.email };

  beforeEach(async () => {
    await withoutRules(env, (db) => setDoc(doc(db, 'allowlist', dani.email), {}));
  });

  it('lets a new member in once their account claims the seat', async () => {
    await assertFails(getDocs(collection(dbAs(env, dani), 'cycles')));
    await assertSucceeds(claimSeat(dbAs(env, dani), dani.email, dani.uid));
    await assertSucceeds(getDocs(collection(dbAs(env, dani), 'cycles')));
  });

  it('keeps a second account for the same email out', async () => {
    await claimSeat(dbAs(env, dani), dani.email, dani.uid);
    await assertFails(claimSeat(dbAs(env, daniAgain), dani.email, daniAgain.uid));
    await assertFails(getDocs(collection(dbAs(env, daniAgain), 'cycles')));
    await assertFails(getDocs(collection(dbAs(env, { ...ana, uid: 'ana-again' }), 'cycles')));
  });

  it("never lets anyone claim someone else's seat, or for another account", async () => {
    await assertFails(claimSeat(dbAs(env, stranger), dani.email, stranger.uid));
    await assertFails(claimSeat(dbAs(env, dani), dani.email, 'someone-else'));
    await assertFails(claimSeat(dbAs(env, dani, false), dani.email, dani.uid));
  });
});

describe('allowlist', () => {
  it('lets members check only their own entry', async () => {
    const db = dbAs(env, ana);
    await assertSucceeds(getDoc(doc(db, 'allowlist', ana.email)));
    await assertFails(getDoc(doc(db, 'allowlist', bia.email)));
  });

  it('lets an outsider learn only that they are not on it', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, stranger), 'allowlist', stranger.email)));
    await assertFails(getDoc(doc(dbAs(env, stranger), 'allowlist', ana.email)));
  });

  it('never lets members list the emails', async () => {
    await assertFails(getDocs(collection(dbAs(env, ana), 'allowlist')));
  });

  it('never lets members add anyone', async () => {
    await assertFails(allowEmails(dbAs(env, ana), ['friend@example.com']));
  });

  it('lets the admin list, add and remove other entries', async () => {
    const db = dbAs(env, admin);
    await assertSucceeds(getDocs(collection(db, 'allowlist')));
    await assertSucceeds(allowEmails(db, ['friend@example.com']));
    await assertSucceeds(revokeEmail(db, bia.email));
    await assertFails(getDocs(collection(dbAs(env, bia), 'cycles')));
  });

  it('rejects malformed entries', async () => {
    const db = dbAs(env, admin);
    await assertFails(setDoc(doc(db, 'allowlist', 'Friend@Example.com'), {}));
    await assertFails(setDoc(doc(db, 'allowlist', 'not-an-email'), {}));
    await assertFails(setDoc(doc(db, 'allowlist', 'friend@example.com'), { admin: 'yes' }));
    await assertFails(setDoc(doc(db, 'allowlist', 'friend@example.com'), { note: 'x' }));
  });

  it('lets the admin free a seat only by removing the email, never bind one', async () => {
    const db = dbAs(env, admin);
    await assertFails(setDoc(doc(db, 'allowlist', ana.email), { uid: stranger.uid }));
    await assertSucceeds(setDoc(doc(db, 'allowlist', ana.email), { admin: true, uid: ana.uid }));
    // A stale "add" of a listed email would free its seat: refused.
    await assertFails(setDoc(doc(db, 'allowlist', ana.email), {}));
    await assertSucceeds(revokeEmail(db, ana.email));
    await assertSucceeds(allowEmails(db, [ana.email]));
    await assertFails(getDocs(collection(dbAs(env, ana), 'cycles')));
  });

  it('keeps the admin from locking themselves out', async () => {
    const db = dbAs(env, admin);
    await assertFails(revokeEmail(db, admin.email));
    await assertFails(setDoc(doc(db, 'allowlist', admin.email), { admin: false }));
  });
});

describe('member profiles', () => {
  const profile = { name: 'Ana', photoURL: 'https://example.com/ana.jpg' };

  it('lets members save their own profile', async () => {
    await assertSucceeds(saveMemberProfile(dbAs(env, ana), ana.uid, profile));
  });

  it("blocks writing someone else's profile", async () => {
    await assertFails(saveMemberProfile(dbAs(env, ana), bia.uid, profile));
  });

  it('never stores an email', async () => {
    const withEmail = { ...profile, email: ana.email };
    await assertFails(setDoc(doc(dbAs(env, ana), 'members', ana.uid), withEmail));
  });

  it('rejects photos that are not https', async () => {
    const insecure = { ...profile, photoURL: 'http://example.com/ana.jpg' };
    await assertFails(setDoc(doc(dbAs(env, ana), 'members', ana.uid), insecure));
  });

  it('blocks outsiders and deletions', async () => {
    await assertFails(saveMemberProfile(dbAs(env, stranger), stranger.uid, profile));
    await withoutRules(env, (db) => setDoc(doc(db, 'members', ana.uid), profile));
    await assertFails(deleteDoc(doc(dbAs(env, ana), 'members', ana.uid)));
  });
});

describe('anything else', () => {
  it('is denied by default', async () => {
    await assertFails(setDoc(doc(dbAs(env, admin), 'settings', 'site'), { open: true }));
    await assertFails(getDoc(doc(dbAs(env, ana), 'settings', 'site')));
  });
});
