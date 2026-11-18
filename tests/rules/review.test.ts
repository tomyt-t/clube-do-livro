import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openingResults, type ConflictGroup, type Merged } from '@/domain/review';
import type { NominationId, VoteResults } from '@/domain/types';
import { recordReview, startReview, startVoting } from '@/services/firebase/flow-writes';
import { answerNominationCall, castBallot } from '@/services/firebase/member-writes';
import { findNominators, reopenNominations, updateReview } from '@/services/firebase/review-writes';
import { makeBook } from '@/test/factories';

import {
  admin,
  ALL_NOMINATIONS,
  ana,
  bia,
  caio,
  createEnv,
  CYCLE,
  dbAs,
  N_ADMIN,
  N_ANA,
  N_BIA,
  seedAnswered,
  seedVoting,
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
});

const FLAGGED: ConflictGroup[] = [{ ids: [N_ANA, N_BIA], reason: 'A mesma obra.' }];
const flaggedReview = { review: { ids: [N_ANA, N_BIA], groups: FLAGGED } };

const nominationAs = (persona: Persona, id: NominationId) =>
  getDoc(doc(dbAs(env, persona), 'cycles', CYCLE, 'nominations', id));
const answerAs = (persona: Persona, uid: string) =>
  getDoc(doc(dbAs(env, persona), 'cycles', CYCLE, 'answers', uid));

async function seedProfiles() {
  await withoutRules(env, async (db) => {
    for (const persona of [admin, ana, bia, caio]) {
      await setDoc(doc(db, 'members', persona.uid), { name: persona.uid, photoURL: null });
    }
  });
}

describe('the list during the review', () => {
  it('stays hidden until everyone answered, then shows to every member', async () => {
    await seedAnswered(env);
    await assertFails(nominationAs(bia, N_ANA));
    await assertFails(getDocs(collection(dbAs(env, admin), 'cycles', CYCLE, 'nominations')));

    await startReview(dbAs(env, caio), CYCLE);
    await assertSucceeds(nominationAs(bia, N_ANA));
    await assertFails(nominationAs(stranger, N_ANA));
  });

  it('takes no more nominations once the review started', async () => {
    await seedAnswered(env, { responses: 3, review: { ids: null, groups: [] } });
    const late = answerNominationCall(dbAs(env, caio), {
      cycleId: CYCLE,
      uid: caio.uid,
      answer: { kind: 'nominate', book: makeBook({ title: 'Atrasado' }) },
    });
    await assertFails(late);
  });

  it('records only real nominations, once, and only after it started', async () => {
    await seedAnswered(env);
    const db = dbAs(env, admin);
    await assertFails(recordReview(db, CYCLE, FLAGGED, {}));
    await startReview(db, CYCLE);
    await assertFails(recordReview(db, CYCLE, [{ ids: [N_ANA, 'made-up'], reason: '' }], {}));
    await assertSucceeds(recordReview(db, CYCLE, FLAGGED, {}));
    // Once recorded, a member cannot wipe it (the organizer dismissing every group is an edit).
    await assertFails(recordReview(dbAs(env, caio), CYCLE, [], {}));
  });

  it('merges the same work on its own, always a later nomination into an earlier one', async () => {
    await seedAnswered(env, { review: { ids: null, groups: [] } });
    const db = dbAs(env, caio);
    // Bia's (later) into Ana's (first), never the other way, nor a flagged one.
    await assertFails(recordReview(db, CYCLE, [], { [N_ANA]: N_BIA }));
    await assertFails(recordReview(db, CYCLE, FLAGGED, { [N_BIA]: N_ANA }));
    await assertSucceeds(recordReview(db, CYCLE, [], { [N_BIA]: N_ANA }));
  });

  it('never merges more than four at once', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `Reading${String(i).padStart(13, '0')}`);
    await seedAnswered(env, {
      nominationIds: ids,
      responses: 10,
      review: { ids: null, groups: [] },
    });
    const into = (n: number) =>
      Object.fromEntries(ids.slice(1, n + 1).map((id) => [id, ids[0] ?? '']));
    const db = dbAs(env, caio);
    await assertFails(recordReview(db, CYCLE, [], into(5)));
    await assertSucceeds(recordReview(db, CYCLE, [], into(4)));
  });

  it("lets any member's device record what the check found, flags included", async () => {
    await seedAnswered(env, { review: { ids: null, groups: [] } });
    await assertSucceeds(recordReview(dbAs(env, caio), CYCLE, FLAGGED, {}));
    await assertFails(recordReview(dbAs(env, caio), CYCLE, [], {}));
  });

  it('starts only once everyone answered, even for the organizer', async () => {
    await seedAnswered(env, { responses: 3 });
    await assertFails(startReview(dbAs(env, admin), CYCLE));
  });

  it('never flags in big groups, overlapping groups or most of the list', async () => {
    await seedAnswered(env, { review: { ids: null, groups: [] } });
    const db = dbAs(env, admin);
    const record = (groups: ConflictGroup[]) => recordReview(db, CYCLE, groups, {});
    await assertFails(record([{ ids: ALL_NOMINATIONS, reason: '' }]));
    await assertFails(
      record([
        { ids: [N_ANA, N_BIA], reason: '' },
        { ids: [N_BIA, N_ADMIN], reason: '' },
      ]),
    );
    await assertFails(record([{ ids: [N_ANA, N_BIA], reason: 'x'.repeat(201) }]));
    await assertSucceeds(record([{ ids: [N_ANA, N_BIA], reason: 'x'.repeat(200) }]));
  });
});

