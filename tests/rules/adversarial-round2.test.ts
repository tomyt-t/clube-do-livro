import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { drawOrder, drawWinner } from '@/domain/draw';
import { ballotOptions, MAX_MERGED, openingResults, type Merged } from '@/domain/review';
import { titleKey } from '@/domain/title-key';
import type { Book, NominationId } from '@/domain/types';
import { MAX_OPTIONS } from '@/domain/voting';
import {
  allowEmails,
  endEmptyRound,
  openCycle,
  revokeEmail,
} from '@/services/firebase/admin-writes';
import {
  declareWinner,
  recordReview,
  startReview,
  startVoting,
} from '@/services/firebase/flow-writes';
import { answerNominationCall, castBallot, claimSeat } from '@/services/firebase/member-writes';
import { findNominators, reopenNominations } from '@/services/firebase/review-writes';
import { makeBook } from '@/test/factories';

import {
  admin,
  ana,
  bia,
  bookFor,
  caio,
  CLOSED_AT,
  createEnv,
  cycleData,
  CYCLE,
  dbAs,
  N_ADMIN,
  N_ANA,
  N_BIA,
  seedAllowlist,
  seedAnswered,
  seedNominating,
  seedTallying,
  seedVoting,
  withoutRules,
  type Persona,
} from './helpers';

/**
 * Second round of attacks on firestore.rules, aimed at seats, letting
 * nominations go, the review record and the expression budget. Each test
 * asserts what the club needs, so it fails while the hole is open.
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

const asAdmin = () => dbAs(env, admin);
const cycleRef = (db: Firestore) => doc(db, 'cycles', CYCLE);
const nominationRef = (db: Firestore, id: NominationId) =>
  doc(db, 'cycles', CYCLE, 'nominations', id);
const titleRef = (db: Firestore, key: string) => doc(db, 'cycles', CYCLE, 'titles', key);
const answerRef = (db: Firestore, uid: string) => doc(db, 'cycles', CYCLE, 'answers', uid);

/** Nomination ids in the app's format (20 letters and digits), so they can be re-created. */
const ID = {
  ana: 'AnaReading0000000001',
  bia: 'BiaReading0000000002',
  org: 'OrgReading0000000003',
} as const;
const NOMINATORS: [Persona, NominationId][] = [
  [ana, ID.ana],
  [bia, ID.bia],
  [admin, ID.org],
];
const keyOf = (id: NominationId) => titleKey(`Livro ${id}`);

const flagged = (ids: NominationId[]) => ({
  review: { ids, groups: [{ ids, reason: 'A mesma obra.' }] },
});

/** Everyone answered (Ana, Bia and the organizer nominated; Caio passed), with app-format ids. */
async function seedRound(cycle: Record<string, unknown> = {}) {
  await seedAllowlist(env);
  await withoutRules(env, async (db) => {
    const nominationIds = NOMINATORS.map(([, id]) => id);
    await setDoc(cycleRef(db), cycleData({ responses: 4, nominationIds, ...cycle }));
    for (const [persona, id] of NOMINATORS) {
      await setDoc(nominationRef(db, id), { book: bookFor(id), titleKey: keyOf(id) });
      await setDoc(titleRef(db, keyOf(id)), {});
      await setDoc(answerRef(db, persona.uid), { nominationId: id });
    }
    await setDoc(answerRef(db, caio.uid), { nominationId: null });
  });
}

function nominate(persona: Persona, title: string) {
  return answerNominationCall(dbAs(env, persona), {
    cycleId: CYCLE,
    uid: persona.uid,
    answer: { kind: 'nominate', book: makeBook({ title }) },
  });
}

/** The app's nomination batch, under a nomination id of the member's choosing. */
function nominateUnder(persona: Persona, nominationId: NominationId, title: string) {
  const db = dbAs(env, persona);
  const key = titleKey(title);
  const batch = writeBatch(db);
  batch.set(nominationRef(db, nominationId), { book: makeBook({ title }), titleKey: key });
  batch.set(titleRef(db, key), {});
  batch.set(answerRef(db, persona.uid), { nominationId });
  batch.update(cycleRef(db), { responses: increment(1), nominationIds: arrayUnion(nominationId) });
  return batch.commit();
}

const letGo = (nominationIds: NominationId[]) =>
  reopenNominations(asAdmin(), { cycleId: CYCLE, nominationIds });

// ------------------------------------------------------------ letting go

