import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  increment,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { openingResults } from '@/domain/review';
import { decide } from '@/domain/tally';
import { titleKey } from '@/domain/title-key';
import type { Book, NominationId } from '@/domain/types';
import {
  closeVoting,
  declareWinner,
  readResults,
  recordReview,
  startReview,
  startVoting,
} from '@/services/firebase/flow-writes';
import { answerNominationCall, castBallot, markFinished } from '@/services/firebase/member-writes';
import { makeBook } from '@/test/factories';

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
  seedNominating,
  seedReading,
  seedTallying,
  seedVoting,
  withoutRules,
  type Persona,
} from './helpers';

/**
 * Attacks on firestore.rules by regular members. Each test asserts the
 * behavior the club needs, so it fails while the hole is open.
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
const CLEAR = { review: { ids: [], groups: [] } };

/** Ana after deleting her Firebase account and signing in again: same email, new uid. */
const anaAgain: Persona = { uid: 'ana-uid-recreated', email: ana.email };

function vote(persona: Persona, choices: NominationId[]) {
  return castBallot(dbAs(env, persona), { cycleId: CYCLE, uid: persona.uid, choices });
}

function nominate(persona: Persona, title: string) {
  return answerNominationCall(dbAs(env, persona), {
    cycleId: CYCLE,
    uid: persona.uid,
    answer: { kind: 'nominate', book: makeBook({ title }) },
  });
}

function pass(persona: Persona) {
  return answerNominationCall(dbAs(env, persona), {
    cycleId: CYCLE,
    uid: persona.uid,
    answer: { kind: 'pass' },
  });
}

/** The app's nomination batch, but under a nomination id of the attacker's choosing. */
async function nominateAs(persona: Persona, nominationId: string, title: string) {
  const db = dbAs(env, persona);
  const key = titleKey(title);
  const batch = writeBatch(db);
  batch.set(doc(db, 'cycles', CYCLE, 'nominations', nominationId), {
    book: makeBook({ title }),
    titleKey: key,
  });
  batch.set(doc(db, 'cycles', CYCLE, 'titles', key), {});
  batch.set(doc(db, 'cycles', CYCLE, 'answers', persona.uid), { nominationId });
  batch.update(cycleRef(db), { responses: increment(1), nominationIds: arrayUnion(nominationId) });
  await batch.commit();
  return nominationId;
}

/** Opens the vote as the app does, as a regular member. */
function openVote(options: NominationId[]) {
  return startVoting(dbAs(env, caio), {
    cycleId: CYCLE,
    options,
    opening: openingResults(options, {}),
    votingDeadline: null,
  });
}

/** Everyone votes for the first two books that are not their own. */
async function everyoneVotes(options: NominationId[], own: Map<Persona, NominationId | null>) {
  for (const [persona, mine] of own) {
    await vote(persona, options.filter((option) => option !== mine).slice(0, 2));
  }
}

/** Closes the vote and declares what the club's rule gives, exactly as the app does. */
async function closeAndDeclare(options: NominationId[]) {
  const db = dbAs(env, caio);
  await closeVoting(db, CYCLE);
  const results = await readResults(db, CYCLE);
  const closedAt = (await getDoc(cycleRef(db))).get('votingClosedAt') as Timestamp;
  const decision = decide(options, results, closedAt.toMillis());
  const nomination = await getDoc(doc(db, 'cycles', CYCLE, 'nominations', decision.nominationId));
  return declareWinner(db, {
    cycleId: CYCLE,
    nominationId: decision.nominationId,
    book: nomination.get('book') as Book,
    method: decision.method,
    drawnFrom: decision.drawnFrom,
    results,
    startReading: true,
  });
}

// ------------------------------------------------------------------ identity

describe('one person, two Firebase accounts (rules key members by uid, the allowlist by email)', () => {
  it('re-created account cannot cast a second ballot (and vote for its own nomination)', async () => {
    await seedVoting(env);
    await assertSucceeds(vote(ana, [N_BIA, N_ADMIN]));
    // New uid: no receipt and no answer, so the rules see a fresh voter who nominated nothing.
    await assertFails(vote(anaAgain, [N_ANA, N_BIA]));
  });

  it('re-created account cannot answer the nomination call a second time', async () => {
    await seedNominating(env);
    await assertSucceeds(nominate(ana, 'Torto Arado'));
    await assertFails(nominate(anaAgain, 'Dom Casmurro'));
  });

  it('re-created account cannot mark "Acabei de ler!" twice to end the book for everyone', async () => {
    await seedReading(env, [admin, ana, bia]);
    // Caio has not finished; a second mark from Ana would make it "everyone".
    await assertFails(markFinished(dbAs(env, anaAgain), CYCLE, anaAgain.uid));
  });
});

// ---------------------------------------------------- the review record

describe('recording the duplicate check (any member, once)', () => {
  beforeEach(async () => {
    await seedAnswered(env);
    await startReview(dbAs(env, caio), CYCLE);
  });

  const record = (review: unknown) => updateDoc(cycleRef(dbAs(env, caio)), { review });

  it('rejects groups that are not conflict groups (arbitrary payload in the cycle doc)', async () => {
    await assertFails(record({ ids: [], groups: ['x'.repeat(100_000), 42, { any: 'thing' }] }));
  });

  it('rejects a record that says "clear" while listing conflict groups', async () => {
    await assertFails(
      record({ ids: [], groups: [{ ids: [N_ANA, N_BIA], reason: 'A mesma obra.' }] }),
    );
  });

  it('rejects a record that flags ids without any group (the organizer panel shows nothing)', async () => {
    await assertFails(record({ ids: [N_ANA], groups: [] }));
  });
});

