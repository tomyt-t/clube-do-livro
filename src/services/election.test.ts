import { describe, expect, it } from 'vitest';

import type { Cycle } from '@/domain/types';
import { answerAs, electionContext, emptyClub, firstValue, voteAs } from '@/test/backend';

import type { DemoBackend } from './demo';
import {
  drawTiebreak,
  ElectionError,
  finishCurrentReading,
  openNominations,
  startVoting,
  tallyCurrentRound,
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

    expect(resolution).toEqual({ kind: 'winner', nominationId: only, method: 'unopposed' });
    expect((await cycleOf(backend, cycleId))?.status).toBe('reading');
  });
});

describe('tallyCurrentRound', () => {
  it('declares the book with the most votes', async () => {
    const backend = emptyClub();
    const { cycleId, rafa, julia, teo } = await nominatedCycle(backend);
    await startVoting(backend.admin, await electionContext(backend, cycleId), null);

    await voteAs(backend, { cycleId, round: 1, uid: 'lia', choices: [rafa, julia] });
    await voteAs(backend, { cycleId, round: 1, uid: 'teo', choices: [rafa, julia] });
    await voteAs(backend, { cycleId, round: 1, uid: 'julia', choices: [rafa, teo] });

    const resolution = await tallyCurrentRound(
      backend.admin,
      await electionContext(backend, cycleId),
    );

    expect(resolution).toEqual({ kind: 'winner', nominationId: rafa, method: 'votes' });
    const cycle = await cycleOf(backend, cycleId);
    expect(cycle?.status).toBe('reading');
    expect(cycle?.winner?.book.title).toBe('Livro de rafa');
  });

  it('sends a tie to a runoff, then to a draw', async () => {
    const backend = emptyClub();
    const { cycleId, rafa, julia } = await nominatedCycle(backend);
    await startVoting(backend.admin, await electionContext(backend, cycleId), null);
    await voteAs(backend, { cycleId, round: 1, uid: 'lia', choices: [rafa, julia] });

    const first = await tallyCurrentRound(backend.admin, await electionContext(backend, cycleId));
    expect(first).toEqual({ kind: 'runoff', options: [rafa, julia] });

    await voteAs(backend, { cycleId, round: 2, uid: 'rafa', choices: [rafa] });
    await voteAs(backend, { cycleId, round: 2, uid: 'julia', choices: [julia] });
    const second = await tallyCurrentRound(backend.admin, await electionContext(backend, cycleId));
    expect(second).toEqual({ kind: 'tiebreak', candidates: [rafa, julia] });

    const winner = await drawTiebreak(
      backend.admin,
      await electionContext(backend, cycleId),
      () => 0.99,
    );
    expect(winner).toBe(julia);
    expect((await cycleOf(backend, cycleId))?.winner?.method).toBe('draw');
  });

  it('picks up where a previous attempt stopped', async () => {
    const backend = emptyClub();
    const { cycleId, rafa, julia } = await nominatedCycle(backend);
    await startVoting(backend.admin, await electionContext(backend, cycleId), null);
    await voteAs(backend, { cycleId, round: 1, uid: 'lia', choices: [rafa, julia] });
    await voteAs(backend, { cycleId, round: 1, uid: 'teo', choices: [rafa, julia] });
    // A previous attempt closed the round, then failed before recording results.
    await backend.admin.closeRound(cycleId, 1);

    const resolution = await tallyCurrentRound(
      backend.admin,
      await electionContext(backend, cycleId),
    );
    expect(resolution.kind).toBe('runoff');
  });
});

describe('drawTiebreak', () => {
  it('only runs during a tiebreak', async () => {
    const backend = emptyClub();
    const { cycleId } = await nominatedCycle(backend);
    await expect(
      drawTiebreak(backend.admin, await electionContext(backend, cycleId)),
    ).rejects.toMatchObject({ code: 'not-a-tiebreak' });
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