describe('a nomination the organizer let go', () => {
  it('keeps its nominator free to answer again, even if another let-go member takes its id', async () => {
    await seedRound(flagged([ID.ana, ID.bia]));
    await letGo([ID.ana, ID.bia]);
    // Ana answers first, re-using the id of Bia's nomination (it was public in the cycle's list).
    // Bia's answer now points at a listed nomination again: she is locked out, the response
    // count stays one short (the review never starts by itself), Bia can read Ana's hidden
    // nomination as "her own" and cannot vote for it.
    await nominateUnder(ana, ID.bia, 'Grande Sertão: Veredas').catch(() => undefined);
    await assertSucceeds(nominate(bia, 'Vidas Secas'));
  });

  it('cannot be re-created off the list: the revealed list is exactly the round’s nominations', async () => {
    await seedRound(flagged([ID.ana, ID.org]));
    await letGo([ID.ana]);
    // Ana re-creates her let-go nomination with a title record, without answering: her old
    // answer still points at it, and it is not on the list, so the rules see "answering now".
    const db = dbAs(env, ana);
    const squatted = titleKey('Vidas Secas');
    const orphan = writeBatch(db);
    orphan.set(nominationRef(db, ID.ana), {
      book: makeBook({ title: 'Vidas Secas' }),
      titleKey: squatted,
    });
    orphan.set(titleRef(db, squatted), {});
    await orphan.commit().catch(() => undefined);
    // She still counts as let go, so she answers again as the app does; the review starts.
    const fresh = (await nominate(ana, 'São Bernardo')) ?? '';
    await startReview(dbAs(env, caio), CYCLE);
    const listed = await getDocs(collection(dbAs(env, bia), 'cycles', CYCLE, 'nominations'));
    // The orphan shows in the list and goes to the duplicate check, but no record can flag it
    // (ids must be on the list), so a check that pairs it with a listed reading wedges the round.
    expect(listed.docs.map(({ id }) => id).sort()).toEqual([ID.bia, ID.org, fresh].sort());
  });

  it('held: a merged nominator cannot answer again when another reading is let go', async () => {
    await seedRound({ ...flagged([ID.ana, ID.org]), merged: { [ID.bia]: ID.org } });
    await letGo([ID.ana]);
    await assertFails(nominate(bia, 'Outra leitura'));
    await assertFails(nominateUnder(bia, ID.ana, 'Outra leitura'));
  });
});

// ------------------------------------------------- the organizer's flags

describe('flags the organizer records', () => {
  it('cannot take a reading off the ballot: flag it, let it go and open the vote at once', async () => {
    await seedAnswered(env);
    const db = asAdmin();
    await startReview(db, CYCLE);
    // No check flagged anything: the organizer's device records its own "conflict".
    await recordReview(db, CYCLE, [{ ids: [N_BIA, N_ADMIN], reason: 'A mesma obra.' }], {});
    await reopenNominations(db, { cycleId: CYCLE, nominationIds: [N_BIA] });
    // Bia never gets the chance to nominate again (a past nomination deadline does the same).
    const options = [N_ANA, N_ADMIN];
    const opening = openingResults(options, {});
    await assertFails(startVoting(db, { cycleId: CYCLE, options, opening, votingDeadline: null }));
  });

  it('cannot reveal more than half the nominators of a round by flagging again after a let-go', async () => {
    const dani: Persona = { uid: 'dani-uid', email: 'dani@example.com' };
    const edu: Persona = { uid: 'edu-uid', email: 'edu@example.com' };
    const club = [ana, bia, caio, dani, edu, admin];
    await seedAllowlist(env);
    await withoutRules(env, async (db) => {
      for (const p of [dani, edu]) await setDoc(doc(db, 'allowlist', p.email), { uid: p.uid });
      await setDoc(doc(db, 'settings', 'club'), { members: club.length });
      await setDoc(cycleRef(db), cycleData());
      for (const p of club) {
        await setDoc(doc(db, 'members', p.uid), { name: p.uid, photoURL: null });
      }
    });
    const ids: NominationId[] = [];
    for (const p of club) ids.push((await nominate(p, `Livro de ${p.uid}`)) ?? '');
    const [fromAna = '', fromBia = '', fromCaio = '', fromDani = '', fromEdu = ''] = ids;
    const db = asAdmin();
    const learned = new Set<string>();
    const learn = async (flags: NominationId[]) => {
      await startReview(db, CYCLE).catch(() => undefined);
      await recordReview(db, CYCLE, [{ ids: flags, reason: '' }], {}).catch(() => undefined);
      const found = await findNominators(db, CYCLE, flags);
      for (const uid of Object.values(found).flat()) learned.add(uid);
    };

    await learn([fromAna, fromBia, fromCaio]); // half of 6: the most one review may flag
    await letGo([fromAna]);
    await nominate(ana, 'Outra leitura');
    await learn([fromDani, fromEdu]);
    expect(learned.size).toBeLessThanOrEqual(3);
  });

  it('cannot record a group that repeats one reading (a lone reading flagged as a pair)', async () => {
    await seedAnswered(env, { review: { ids: null, groups: [] } });
    const lone = { ids: [N_BIA, N_BIA], groups: [{ ids: [N_BIA, N_BIA], reason: '' }] };
    await assertFails(updateDoc(cycleRef(asAdmin()), { review: lone }));
  });
});

