import { readFileSync } from 'node:fs';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';

import type { Book, NominationId, Tally, VoteResults } from '@/domain/types';
import { makeBook } from '@/test/factories';

export interface Persona {
  uid: string;
  email: string;
}

export const admin: Persona = { uid: 'admin-uid', email: 'admin@example.com' };
export const ana: Persona = { uid: 'ana-uid', email: 'ana@example.com' };
export const bia: Persona = { uid: 'bia-uid', email: 'bia@example.com' };
/** Mixed-case email: the allowlist entry is lowercase. */
export const caio: Persona = { uid: 'caio-uid', email: 'Caio@Example.com' };
/** Verified Google account that is not on the allowlist. */
export const stranger: Persona = { uid: 'stranger-uid', email: 'stranger@example.com' };

/** Cycles are named by number; this one is round 1. */
export const CYCLE = 'ciclo-1';
export const N_ANA: NominationId = 'nomination-ana';
export const N_BIA: NominationId = 'nomination-bia';
export const N_ADMIN: NominationId = 'nomination-admin';
export const ALL_NOMINATIONS = [N_ANA, N_BIA, N_ADMIN];

/** admin, ana, bia and caio: "everyone" in the automatic flow. */
export const MEMBER_COUNT = 4;

export const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));

export function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-clube-do-livro',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}

// rules-unit-testing hands out the compat Firestore; the modular API accepts
// it at runtime (it unwraps `_delegate`), so the casts are type-only.

export function dbAs(env: RulesTestEnvironment, persona: Persona, verified = true): Firestore {
  const context = env.authenticatedContext(persona.uid, {
    email: persona.email,
    email_verified: verified,
  });
  return context.firestore() as unknown as Firestore;
}

export function guestDb(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

export async function withoutRules(
  env: RulesTestEnvironment,
  write: (db: Firestore) => Promise<unknown>,
) {
  await env.withSecurityRulesDisabled(async (context) => {
    await write(context.firestore() as unknown as Firestore);
  });
}

export function bookFor(nominationId: NominationId): Book {
  return makeBook({ title: `Livro ${nominationId}` });
}

export function cycleData(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    status: 'nominating',
    responses: 0,
    nominationIds: [],
    nominationDeadline: null,
    votingDeadline: null,
    createdAt: Timestamp.now(),
    options: [],
    ballots: 0,
    votingOpenedAt: null,
    votingClosedAt: null,
    results: null,
    winner: null,
    readingStartedAt: null,
    finishedReaders: 0,
    finishedAt: null,
    ...overrides,
  };
}

export async function seedAllowlist(env: RulesTestEnvironment) {
  await withoutRules(env, async (db) => {
    await setDoc(doc(db, 'allowlist', admin.email), { admin: true });
    await setDoc(doc(db, 'allowlist', ana.email), {});
    await setDoc(doc(db, 'allowlist', bia.email), {});
    await setDoc(doc(db, 'allowlist', caio.email.toLowerCase()), {});
    await setDoc(doc(db, 'settings', 'club'), { members: MEMBER_COUNT });
  });
}

/** An empty cycle collecting nominations. */
export async function seedNominating(env: RulesTestEnvironment, cycle = {}) {
  await seedAllowlist(env);
  await withoutRules(env, (db) => setDoc(doc(db, 'cycles', CYCLE), cycleData(cycle)));
}

/** Everyone answered: ana, bia and admin nominated; caio passed. */
export async function seedAnswered(env: RulesTestEnvironment, cycle = {}) {
  await seedAllowlist(env);
  await withoutRules(env, async (db) => {
    await setDoc(
      doc(db, 'cycles', CYCLE),
      cycleData({ responses: 4, nominationIds: ALL_NOMINATIONS, ...cycle }),
    );
    const nominators: [Persona, NominationId][] = [
      [ana, N_ANA],
      [bia, N_BIA],
      [admin, N_ADMIN],
    ];
    for (const [persona, nominationId] of nominators) {
      await setDoc(doc(db, 'cycles', CYCLE, 'nominations', nominationId), {
        book: bookFor(nominationId),
      });
      await setDoc(doc(db, 'cycles', CYCLE, 'answers', persona.uid), { nominationId });
    }
    await setDoc(doc(db, 'cycles', CYCLE, 'answers', caio.uid), { nominationId: null });
  });
}

interface VotingSeed {
  options?: NominationId[];
  /** Every vote per book; defaults to zero for every option. */
  votes?: Tally;
  /** First choices per book; defaults to zero for every option. */
  firsts?: Tally;
  cycle?: Record<string, unknown>;
}

/** The tally a seed produces, as `readResults` returns it. */
export function seededResults(seed: VotingSeed = {}): VoteResults {
  const options = seed.options ?? ALL_NOMINATIONS;
  const zeros = Object.fromEntries(options.map((option) => [option, 0]));
  return { votes: seed.votes ?? zeros, firsts: seed.firsts ?? zeros };
}

/** Voting open after everyone answered. */
export async function seedVoting(env: RulesTestEnvironment, seed: VotingSeed = {}) {
  const options = seed.options ?? ALL_NOMINATIONS;
  await seedAnswered(env, {
    status: 'voting',
    options,
    votingOpenedAt: Timestamp.now(),
    ...seed.cycle,
  });
  await withoutRules(env, (db) =>
    setDoc(doc(db, 'cycles', CYCLE, 'tally', 'counts'), seededResults(seed)),
  );
}

/** A fixed closing time, so tests know which tied book a draw gives. */
export const CLOSED_AT = Timestamp.fromMillis(1_700_000_000_001);

/** Voting closed; someone is about to declare the winner. */
export async function seedTallying(env: RulesTestEnvironment, seed: VotingSeed = {}) {
  await seedVoting(env, {
    ...seed,
    cycle: { status: 'tallying', votingClosedAt: CLOSED_AT, ...seed.cycle },
  });
}

/** Round 1 being read; `readers` already marked "Acabei de ler!". */
export async function seedReading(env: RulesTestEnvironment, readers: Persona[] = []) {
  await seedAllowlist(env);
  await withoutRules(env, async (db) => {
    await setDoc(
      doc(db, 'cycles', CYCLE),
      cycleData({
        status: 'reading',
        responses: 4,
        nominationIds: [N_ANA],
        options: [N_ANA],
        winner: {
          nominationId: N_ANA,
          book: bookFor(N_ANA),
          method: 'unopposed',
          decidedAt: Timestamp.now(),
          drawnFrom: [],
        },
        readingStartedAt: Timestamp.now(),
        finishedReaders: readers.length,
      }),
    );
    for (const reader of readers) {
      await setDoc(doc(db, 'cycles', CYCLE, 'readers', reader.uid), {});
    }
  });
}
