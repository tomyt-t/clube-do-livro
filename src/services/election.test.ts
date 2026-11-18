import { describe, expect, it } from 'vitest';

import type { Cycle } from '@/domain/types';
import { answerAs, electionContext, emptyClub, firstValue, voteAs } from '@/test/backend';

import type { DemoBackend } from './demo';
import {
  ElectionError,
  finishCurrentReading,
  openNominations,
  startVoting,
  tallyVotes,
} from './election';

async function cyclesOf(backend: DemoBackend) {
  return firstValue<Cycle[]>((s) => backend.club.watchCycles(s));
}

async function cycleOf(backend: DemoBackend, cycleId: string) {
  return (await cyclesOf(backend)).find((cycle) => cycle.id === cycleId);
}

/** Opens a cycle where rafa, julia and teo nominate and lia passes. */
async function nominatedCycle(backend: DemoBackend) {
  const cycleId = await openNominations(backend.admin, await cyclesOf(backend), null);
  const rafa = await answerAs(backend, cycleId, 'rafa');
  const julia = await answerAs(backend, cycleId, 'julia');
  const teo = await answerAs(backend, cycleId, 'teo');
  await answerAs(backend, cycleId, 'lia', null);
  return { cycleId, rafa: `${rafa}`, julia: `${julia}`, teo: `${teo}` };
}

describe('openNominations', () => {
  it('numbers cycles and refuses a second open election', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    expect((await cycleOf(backend, cycleId))?.number).toBe(1);

    await expect(openNominations(backend.admin, await cyclesOf(backend), null)).rejects.toThrow(
      ElectionError,
    );
  });
});

describe('startVoting', () => {
  it('needs at least one nomination', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    await expect(
      startVoting(backend.admin, await electionContext(backend, cycleId), null),
    ).rejects.toMatchObject({ code: 'no-nominations' });
  });

  it('declares a single nomination the winner right away', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    const only = await answerAs(backend, cycleId, 'rafa');

    const resolution = await startVoting(
      backend.admin,
      await electionContext(backend, cycleId),
      null,
    );

    expect(resolution).toEqual({ nominationId: only, method: 'unopposed', drawnFrom: [] });
    expect((await cycleOf(backend, cycleId))?.status).toBe('reading');
  });
});

describe('tallyVotes', () => {
  async function votingCycle() {
    const backend = emptyClub();
    const ids = await nominatedCycle(backend);
    await startVoting(backend.admin, await electionContext(backend, ids.cycleId), null);
    const vote = (uid: string, choices: string[]) =>
      voteAs(backend, { cycleId: ids.cycleId, uid, choices });
    const tally = async (random?: () => number) =>
      tallyVotes(backend.admin, await electionContext(backend, ids.cycleId), random);
    return { backend, ...ids, vote, tally };
  }

  it('declares the most votes, even with fewer first choices', async () => {
    const { backend, cycleId, rafa, julia, teo, vote, tally } = await votingCycle();
    await vote('lia', [julia, rafa]);
    await vote('bruno', [julia, rafa]);
    await vote('teo', [julia, rafa]);
    await vote('julia', [teo, rafa]);

    expect(await tally()).toEqual({ nominationId: rafa, method: 'votes', drawnFrom: [] });
    const cycle = await cycleOf(backend, cycleId);
    expect(cycle?.status).toBe('reading');
    expect(cycle?.winner?.book.title).toBe('Livro de rafa');
    expect(cycle?.results?.votes).toEqual({ [rafa]: 4, [julia]: 3, [teo]: 1 });
  });

  it('breaks a tie by first choices', async () => {
    const { rafa, julia, vote, tally } = await votingCycle();
    await vote('lia', [rafa, julia]);
    await vote('bruno', [julia, rafa]);
    await vote('teo', [rafa, julia]);

    expect(await tally()).toEqual({ nominationId: rafa, method: 'first-choices', drawnFrom: [] });
  });

  it('draws among the books still tied', async () => {
    const { backend, cycleId, rafa, julia, vote, tally } = await votingCycle();
    await vote('lia', [rafa, julia]);
    await vote('bruno', [julia, rafa]);

    expect(await tally(() => 0.99)).toEqual({
      nominationId: julia,
      method: 'draw',
      drawnFrom: [rafa, julia],
    });
    expect((await cycleOf(backend, cycleId))?.winner?.method).toBe('draw');
  });

  it('picks up where a previous attempt stopped', async () => {
    const { backend, cycleId, rafa, julia, vote, tally } = await votingCycle();
    await vote('lia', [rafa, julia]);
    // A previous attempt closed voting, then failed before declaring.
    await backend.admin.closeVoting(cycleId);

    expect((await tally()).nominationId).toBe(rafa);
  });

  it('only counts a cycle that is voting', async () => {
    const backend = emptyClub();
    const { cycleId } = await nominatedCycle(backend);
    await expect(
      tallyVotes(backend.admin, await electionContext(backend, cycleId)),
    ).rejects.toMatchObject({ code: 'not-voting' });
  });
});

describe('reading queue', () => {
  it('queues a book decided while another is read, and starts it after', async () => {
    const backend = emptyClub();
    const firstId = await openNominations(backend.admin, [], null);
    await answerAs(backend, firstId, 'rafa');
    await startVoting(backend.admin, await electionContext(backend, firstId), null);

    const secondId = await openNominations(backend.admin, await cyclesOf(backend), null);
    await answerAs(backend, secondId, 'julia');
    await startVoting(backend.admin, await electionContext(backend, secondId), null);
    expect((await cycleOf(backend, secondId))?.status).toBe('upcoming');

    await finishCurrentReading(backend.admin, await cyclesOf(backend));
    expect((await cycleOf(backend, firstId))?.status).toBe('finished');
    expect((await cycleOf(backend, secondId))?.status).toBe('reading');
  });

  it('has nothing to finish when no book is being read', async () => {
    const backend = emptyClub();
    await expect(finishCurrentReading(backend.admin, [])).rejects.toMatchObject({
      code: 'nothing-to-finish',
    });
  });
});