// ------------------------------------------------------------------ seats

describe('a seat freed for a new account', () => {
  const anaAgain: Persona = { uid: 'ana-uid-recreated', email: ana.email };

  it('is never freed by a stale "add" of an email already on the list', async () => {
    await seedVoting(env);
    await assertFails(allowEmails(asAdmin(), [ana.email]));
    await assertFails(claimSeat(dbAs(env, anaAgain), ana.email, anaAgain.uid));
  });

  // Accepted, not fixed: freeing a seat takes removing the email and adding it again, a
  // deliberate act of the organizer, who can already add any email (a second vote by another
  // name). The setup guide says so; keying records by email would not change it.
  it('accepted: once the organizer removes and re-adds the email, the new account votes', async () => {
    await seedVoting(env);
    await assertSucceeds(
      castBallot(dbAs(env, ana), { cycleId: CYCLE, uid: ana.uid, choices: [N_BIA, N_ADMIN] }),
    );
    // Ana's old account is gone; the organizer removes and re-adds her email so the new one
    // can claim the seat (the only way the app offers).
    await revokeEmail(asAdmin(), ana.email);
    await allowEmails(asAdmin(), [ana.email]);
    await claimSeat(dbAs(env, anaAgain), ana.email, anaAgain.uid);
    // No receipt and no answer under the new uid: a second ballot, for her own nomination too.
    const again = { cycleId: CYCLE, uid: anaAgain.uid, choices: [N_ANA, N_BIA] };
    await assertSucceeds(castBallot(dbAs(env, anaAgain), again));
  });
});

// --------------------------------------------------------------- liveness

describe('a round where everyone passed', () => {
  it('held (rules): the organizer can still open the next round', async () => {
    await seedNominating(env);
    for (const p of [admin, ana, bia, caio]) {
      await answerNominationCall(dbAs(env, p), {
        cycleId: CYCLE,
        uid: p.uid,
        answer: { kind: 'pass' },
      });
    }
    // No review (no nominations), no vote (no options), no delete (answers exist). The rules
    // still take a new round; the app does not offer it while this one is "in progress".
    await assertSucceeds(openCycle(asAdmin(), { number: 2, nominationDeadline: null }));
  });

  it('can be ended by the organizer alone, and only once nobody can nominate', async () => {
    await seedNominating(env);
    const passAs = (p: Persona) =>
      answerNominationCall(dbAs(env, p), { cycleId: CYCLE, uid: p.uid, answer: { kind: 'pass' } });
    for (const p of [admin, ana, bia]) await passAs(p);
    // Caio could still nominate.
    await assertFails(endEmptyRound(asAdmin(), CYCLE));
    await passAs(caio);
    await assertFails(endEmptyRound(dbAs(env, ana), CYCLE));
    await assertSucceeds(endEmptyRound(asAdmin(), CYCLE));
  });

  it('cannot end a round that has nominations', async () => {
    await seedRound();
    await assertFails(endEmptyRound(asAdmin(), CYCLE));
  });
});

// ------------------------------------------------------------------ budget

