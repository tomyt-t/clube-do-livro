import { describe, expect, it } from 'vitest';

import type { Nomination } from '@/domain/types';
import { answerAs, emptyClub, firstValue, voteAs } from '@/test/backend';
import { makeBook } from '@/test/factories';

import { BackendError } from '../backend';

import { createDemoBackend } from '.';

const denied = { code: 'permission-denied' };

describe('demo access', () => {
  it('lets allowlisted members in, case-insensitively, and keeps outsiders out', async () => {
    const { auth } = createDemoBackend();
    const member = { uid: 'rafa', email: 'Rafa@Example.com', name: 'Rafa', photoURL: null };
    const outsider = { ...member, uid: 'visitante', email: 'visitante@example.com' };

    expect(await auth.checkAccess(member)).toEqual({ status: 'member', isAdmin: false });
    expect(await auth.checkAccess(outsider)).toEqual({ status: 'denied' });
  });

  it('restores and clears the session', async () => {
    const { auth } = createDemoBackend();
    const seen: (string | null)[] = [];
    const unsubscribe = auth.watchUser((user) => seen.push(user?.uid ?? null));
    await auth.signInWithGoogle();
    await auth.signOut();
    await Promise.resolve();
    unsubscribe();
    expect(seen).toEqual([null, 'marina', null]);
  });

  it('reserves organizer actions to the admin', async () => {
    const backend = createDemoBackend();
    backend.auth.signInAs('rafa');
    await expect(
      backend.admin.openCycle({ number: 9, nominationDeadline: null }),
    ).rejects.toMatchObject(denied);
  });
});

describe('demo nominations', () => {
  it('makes answers final and personal', async () => {
    const backend = emptyClub();
    const cycleId = await backend.admin.openCycle({ number: 1, nominationDeadline: null });
    await answerAs(backend, cycleId, 'rafa');

    await expect(answerAs(backend, cycleId, 'rafa', null)).rejects.toMatchObject(denied);
    backend.auth.signInAs('rafa');
    await expect(
      backend.club.answerNominationCall({ cycleId, uid: 'julia', answer: { kind: 'pass' } }),
    ).rejects.toBeInstanceOf(BackendError);
  });

  it('never records who nominated a book', async () => {
    const backend = emptyClub();
    const cycleId = await backend.admin.openCycle({ number: 1, nominationDeadline: null });
    await answerAs(backend, cycleId, 'rafa', makeBook({ title: 'Torto Arado' }));

    const [nomination] = await firstValue<Nomination[]>((s) =>
      backend.club.watchNominations(cycleId, s),
    );
    expect(Object.keys(nomination ?? {}).sort()).toEqual(['book', 'id']);
    expect(nomination?.id).not.toContain('rafa');
  });

  it('rejects invalid books', async () => {
    const backend = emptyClub();
    const cycleId = await backend.admin.openCycle({ number: 1, nominationDeadline: null });
    await expect(
      answerAs(backend, cycleId, 'rafa', makeBook({ synopsisUrl: 'javascript:alert(1)' })),
    ).rejects.toMatchObject({ code: 'invalid-data' });
  });
});

describe('demo ballots', () => {
  async function votingCycle() {
    const backend = emptyClub();
    const cycleId = await backend.admin.openCycle({ number: 1, nominationDeadline: null });
    const rafa = `${await answerAs(backend, cycleId, 'rafa')}`;
    const julia = `${await answerAs(backend, cycleId, 'julia')}`;
    const teo = `${await answerAs(backend, cycleId, 'teo')}`;
    await backend.admin.openRound({
      cycleId,
      number: 1,
      kind: 'first',
      options: [rafa, julia, teo],
      votingDeadline: null,
    });
    return { backend, cycleId, rafa, julia, teo };
  }

  it('blocks voting for your own book and voting twice', async () => {
    const { backend, cycleId, rafa, julia, teo } = await votingCycle();
    const ballot = { cycleId, round: 1, uid: 'rafa' };

    await expect(voteAs(backend, { ...ballot, choices: [rafa, julia] })).rejects.toMatchObject(
      denied,
    );
    await voteAs(backend, { ...ballot, choices: [julia, teo] });
    await expect(voteAs(backend, { ...ballot, choices: [julia, teo] })).rejects.toMatchObject(
      denied,
    );
  });

  it('tells members whether they already voted', async () => {
    const { backend, cycleId, julia, teo } = await votingCycle();
    await voteAs(backend, { cycleId, round: 1, uid: 'rafa', choices: [julia, teo] });

    const voted = await firstValue<boolean>((s) =>
      backend.club.watchHasVoted(cycleId, 1, 'rafa', s),
    );
    const notYet = await firstValue<boolean>((s) =>
      backend.club.watchHasVoted(cycleId, 1, 'lia', s),
    );
    expect([voted, notYet]).toEqual([true, false]);
  });

  it('closes voting with the round', async () => {
    const { backend, cycleId, julia, teo } = await votingCycle();
    await backend.admin.closeRound(cycleId, 1);
    await expect(
      voteAs(backend, { cycleId, round: 1, uid: 'lia', choices: [julia, teo] }),
    ).rejects.toMatchObject(denied);
  });
});
