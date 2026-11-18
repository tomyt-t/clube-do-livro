import { assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, type Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { decide } from '@/domain/tally';
import type { Book, NominationId } from '@/domain/types';
import { openCycle } from '@/services/firebase/admin-writes';
import {
  closeVoting,
  declareWinner,
  readResults,
  startVoting,
} from '@/services/firebase/flow-writes';
import { answerNominationCall, castBallot } from '@/services/firebase/member-writes';
import { makeBook } from '@/test/factories';

import { admin, ana, bia, caio, createEnv, dbAs, seedAllowlist, type Persona } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedAllowlist(env);
});

/**
 * One whole cycle through the same writes the app makes: nominations,
 * ranked ballots, a tie on votes broken by first choices.
 */
it('runs a full cycle from nominations to the winner', async () => {
  const adminDb = dbAs(env, admin);
  const cycleId = await assertSucceeds(openCycle(adminDb, { number: 1, nominationDeadline: null }));

  const nominate = async (persona: Persona, title: string): Promise<NominationId> => {
    const nominationId = await answerNominationCall(dbAs(env, persona), {
      cycleId,
      uid: persona.uid,
      answer: { kind: 'nominate', book: makeBook({ title }) },
    });
    if (nominationId === null) throw new Error('Expected a nomination id.');
    return nominationId;
  };

  const fromAna = await nominate(ana, 'Torto Arado');
  const fromBia = await nominate(bia, 'Dom Casmurro');
  const fromAdmin = await nominate(admin, 'A Hora da Estrela');
  await answerNominationCall(dbAs(env, caio), { cycleId, uid: caio.uid, answer: { kind: 'pass' } });

  const options = [fromAna, fromBia, fromAdmin];
  await assertSucceeds(startVoting(adminDb, { cycleId, options, votingDeadline: null }));

  const vote = (persona: Persona, choices: NominationId[]) =>
    assertSucceeds(castBallot(dbAs(env, persona), { cycleId, uid: persona.uid, choices }));

  await vote(ana, [fromBia, fromAdmin]);
  await vote(bia, [fromAdmin, fromAna]);
  await vote(caio, [fromBia, fromAna]);
  await vote(admin, [fromAna, fromBia]);

  await assertSucceeds(closeVoting(adminDb, cycleId));
  const results = await assertSucceeds(readResults(adminDb, cycleId));
  expect(results).toEqual({
    votes: { [fromAna]: 3, [fromBia]: 3, [fromAdmin]: 2 },
    firsts: { [fromAna]: 1, [fromBia]: 2, [fromAdmin]: 1 },
  });

  const closed = await getDoc(doc(adminDb, 'cycles', cycleId));
  const closedAt = closed.get('votingClosedAt') as Timestamp;
  const decision = decide(options, results, closedAt.toMillis());
  expect(decision).toEqual({ nominationId: fromBia, method: 'first-choices', drawnFrom: [] });

  const nomination = await getDoc(doc(adminDb, 'cycles', cycleId, 'nominations', fromBia));
  await assertSucceeds(
    declareWinner(adminDb, {
      cycleId,
      nominationId: fromBia,
      book: nomination.get('book') as Book,
      method: decision.method,
      drawnFrom: decision.drawnFrom,
      results,
      startReading: true,
    }),
  );

  const cycle = await getDoc(doc(dbAs(env, caio), 'cycles', cycleId));
  expect(cycle.get('status')).toBe('reading');
  expect(cycle.get('winner.nominationId')).toBe(fromBia);
  expect(cycle.get('results')).toEqual(results);
});