describe('sorting out flagged readings', () => {
  const update = (persona: Persona, groups: ConflictGroup[], merged: Merged) =>
    updateReview(dbAs(env, persona), { cycleId: CYCLE, groups, merged });

  it('is up to the organizer alone once the check is recorded', async () => {
    // Recording the check may merge on its own, but only a later nomination into an earlier one.
    await seedAnswered(env, { review: { ids: null, groups: [] } });
    await assertFails(update(admin, [], { [N_ANA]: N_BIA }));
    await seedAnswered(env, flaggedReview);
    await assertFails(update(ana, [], {}));
    await assertSucceeds(update(admin, [], {}));
  });

  it('merges only nominations into others that stay, never in chains', async () => {
    await seedAnswered(env, flaggedReview);
    await assertFails(update(admin, [], { [N_BIA]: 'made-up' }));
    await assertFails(update(admin, [], { [N_ADMIN]: N_ANA }));
    await assertFails(update(admin, FLAGGED, { [N_BIA]: N_ANA }));
    await assertFails(update(admin, [], { [N_BIA]: N_ANA, [N_ANA]: N_ADMIN }));
    await assertFails(update(admin, [], { [N_ANA]: N_ANA }));
    await assertSucceeds(update(admin, [], { [N_BIA]: N_ANA }));
  });

  it('shows the organizer who nominated flagged readings, and nothing else', async () => {
    await seedAnswered(env, flaggedReview);
    await seedProfiles();
    await assertSucceeds(answerAs(admin, ana.uid));
    await assertFails(answerAs(admin, caio.uid));
    await assertFails(answerAs(ana, bia.uid));

    const found = await findNominators(dbAs(env, admin), CYCLE, [N_ANA, N_BIA]);
    expect(found).toEqual({ [N_ANA]: [ana.uid], [N_BIA]: [bia.uid] });

    await seedAnswered(env, { review: { ids: [], groups: [] } });
    await assertFails(answerAs(admin, ana.uid));
  });

  it('lets the organizer let go only flagged nominations, and only their members answer again', async () => {
    await seedAnswered(env, flaggedReview);
    const reopen = (persona: Persona, nominationId: NominationId) =>
      reopenNominations(dbAs(env, persona), { cycleId: CYCLE, nominationIds: [nominationId] });
    const answerAgain = (persona: Persona, title: string) =>
      answerNominationCall(dbAs(env, persona), {
        cycleId: CYCLE,
        uid: persona.uid,
        answer: { kind: 'nominate', book: makeBook({ title }) },
      });

    await assertFails(reopen(ana, N_ANA));
    await assertFails(reopen(admin, N_ADMIN));
    await assertSucceeds(reopen(admin, N_ANA));

    // Bia's and Caio's answers still stand; Ana's was let go.
    await assertFails(answerAgain(bia, 'Outra leitura'));
    await assertFails(answerAgain(caio, 'Outra leitura'));
    await assertSucceeds(answerAgain(ana, 'Outra leitura'));
    await assertFails(answerAgain(ana, 'Mais uma'));
  });

  it('never lets anyone else delete an answer or a nomination', async () => {
    await seedAnswered(env, flaggedReview);
    const db = dbAs(env, ana);
    await assertFails(
      updateDoc(doc(db, 'cycles', CYCLE), { review: null, responses: 3, nominationIds: [N_BIA] }),
    );
  });
});

