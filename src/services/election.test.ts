import { describe, expect, it } from 'vitest';

import type { FlowStep } from '@/domain/flow';
import { openingResults, type ConflictGroup } from '@/domain/review';
import type { Cycle } from '@/domain/types';
import { drawNumber } from '@/domain/draw';
import { makeBook, makeCycle } from '@/test/factories';
import {
  MEMBERS,
  answerAs,
  cycleOf,
  cyclesOf,
  emptyClub,
  finishAs,
  settle,
  voteAs,
} from '@/test/backend';

import type { FlowPort } from './backend';
import type { DemoBackend } from './demo';
import { ElectionError, finishCurrentReading, openNominations, takeFlowStep } from './election';

/** Round 1 where rafa, julia and teo nominate and everyone else passes. */
async function nominatedRound(backend: DemoBackend) {
  const cycleId = await openNominations(backend.admin, [], null);
  const rafa = `${await answerAs(backend, cycleId, 'rafa')}`;
  const julia = `${await answerAs(backend, cycleId, 'julia')}`;
  const teo = `${await answerAs(backend, cycleId, 'teo')}`;
  for (const uid of ['bruno', 'lia', 'marina']) await answerAs(backend, cycleId, uid, null);
  return { cycleId, rafa, julia, teo };
}

/** Everyone not listed in `ballots` votes for the first two books they may. */
async function everyoneVotes(
  backend: DemoBackend,
  cycleId: string,
  ballots: Record<string, string[]>,
) {
  for (const [uid, choices] of Object.entries(ballots))
    await voteAs(backend, { cycleId, uid, choices });
}

describe('openNominations', () => {
  it('names cycles by number and refuses a second open election', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    expect(cycleId).toBe('ciclo-1');
    expect((await cycleOf(backend, cycleId)).number).toBe(1);

    await expect(openNominations(backend.admin, await cyclesOf(backend), null)).rejects.toThrow(
      ElectionError,
    );
  });
});

