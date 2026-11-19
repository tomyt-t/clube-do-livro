import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { ballotOptions, MAX_MERGED, openingResults, type Merged } from '@/domain/review';
import { titleKey } from '@/domain/title-key';
import type { NominationId } from '@/domain/types';
import { MAX_OPTIONS } from '@/domain/voting';
import {
  deleteCycle,
  endEmptyRound,
  revokeEmail,
  setMemberCount,
} from '@/services/firebase/admin-writes';
import {
  closeVoting,
  declareWinner,
  readResults,
  recordReview,
  startReview,
  startVoting,
} from '@/services/firebase/flow-writes';
import { answerNominationCall, castBallot } from '@/services/firebase/member-writes';
import { reopenNominations, updateReview } from '@/services/firebase/review-writes';
import { makeBook } from '@/test/factories';

import {
  admin,
  ana,
  bia,
  bookFor,
  caio,
  createEnv,
  cycleData,
  CYCLE,
  dbAs,
  PAST,
  seedAllowlist,
  withoutRules,
  type Persona,
} from './helpers';

/**
 * Third round of attacks on firestore.rules, aimed at what the second round
 * added: the let-go list, the wait before the vote, the round-wide flag cap,
 * ending an empty round, and the expression budget at the largest round.
 * Each test asserts what the club needs, so it fails while the hole is open;
 * "held" tests document attacks that the rules already stop.
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
const listAs = (persona: Persona) =>
  getDocs(collection(dbAs(env, persona), 'cycles', CYCLE, 'nominations'));

/** Nomination ids in the app's format (20 letters and digits). */
const ID = {
  ana: 'AnaReading0000000001',
  bia: 'BiaReading0000000002',
  org: 'OrgReading0000000003',
} as const;
const keyOf = (id: NominationId) => titleKey(`Livro ${id}`);

const flaggedReview = (ids: NominationId[]) => ({
  review: { ids, groups: [{ ids, reason: 'A mesma obra.' }] },
});

/** Stores a nomination as the app does: its document, its title record and its member's answer. */
async function seedNomination(db: Firestore, persona: Persona, id: NominationId) {
  await setDoc(nominationRef(db, id), { book: bookFor(id), titleKey: keyOf(id) });
  await setDoc(titleRef(db, keyOf(id)), {});
  await setDoc(answerRef(db, persona.uid), { nominationId: id });
}

