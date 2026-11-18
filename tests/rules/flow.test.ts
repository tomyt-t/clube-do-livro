import { assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { drawWinner } from '@/domain/draw';
import { decideRound, nextStep } from '@/domain/tally';
import type { Book, NominationId } from '@/domain/types';
import {
  closeRound,
  declareWinner,
  enterTiebreak,
  openCycle,
  openRound,
  recordResults,
} from '@/services/firebase/admin-writes';
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
 * a tied first round, a tied runoff and the draw.
 */
it('runs a full cycle from nominations to the draw', async () => {
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
  await openRound(adminDb, { cycleId, number: 1, kind: 'first', options, votingDeadline: null });

  const vote = (persona: Persona, round: number, choices: NominationId[]) =>
    castBallot(dbAs(env, persona), { cycleId, round, uid: persona.uid, choices });

  await vote(ana, 1, [fromBia, fromAdmin]);
  await vote(bia, 1, [fromAna, fromAdmin]);
  await vote(caio, 1, [fromBia, fromAdmin]);
  await vote(admin, 1, [fromAna, fromBia]);

  await closeRound(adminDb, cycleId, 1);
  const firstResults = await recordResults(adminDb, cycleId, 1);
  expect(firstResults).toEqual({ [fromAna]: 2, [fromBia]: 3, [fromAdmin]: 3 });

  const afterFirst = nextStep('first', decideRound(options, firstResults));
  expect(afterFirst).toEqual({ kind: 'open-runoff', options: [fromBia, fromAdmin] });
  if (afterFirst.kind !== 'open-runoff') return;

  await openRound(adminDb, {
    cycleId,
    number: 2,
    kind: 'runoff',
    options: afterFirst.options,
    votingDeadline: null,
  });
  await vote(ana, 2, [fromBia]);
  await vote(bia, 2, [fromBia]);
  await vote(caio, 2, [fromAdmin]);
  await vote(admin, 2, [fromAdmin]);

  await closeRound(adminDb, cycleId, 2);
  const runoffResults = await recordResults(adminDb, cycleId, 2);
  const afterRunoff = nextStep('runoff', decideRound(afterFirst.options, runoffResults));
  expect(afterRunoff).toEqual({ kind: 'draw', candidates: [fromBia, fromAdmin] });
  if (afterRunoff.kind !== 'draw') return;

  await enterTiebreak(adminDb, cycleId);
  const winner = drawWinner(afterRunoff.candidates);
  const nomination = await getDoc(doc(adminDb, 'cycles', cycleId, 'nominations', winner));
  await assertSucceeds(
    declareWinner(adminDb, {
      cycleId,
      nominationId: winner,
      book: nomination.get('book') as Book,
      method: 'draw',
      startReading: true,
    }),
  );

  const cycle = await getDoc(doc(dbAs(env, caio), 'cycles', cycleId));
  expect(cycle.get('status')).toBe('reading');
  expect(cycle.get('winner.nominationId')).toBe(winner);
});