describe('stuffing the review record to fill the cycle document', () => {
  /** The cycle as it will be once voting closed, with `size` bytes of junk in the review. */
  function closedCycle(size: number) {
    return cycleData({
      responses: 4,
      nominationIds: ALL_NOMINATIONS,
      status: 'tallying',
      options: ALL_NOMINATIONS,
      ballots: 4,
      votingOpenedAt: Timestamp.now(),
      votingClosedAt: Timestamp.now(),
      review: { ids: [], groups: ['x'.repeat(size)] },
    });
  }

  /** Largest junk that still lets the closed cycle fit in 1 MiB (same path length as ciclo-1). */
  async function largestJunk() {
    let low = 900_000;
    let high = 1_048_576;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      try {
        await withoutRules(env, (db) => setDoc(doc(db, 'cycles', 'ciclo-9'), closedCycle(mid)));
        low = mid;
      } catch {
        high = mid - 1;
      }
    }
    await withoutRules(env, (db) => deleteDoc(doc(db, 'cycles', 'ciclo-9')));
    return low;
  }

  /** Ordinary books with an uploaded cover (100 KB of base64, half what the rules allow). */
  async function seedUploadedCovers() {
    await withoutRules(env, async (db) => {
      for (const id of ALL_NOMINATIONS) {
        const coverUrl = `data:image/jpeg;base64,${'A'.repeat(100_000)}`;
        const book = makeBook({ title: `Livro ${id}`, coverUrl });
        await setDoc(doc(db, 'cycles', CYCLE, 'nominations', id), { book });
      }
    });
  }

  it('a member cannot make the winner impossible to declare (cycle stuck in tallying)', async () => {
    await seedAnswered(env);
    await seedUploadedCovers();
    // 50 KB of room once voting closed; declaring copies a ~100 KB book into the cycle.
    const junk = (await largestJunk()) - 50_000;
    const db = dbAs(env, caio);

    // Caio takes the flow steps himself: start the review, record it "clear"
    // with junk, open the vote. The review can never change after that.
    await startReview(db, CYCLE);
    await updateDoc(cycleRef(db), { review: { ids: [], groups: ['x'.repeat(junk)] } }).catch(() =>
      recordReview(db, CYCLE, []),
    );
    await openVote(ALL_NOMINATIONS);
    await everyoneVotes(
      ALL_NOMINATIONS,
      new Map<Persona, NominationId | null>([
        [ana, N_ANA],
        [bia, N_BIA],
        [admin, N_ADMIN],
        [caio, null],
      ]),
    );
    // Declaring adds the winner and the results: the document no longer fits.
    await assertSucceeds(closeAndDeclare(ALL_NOMINATIONS));
  });
});

// ----------------------------------------------------------- nomination ids

describe('nomination ids chosen by the member', () => {
  // A legal document id (<= 1500 bytes) whose field path fits in the tally
  // ("votes." + id <= 1500) but not in the cycle's results ("results.votes." + id).
  const LONG_ID = 'k'.repeat(1490);

  it('rejects a nomination id outside the app id format', async () => {
    await seedNominating(env);
    await assertFails(nominateAs(ana, LONG_ID, 'Torto Arado'));
  });

  it('a 1490-byte nomination id cannot make the winner impossible to declare', async () => {
    await seedNominating(env);
    const fromAna = await nominateAs(ana, LONG_ID, 'Torto Arado').catch(() =>
      nominate(ana, 'Torto Arado'),
    );
    const fromBia = await nominate(bia, 'Dom Casmurro');
    const fromAdmin = await nominate(admin, 'A Hora da Estrela');
    await pass(caio);

    const options = (await getDoc(cycleRef(dbAs(env, caio)))).get('nominationIds') as string[];
    const db = dbAs(env, caio);
    await startReview(db, CYCLE);
    await recordReview(db, CYCLE, []);
    await openVote(options);
    await everyoneVotes(
      options,
      new Map<Persona, NominationId | null>([
        [ana, fromAna],
        [bia, fromBia],
        [admin, fromAdmin],
        [caio, null],
      ]),
    );
    await assertSucceeds(closeAndDeclare(options));
  });
});

// ------------------------------------------------------------ declaring

describe('declaring the winner as a regular member', () => {
  it('cannot park the winner as "upcoming" when no other book is being read', async () => {
    const seed = {
      votes: { [N_ANA]: 3, [N_BIA]: 1, [N_ADMIN]: 0 },
      firsts: { [N_ANA]: 2, [N_BIA]: 1, [N_ADMIN]: 0 },
    };
    await seedTallying(env, seed);
    // Nothing else is being read, so the book must start; "upcoming" leaves
    // the club with no reading and no automatic step until the organizer acts.
    const parked = declareWinner(dbAs(env, caio), {
      cycleId: CYCLE,
      nominationId: N_ANA,
      book: bookFor(N_ANA),
      method: 'votes',
      drawnFrom: [],
      results: seed,
      startReading: false,
    });
    await assertFails(parked);
  });
});

// ------------------------------------------------------------ opening the vote

describe('opening the vote as a regular member', () => {
  it('cannot set a voting deadline (here already past) that blocks every ballot', async () => {
    await seedAnswered(env, CLEAR);
    const opened = startVoting(dbAs(env, caio), {
      cycleId: CYCLE,
      options: ALL_NOMINATIONS,
      opening: openingResults(ALL_NOMINATIONS, {}),
      votingDeadline: new Date('2020-01-01T00:00:00Z'),
    });
    await assertFails(opened);
  });
});