describe('the automatic flow', () => {
  it('waits for everyone before opening the vote', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    await answerAs(backend, cycleId, 'rafa');
    await settle(backend);
    expect((await cycleOf(backend, cycleId)).status).toBe('nominating');
  });

  it('opens the vote with every nomination once everyone answered', async () => {
    const backend = emptyClub();
    const { cycleId, rafa, julia, teo } = await nominatedRound(backend);
    await settle(backend);

    const cycle = await cycleOf(backend, cycleId);
    expect(cycle.status).toBe('voting');
    expect([...cycle.options].sort()).toEqual([rafa, julia, teo].sort());
  });

  it('does not let a member open the vote early', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    const rafa = `${await answerAs(backend, cycleId, 'rafa')}`;
    backend.auth.signInAs('julia');
    await expect(
      backend.flow.startVoting({
        cycleId,
        options: [rafa],
        opening: openingResults([rafa], {}),
        votingDeadline: null,
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('declares the winner once everyone voted', async () => {
    const backend = emptyClub();
    const { cycleId, rafa, julia, teo } = await nominatedRound(backend);
    await settle(backend);
    await everyoneVotes(backend, cycleId, {
      marina: [rafa, julia],
      rafa: [julia, teo],
      julia: [rafa, teo],
      teo: [rafa, julia],
      bruno: [teo, rafa],
    });
    await settle(backend);
    expect((await cycleOf(backend, cycleId)).status).toBe('voting');

    await voteAs(backend, { cycleId, uid: 'lia', choices: [julia, rafa] });
    await settle(backend);
    const cycle = await cycleOf(backend, cycleId);
    expect(cycle.status).toBe('reading');
    expect(cycle.winner).toMatchObject({ nominationId: rafa, method: 'votes', drawnFrom: [] });
    expect(cycle.results?.votes[rafa]).toBe(5);
  });

  it('settles a tie that first choices cannot break with a draw anyone can check', async () => {
    const backend = emptyClub();
    const { cycleId, rafa, julia, teo } = await nominatedRound(backend);
    await settle(backend);
    await everyoneVotes(backend, cycleId, {
      marina: [rafa, julia],
      rafa: [julia, teo],
      julia: [rafa, teo],
      teo: [julia, rafa],
      bruno: [teo, rafa],
      lia: [teo, julia],
    });
    await settle(backend);

    const cycle = await cycleOf(backend, cycleId);
    const drawnFrom = cycle.options.filter((id) => [rafa, julia, teo].includes(id));
    expect(cycle.winner?.method).toBe('draw');
    expect(cycle.winner?.drawnFrom).toEqual(drawnFrom);
    const seed = cycle.votingClosedAt?.getTime() ?? 0;
    expect(cycle.winner?.nominationId).toBe(drawnFrom[drawNumber(seed) % 3]);
  });

  it('skips the vote when there is a single nomination', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    const only = await answerAs(backend, cycleId, 'rafa');
    for (const uid of MEMBERS.filter((member) => member !== 'rafa')) {
      await answerAs(backend, cycleId, uid, null);
    }
    await settle(backend);

    expect((await cycleOf(backend, cycleId)).winner).toMatchObject({
      nominationId: only,
      method: 'unopposed',
    });
  });

  it('ends the book once everyone finished it and opens the next round', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    await answerAs(backend, cycleId, 'rafa');
    for (const uid of MEMBERS.filter((member) => member !== 'rafa')) {
      await answerAs(backend, cycleId, uid, null);
    }
    await settle(backend);

    for (const uid of MEMBERS.slice(0, 5)) await finishAs(backend, cycleId, uid);
    await settle(backend);
    expect((await cycleOf(backend, cycleId)).status).toBe('reading');

    await finishAs(backend, cycleId, 'lia');
    await settle(backend);
    expect((await cycleOf(backend, cycleId)).status).toBe('finished');
    expect((await cycleOf(backend, 'ciclo-2')).status).toBe('nominating');
  });

  it('counts each reader once', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    await answerAs(backend, cycleId, 'rafa');
    for (const uid of MEMBERS.filter((member) => member !== 'rafa')) {
      await answerAs(backend, cycleId, uid, null);
    }
    await settle(backend);
    await finishAs(backend, cycleId, 'teo');
    await expect(finishAs(backend, cycleId, 'teo')).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});

describe('the review before the vote', () => {
  it('stops for the organizer when a reading is nominated twice, then merges it', async () => {
    const backend = emptyClub();
    const cycleId = await openNominations(backend.admin, [], null);
    const dom = `${await answerAs(backend, cycleId, 'rafa', makeBook({ title: 'Dom Casmurro' }))}`;
    const twice = `${await answerAs(backend, cycleId, 'julia', makeBook({ title: 'Dom Casmurro, Machado' }))}`;
    const torto = `${await answerAs(backend, cycleId, 'teo', makeBook({ title: 'Torto Arado' }))}`;
    for (const uid of ['bruno', 'lia', 'marina']) await answerAs(backend, cycleId, uid, null);
    // Any member's device runs the check and records what it found.
    await settle(backend);
    let cycle = await cycleOf(backend, cycleId);
    expect(cycle.status).toBe('nominating');
    expect(cycle.review?.conflicts).toEqual([
      { ids: [dom, twice], reason: 'Mesmo título: Dom Casmurro.' },
    ]);

    await backend.admin.updateReview({ cycleId, groups: [], merged: { [twice]: dom } });
    await settle(backend);
    cycle = await cycleOf(backend, cycleId);
    expect(cycle.status).toBe('voting');
    expect(cycle.options).toEqual([dom, torto]);

    // Rafa and Júlia already count as Dom Casmurro's first choices: one more pick each.
    await voteAs(backend, { cycleId, uid: 'rafa', choices: [torto], countsFirst: false });
    await voteAs(backend, { cycleId, uid: 'julia', choices: [torto], countsFirst: false });
    await expect(
      voteAs(backend, { cycleId, uid: 'teo', choices: [dom, torto], countsFirst: true }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await voteAs(backend, { cycleId, uid: 'teo', choices: [dom] });
    for (const uid of ['bruno', 'lia', 'marina']) {
      await voteAs(backend, { cycleId, uid, choices: [torto, dom] });
    }
    await settle(backend);

    cycle = await cycleOf(backend, cycleId);
    expect(cycle.results).toEqual({
      votes: { [dom]: 6, [torto]: 5 },
      firsts: { [dom]: 3, [torto]: 3 },
    });
    expect(cycle.winner?.nominationId).toBe(dom);
  });
});

describe('finishCurrentReading', () => {
  it('has nothing to finish when no book is being read', async () => {
    const backend = emptyClub();
    await expect(finishCurrentReading(backend.admin, [])).rejects.toMatchObject({
      code: 'nothing-to-finish',
    });
  });
});

describe('the duplicate check', () => {
  const nomination = (id: string, title: string) => ({ id, book: makeBook({ title }) });
  const LIST = [
    nomination('a', 'Dom Casmurro'),
    nomination('b', 'Dom Casmurro, Machado de Assis'),
    nomination('c', 'Vidas Secas'),
    nomination('gone', 'Dom Casmurro (edição antiga)'),
  ];

  async function check(cycle: Partial<Cycle>, groups: ConflictGroup[]) {
    const seen: string[][] = [];
    const recorded: ConflictGroup[][] = [];
    const flow = {
      recordReview: (_id: string, found: readonly ConflictGroup[]) => {
        recorded.push([...found]);
        return Promise.resolve();
      },
    } as unknown as FlowPort;
    const checker = {
      findDuplicates: (list: readonly { id: string }[]) => {
        seen.push(list.map(({ id }) => id));
        return Promise.resolve(groups);
      },
    };
    const step = { kind: 'check', cycle: makeCycle({ nominationIds: ['a', 'b', 'c'], ...cycle }) };
    await takeFlowStep(flow, step as FlowStep, {
      cycles: [],
      nominations: LIST,
      checker,
    });
    return { seen: seen[0], recorded: recorded[0] };
  }

  it('checks only what would be on the ballot', async () => {
    const { seen } = await check({ merged: { c: 'a' } }, []);
    // Not a nomination let go and gone from the list, nor one merged away.
    expect(seen).toEqual(['a', 'b']);
  });

  it('does not raise again a group already sorted out this round', async () => {
    const settled = { ids: ['a', 'b'], reason: 'Mesmo título.' };
    expect((await check({ flagged: ['a', 'b'] }, [settled])).recorded).toEqual([]);
    expect((await check({ flagged: ['a'] }, [settled])).recorded).toEqual([settled]);
  });
});