describe('the expression budget at the largest round', () => {
  const OPTIONS = Array.from(
    { length: MAX_OPTIONS },
    (_, i): NominationId => `Reading${String(i).padStart(13, '0')}`,
  );
  /**
   * The last readings merged into the first ones: as many as leave three free at the largest
   * round (`limits.test.ts` opens a vote with all MAX_MERGED merges).
   */
  const MERGES = Math.min(MAX_MERGED, (MAX_OPTIONS - 3) >> 1);
  const MERGED: Merged = Object.fromEntries(
    OPTIONS.slice(MAX_OPTIONS - MERGES).map((id, index) => [id, OPTIONS[index] ?? '']),
  );
  /** Readings neither merged nor merged into. */
  const FREE = OPTIONS.slice(MERGES, MAX_OPTIONS - MERGES);
  const [F0 = '', F1 = '', F2 = ''] = FREE;

  async function seedFullRound(flags: NominationId[], owner: Persona = ana) {
    await seedAllowlist(env);
    await withoutRules(env, async (db) => {
      const cycle = { nominationIds: OPTIONS, responses: MAX_OPTIONS, merged: MERGED };
      await setDoc(cycleRef(db), cycleData({ ...cycle, ...flagged(flags) }));
      for (const id of flags) {
        await setDoc(nominationRef(db, id), { book: bookFor(id), titleKey: keyOf(id) });
        await setDoc(titleRef(db, keyOf(id)), {});
      }
      await setDoc(answerRef(db, owner.uid), { nominationId: F0 });
    });
  }

  it('held: the organizer lets three readings go at once, with merges', async () => {
    await seedFullRound([F0, F1, F2]);
    await assertSucceeds(letGo([F0, F1, F2]));
  });

  it('held: a let-go member nominates again into a list one short of full, with a full-size book', async () => {
    await seedFullRound([F0, F1]);
    await letGo([F0]);
    const book: Book = {
      title: 'T'.repeat(200),
      synopsis: 's'.repeat(2000),
      synopsisSource: 'wikipedia',
      synopsisUrl: `https://example.com/${'a'.repeat(980)}`,
      coverUrl: `data:image/jpeg;base64,${'A'.repeat(200_000 - 23)}`,
    };
    const input = { cycleId: CYCLE, uid: ana.uid, answer: { kind: 'nominate', book } as const };
    await assertSucceeds(answerNominationCall(dbAs(env, ana), input));
  });

  it('held: the organizer opens the vote early, with merges and flags pending', async () => {
    await seedFullRound([F0, F1]);
    const options = ballotOptions(OPTIONS, MERGED);
    const opening = openingResults(options, MERGED);
    await assertSucceeds(
      startVoting(asAdmin(), { cycleId: CYCLE, options, opening, votingDeadline: null }),
    );
  });

  it('held: a member whose nomination is on the largest ballot votes for two others', async () => {
    await seedVoting(env, { options: OPTIONS });
    await withoutRules(env, (db) => setDoc(answerRef(db, ana.uid), { nominationId: F0 }));
    const last = OPTIONS.slice(-2);
    await assertSucceeds(
      castBallot(dbAs(env, ana), { cycleId: CYCLE, uid: ana.uid, choices: last }),
    );
  });

  /** Nobody voted on the largest ballot: a draw among all, with the round before in `previous`. */
  async function drawAll(persona: Persona, previous: string, startReading: boolean) {
    const zeros = Object.fromEntries(OPTIONS.map((id) => [id, 0]));
    const results = { votes: zeros, firsts: zeros };
    await seedTallying(env, { options: OPTIONS, ...results });
    const winner = drawWinner(OPTIONS, OPTIONS, CLOSED_AT.toMillis());
    await withoutRules(env, async (db) => {
      await setDoc(doc(db, 'cycles', 'ciclo-0'), { number: 0, status: previous });
      await setDoc(nominationRef(db, winner), { book: bookFor(winner), titleKey: keyOf(winner) });
    });
    return declareWinner(dbAs(env, persona), {
      cycleId: CYCLE,
      nominationId: winner,
      book: bookFor(winner),
      method: 'draw',
      drawnFrom: drawOrder(OPTIONS, OPTIONS),
      results,
      startReading,
    });
  }

  // Measured with padded copies of the rules at 20 options: the member's 20-way draw passed with
  // only 1 to 3 extra `(1 == 1) &&` terms in declaresWinner. The ballot is now capped lower.
  it('held: a member declares the largest draw after a finished round, starting the reading', async () => {
    await assertSucceeds(drawAll(caio, 'finished', true));
  });

  it('held: a member declares the largest draw while the round before is read, so it waits', async () => {
    await assertSucceeds(drawAll(caio, 'reading', false));
  });

  it('gives nobody, not even the organizer, a say on whether the winner waits', async () => {
    await assertFails(drawAll(admin, 'reading', true));
  });
});
