import { describe, expect, it } from 'vitest';

import { openingResults } from '@/domain/review';
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

  it('announces the session only when it changes, like Firebase', async () => {
    const backend = createDemoBackend();
    backend.auth.signInAs('rafa');
    const seen: (string | null)[] = [];
    const unsubscribe = backend.auth.watchUser((user) => seen.push(user?.uid ?? null));
    await Promise.resolve();
    await backend.club.saveProfile({ uid: 'rafa', name: 'Rafa', photoURL: null });
    await Promise.resolve();
    unsubscribe();
    expect(seen).toEqual(['rafa']);
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
    const id = `${await answerAs(backend, cycleId, 'rafa', makeBook({ title: 'Torto Arado' }))}`;
    await backend.flow.startVoting({
      cycleId,
      options: [id],
      opening: openingResults([id], {}),
      votingDeadline: null,
    });

    const [nomination] = await firstValue<Nomination[]>((s) =>
      backend.club.watchNominations(cycleId, s),
    );
    expect(Object.keys(nomination ?? {}).sort()).toEqual(['book', 'id']);
    expect(nomination?.id).not.toContain('rafa');
  });

  it('hides the nominations from everyone else until the vote opens', async () => {
    const backend = emptyClub();
    const cycleId = await backend.admin.openCycle({ number: 1, nominationDeadline: null });
    const id = `${await answerAs(backend, cycleId, 'rafa')}`;
    const ownAs = (uid: string) => {
      backend.auth.signInAs(uid);
      return firstValue<Nomination | null>((s) => backend.club.watchOwnNomination(cycleId, id, s));
    };

    await expect(
      firstValue<Nomination[]>((s) => backend.club.watchNominations(cycleId, s)),
    ).rejects.toMatchObject(denied);
    await expect(ownAs('julia')).rejects.toMatchObject(denied);
    expect((await ownAs('rafa'))?.id).toBe(id);

    backend.auth.signInAs('marina');
    await backend.flow.startVoting({
      cycleId,
      options: [id],
      opening: openingResults([id], {}),
      votingDeadline: null,
    });
    expect((await ownAs('julia'))?.id).toBe(id);
  });

  it('takes a reading nominated twice: the check after the call sorts it out', async () => {
    const backend = emptyClub();
    const cycleId = await backend.admin.openCycle({ number: 1, nominationDeadline: null });
    await answerAs(backend, cycleId, 'rafa', makeBook({ title: 'Dom Casmurro, Machado de Assis' }));
    await answerAs(
      backend,
      cycleId,
      'julia',
      makeBook({ title: 'DOM CASMURRO — Machado de Assis' }),
    );
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
    await backend.flow.startVoting({
      cycleId,
      options: [rafa, julia, teo],
      opening: openingResults([rafa, julia, teo], {}),
      votingDeadline: null,
    });
    return { backend, cycleId, rafa, julia, teo };
  }

  it('blocks voting for your own book and voting twice', async () => {
    const { backend, cycleId, rafa, julia, teo } = await votingCycle();
    const ballot = { cycleId, uid: 'rafa' };

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
    await voteAs(backend, { cycleId, uid: 'rafa', choices: [julia, teo] });

    const voted = await firstValue<boolean>((s) => backend.club.watchHasVoted(cycleId, 'rafa', s));
    const notYet = await firstValue<boolean>((s) => backend.club.watchHasVoted(cycleId, 'lia', s));
    expect([voted, notYet]).toEqual([true, false]);
  });

  it('counts every choice as a vote and the first one also as a first choice', async () => {
    const { backend, cycleId, rafa, julia, teo } = await votingCycle();
    await voteAs(backend, { cycleId, uid: 'lia', choices: [teo, rafa] });
    await voteAs(backend, { cycleId, uid: 'bruno', choices: [julia, teo] });
    await backend.flow.closeVoting(cycleId);

    expect(await backend.flow.readResults(cycleId)).toEqual({
      votes: { [rafa]: 1, [julia]: 1, [teo]: 2 },
      firsts: { [rafa]: 0, [julia]: 1, [teo]: 1 },
    });
  });

  it('keeps the tally sealed until voting closes', async () => {
    const { backend, cycleId } = await votingCycle();
    await expect(backend.flow.readResults(cycleId)).rejects.toMatchObject(denied);
  });

  it('stops accepting ballots once voting closes', async () => {
    const { backend, cycleId, julia, teo } = await votingCycle();
    await backend.flow.closeVoting(cycleId);
    await expect(
      voteAs(backend, { cycleId, uid: 'lia', choices: [julia, teo] }),
    ).rejects.toMatchObject(denied);
  });
});