/** Everyone answered: Ana, Bia and the organizer nominated; Caio passed. */
async function seedRound(cycle: Record<string, unknown> = {}) {
  await seedAllowlist(env);
  await withoutRules(env, async (db) => {
    const nominationIds = [ID.ana, ID.bia, ID.org];
    await setDoc(cycleRef(db), cycleData({ responses: 4, nominationIds, ...cycle }));
    await seedNomination(db, ana, ID.ana);
    await seedNomination(db, bia, ID.bia);
    await seedNomination(db, admin, ID.org);
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

const letGo = (nominationIds: NominationId[]) =>
  reopenNominations(asAdmin(), { cycleId: CYCLE, nominationIds });

/** The organizer's let-go batch, with cycle fields of their choosing. */
function letGoWith(ids: NominationId[], cycle: Record<string, unknown>) {
  const db = asAdmin();
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.delete(nominationRef(db, id));
    batch.delete(titleRef(db, keyOf(id)));
  }
  batch.update(cycleRef(db), {
    review: null,
    responses: increment(-ids.length),
    nominationIds: arrayRemove(...ids),
    letGo: arrayUnion(...ids),
    letGoAt: serverTimestamp(),
    ...cycle,
  });
  return batch.commit();
}

/**
 * A let-go member "answers again" with the cycle alone: her answer still points at the let-go
 * id, so the rules see her answering now, and her own nomination is that id.
 */
const relistLetGo = (persona: Persona, id: NominationId) =>
  updateDoc(cycleRef(dbAs(env, persona)), {
    responses: increment(1),
    nominationIds: arrayUnion(id),
    letGo: arrayRemove(id),
  });

// ------------------------------------------------------------ answering again

describe('answering again after a let-go', () => {
  it('cannot put the let-go reading back on the list without a new answer (a book-less ballot option)', async () => {
    await seedRound(flaggedReview([ID.ana, ID.org]));
    await letGo([ID.ana]);
    // No answer, nomination or title record in the batch: the count goes up, her id leaves the
    // let-go list and joins the list again, with no nomination behind it.
    await assertFails(relistLetGo(ana, ID.ana));
  });

  it('demonstration: the book-less option can win, and then the round can never be decided', async () => {
    await seedRound(flaggedReview([ID.ana, ID.org]));
    await letGo([ID.ana]);
    const relisted = await relistLetGo(ana, ID.ana).then(
      () => true,
      () => false,
    );
    if (!relisted) return; // refused: nothing to demonstrate
    // The count says everyone answered: the club's own flow runs, here from Caio's app.
    const db = dbAs(env, caio);
    await startReview(db, CYCLE);
    await recordReview(db, CYCLE, []);
    const options = [ID.bia, ID.org, ID.ana];
    const opening = openingResults(options, {});
    await startVoting(db, { cycleId: CYCLE, options, opening, votingDeadline: null });
    const vote = (persona: Persona, choices: NominationId[]) =>
      castBallot(dbAs(env, persona), { cycleId: CYCLE, uid: persona.uid, choices });
    await vote(ana, [ID.bia, ID.org]);
    await vote(bia, [ID.ana, ID.org]);
    await vote(caio, [ID.ana, ID.bia]);
    await vote(admin, [ID.ana, ID.bia]);
    await closeVoting(db, CYCLE);
    const results = await readResults(db, CYCLE);
    // Tied on votes with Bia's reading, ahead on first choices: the rule's only winner. Its
    // nomination is gone, so no declaration passes and the cycle stays in tallying for good.
    const declared = declareWinner(db, {
      cycleId: CYCLE,
      nominationId: ID.ana,
      book: bookFor(ID.ana),
      method: 'first-choices',
      drawnFrom: [],
      results,
      startReading: true,
    });
    await assertSucceeds(declared);
  });

  it('keeps a let-go member free to answer when the count drops under the answers (a member left)', async () => {
    await seedRound(flaggedReview([ID.ana, ID.org]));
    await letGo([ID.ana]);
    // Caio, who passed, leaves the club; Organizar keeps the count in step with the list.
    await revokeEmail(asAdmin(), caio.email.toLowerCase());
    await setMemberCount(asAdmin(), 3);
    // Three answers stand (Bia's, the organizer's and Caio's), so the count says everyone
    // answered and the club's own flow opens the review, which closes nominations: Ana is
    // locked out, and three days later the flow opens the vote without her.
    await startReview(dbAs(env, bia), CYCLE).catch(() => undefined);
    await assertSucceeds(nominate(ana, 'Vidas Secas'));
  });

  it('held: a let-go member must take exactly her own id off the let-go list', async () => {
    await seedRound(flaggedReview([ID.ana, ID.bia]));
    await letGo([ID.ana, ID.bia]);
    const db = dbAs(env, ana);
    const pass = (cycle: Record<string, unknown>) => {
      const batch = writeBatch(db);
      batch.set(answerRef(db, ana.uid), { nominationId: null });
      batch.update(cycleRef(db), { responses: increment(1), ...cycle });
      return batch.commit();
    };
    await assertFails(pass({}));
    await assertFails(pass({ letGo: arrayRemove(ID.bia) }));
    await assertFails(pass({ letGo: arrayRemove(ID.ana, ID.bia) }));
    await assertSucceeds(pass({ letGo: arrayRemove(ID.ana) }));
    // Answered again: no second answer, and the hidden list closes to her.
    await assertFails(pass({ letGo: arrayRemove(ID.bia) }));
    await assertFails(listAs(ana));
    await assertSucceeds(listAs(bia));
  });

  it('held: members who were not let go get none of its exceptions', async () => {
    const dani: Persona = { uid: 'dani-uid', email: 'dani@example.com' };
    await seedRound({ ...flaggedReview([ID.ana, ID.org]), nominationDeadline: PAST });
    await withoutRules(env, (db) => setDoc(doc(db, 'allowlist', dani.email), { uid: dani.uid }));
    await letGo([ID.ana]);
    // The organizer's reading was flagged but kept; Bia nominated; Caio passed; Dani never answered.
    for (const persona of [admin, bia, caio, dani]) {
      await assertFails(listAs(persona));
      await assertFails(nominate(persona, `Outra de ${persona.uid}`));
    }
    await assertSucceeds(listAs(ana));
    await assertSucceeds(nominate(ana, 'Vidas Secas'));
  });
});

// ---------------------------------------------------------------- the wait

describe('the vote waits for let-go members', () => {
  const options = [ID.bia, ID.org];
  const open = (cycle: Record<string, unknown> = {}) => {
    const db = asAdmin();
    const batch = writeBatch(db);
    batch.update(cycleRef(db), {
      status: 'voting',
      options,
      ballots: 0,
      votingOpenedAt: serverTimestamp(),
      votingDeadline: null,
      ...cycle,
    });
    batch.set(doc(db, 'cycles', CYCLE, 'tally', 'counts'), openingResults(options, {}));
    return batch.commit();
  };

  it('held: the organizer cannot backdate a let-go, or clear the list, to open the vote early', async () => {
    await seedRound(flaggedReview([ID.ana, ID.org]));
    await assertFails(letGoWith([ID.ana], { letGoAt: PAST }));
    await letGo([ID.ana]);
    const db = asAdmin();
    await assertFails(updateDoc(cycleRef(db), { letGoAt: PAST }));
    await assertFails(updateDoc(cycleRef(db), { letGo: [] }));
    await assertFails(updateDoc(cycleRef(db), { nominationDeadline: PAST, letGoAt: PAST }));
    await assertFails(open({ letGo: [] }));
    await assertFails(open({ letGoAt: PAST }));
    await assertFails(open());
  });

  it('held: a round with a let-go member waiting cannot be ended as empty', async () => {
    await seedAllowlist(env);
    await withoutRules(env, async (db) => {
      const cycle = { responses: 4, nominationIds: [ID.ana, ID.org], nominationDeadline: PAST };
      await setDoc(cycleRef(db), cycleData({ ...cycle, ...flaggedReview([ID.ana, ID.org]) }));
      await seedNomination(db, ana, ID.ana);
      await seedNomination(db, admin, ID.org);
      await setDoc(answerRef(db, bia.uid), { nominationId: null });
      await setDoc(answerRef(db, caio.uid), { nominationId: null });
    });
    // Both readings let go at once: nothing listed, the deadline is over, both members away.
    await letGo([ID.ana, ID.org]);
    await assertFails(endEmptyRound(asAdmin(), CYCLE));
    await assertFails(endEmptyRound(dbAs(env, bia), CYCLE));
  });
});

// ------------------------------------------------------------- the flag cap

describe("the round's flags", () => {
  it('held: only a recorded check adds to them, and nothing takes them off', async () => {
    await seedRound({ ...flaggedReview([ID.ana, ID.org]), flagged: [ID.ana, ID.org] });
    const db = asAdmin();
    const dismissAll = { review: { ids: [], groups: [] }, merged: {} };
    await assertFails(updateDoc(cycleRef(db), { ...dismissAll, flagged: [] }));
    await assertFails(letGoWith([ID.ana], { flagged: [] }));
    await assertFails(updateDoc(cycleRef(db), { nominationDeadline: PAST, flagged: [] }));
    await letGo([ID.ana]);
    await nominate(ana, 'Vidas Secas');
    await assertFails(updateDoc(cycleRef(db), { review: { ids: null, groups: [] }, flagged: [] }));
    await startReview(db, CYCLE);
    // Flagging Bia's too would make three of three: over the cap, and the old flags stay.
    const again = flaggedReview([ID.bia, ID.org]);
    await assertFails(updateDoc(cycleRef(db), { ...again, flagged: [ID.org, ID.bia] }));
    await assertFails(recordReview(db, CYCLE, again.review.groups));
  });
});

// ---------------------------------------------------------- dropping a round

describe('dropping a round', () => {
  it('cannot drop a round once every answer in it was let go (the answers outlive it)', async () => {
    // A club of two, who nominated the same reading; the organizer lets both go at once.
    await withoutRules(env, async (db) => {
      await setDoc(doc(db, 'allowlist', admin.email), { admin: true, uid: admin.uid });
      await setDoc(doc(db, 'allowlist', ana.email), { uid: ana.uid });
      await setDoc(doc(db, 'settings', 'club'), { members: 2 });
      const cycle = { responses: 2, nominationIds: [ID.ana, ID.org] };
      await setDoc(cycleRef(db), cycleData({ ...cycle, ...flaggedReview([ID.ana, ID.org]) }));
      await seedNomination(db, ana, ID.ana);
      await seedNomination(db, admin, ID.org);
    });
    await letGo([ID.ana, ID.org]);
    // The count is back to zero and the list is empty, but both answers are still stored: a
    // re-created ciclo-1 would find them and never let these members answer.
    await assertFails(deleteCycle(asAdmin(), CYCLE));
  });
});

// ------------------------------------------------------------------ budget

describe('the expression budget at the largest round, with the new checks', () => {
  const OPTIONS = Array.from(
    { length: MAX_OPTIONS },
    (_, i): NominationId => `Reading${String(i).padStart(13, '0')}`,
  );
  const at = (i: number): NominationId => OPTIONS[i] ?? '';

  /** The last `count` of `ids` merged, in turn, into the first ones that stay. */
  function mergesOf(ids: readonly NominationId[], count: number): Merged {
    const kept = ids.length - count;
    return Object.fromEntries(
      ids.slice(kept).map((id, index) => [id, ids[index % Math.min(kept, count)] ?? '']),
    );
  }

  async function seedLargest(cycle: Record<string, unknown>) {
    await seedAllowlist(env);
    await withoutRules(env, (db) =>
      setDoc(cycleRef(db), cycleData({ nominationIds: OPTIONS, responses: MAX_OPTIONS, ...cycle })),
    );
  }

  const nextWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  it('held: the organizer opens the vote with a deadline after a clear check, every merge used', async () => {
    // A clear check makes the vote a flow step too, so the rules check the opening twice.
    const merged = mergesOf(OPTIONS, MAX_MERGED);
    await seedLargest({ review: { ids: [], groups: [] }, merged });
    const options = ballotOptions(OPTIONS, merged);
    const opening = openingResults(options, merged);
    await assertSucceeds(
      startVoting(asAdmin(), { cycleId: CYCLE, options, opening, votingDeadline: nextWeek() }),
    );
  });

  it('held: the organizer opens the vote three days after a let-go, every merge used', async () => {
    const listed = OPTIONS.slice(0, MAX_OPTIONS - 1);
    const merged = mergesOf(listed, MAX_MERGED);
    await seedLargest({
      nominationIds: listed,
      responses: MAX_OPTIONS - 1,
      merged,
      letGo: [at(MAX_OPTIONS - 1)],
      letGoAt: PAST,
    });
    const options = ballotOptions(listed, merged);
    const opening = openingResults(options, merged);
    await assertSucceeds(
      startVoting(asAdmin(), { cycleId: CYCLE, options, opening, votingDeadline: nextWeek() }),
    );
  });

  it('held: the organizer records the most flags a check may hold', async () => {
    await seedLargest({ review: { ids: null, groups: [] } });
    const groups = [
      { ids: [at(0), at(1), at(2)], reason: 'r'.repeat(200) },
      { ids: [at(3), at(4), at(5)], reason: 'r'.repeat(200) },
      { ids: [at(6), at(7)], reason: 'r'.repeat(200) },
    ];
    await assertSucceeds(recordReview(asAdmin(), CYCLE, groups));
  });

  it('held: the organizer merges three readings into one, reaching the most merges', async () => {
    // Readings 10 to 15 already merged into 0 to 5; 6 to 8 are the same work, and so are 3 to 5.
    const earlier = mergesOf(OPTIONS, MAX_MERGED - 2);
    const group = [at(6), at(7), at(8)];
    const rest = [at(3), at(4), at(5)];
    const reviewed = {
      ids: [...group, ...rest],
      groups: [
        { ids: group, reason: 'A mesma obra.' },
        { ids: rest, reason: 'A mesma obra.' },
      ],
    };
    await seedLargest({ review: reviewed, merged: earlier });
    const merged = { ...earlier, [at(7)]: at(6), [at(8)]: at(6) };
    await assertSucceeds(
      updateReview(asAdmin(), { cycleId: CYCLE, groups: reviewed.groups.slice(1), merged }),
    );
  });
});