describe('a ballot with merged readings', () => {
  // Bia's nomination was merged into Ana's: one option, two nominators.
  const merged: Merged = { [N_BIA]: N_ANA };
  const options = [N_ANA, N_ADMIN];

  const open = (opening: VoteResults, ballot: NominationId[] = options) =>
    startVoting(dbAs(env, caio), {
      cycleId: CYCLE,
      options: ballot,
      opening,
      votingDeadline: null,
    });

  it('opens with the merged reading ahead, and nothing else', async () => {
    await seedAnswered(env, { review: { ids: [], groups: [] }, merged });
    await assertFails(open(openingResults(options, {})));
    await assertFails(
      open({ votes: { [N_ANA]: 3, [N_ADMIN]: 0 }, firsts: { [N_ANA]: 3, [N_ADMIN]: 0 } }),
    );
    await assertFails(
      open({ votes: { [N_ANA]: 2, [N_ADMIN]: 1 }, firsts: { [N_ANA]: 2, [N_ADMIN]: 1 } }),
    );
    await assertFails(
      open({ votes: { [N_ANA]: 2, [N_ADMIN]: 0 }, firsts: { [N_ANA]: 0, [N_ADMIN]: 0 } }),
    );
    await assertFails(open(openingResults(ALL_NOMINATIONS, merged), ALL_NOMINATIONS));
    await assertSucceeds(open(openingResults(options, merged)));
  });

  it("never lets the organizer leave someone's nomination off the ballot", async () => {
    await seedAnswered(env, { review: { ids: [], groups: [] } });
    const partial = [N_ANA, N_BIA];
    await assertFails(
      startVoting(dbAs(env, admin), {
        cycleId: CYCLE,
        options: partial,
        opening: openingResults(partial, {}),
        votingDeadline: null,
      }),
    );
  });

  it('lets the first nominator vote as usual, and later ones pick one without a first choice', async () => {
    const start = openingResults(options, merged);
    await seedVoting(env, { options, votes: start.votes, firsts: start.firsts, cycle: { merged } });
    const vote = (persona: Persona, choices: NominationId[], countsFirst: boolean) =>
      castBallot(dbAs(env, persona), { cycleId: CYCLE, uid: persona.uid, choices, countsFirst });

    // Ana nominated it first: as usual, never for it (here one other book, as first choice).
    await assertFails(vote(ana, [N_ANA], true));
    await assertFails(vote(ana, [N_ADMIN], false));
    await assertSucceeds(vote(ana, [N_ADMIN], true));
    // Bia's came later: it already counts as her first choice.
    await assertFails(vote(bia, [N_ANA], false));
    await assertFails(vote(bia, [N_ADMIN], true));
    await assertSucceeds(vote(bia, [N_ADMIN], false));
    await assertFails(vote(caio, [N_ADMIN], false));
    await assertSucceeds(vote(caio, [N_ADMIN, N_ANA], true));
  });
});
