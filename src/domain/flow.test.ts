import { describe, expect, it } from 'vitest';

import { makeBook, makeCycle } from '@/test/factories';

import { cycleIdFor, everyone, nextFlowStep } from './flow';

const winner = {
  nominationId: 'n1',
  book: makeBook(),
  method: 'votes' as const,
  decidedAt: new Date(),
  drawnFrom: [],
};

describe('everyone', () => {
  it('needs a known number of members', () => {
    expect(everyone(6, 6)).toBe(true);
    expect(everyone(5, 6)).toBe(false);
    expect(everyone(0, 0)).toBe(false);
  });
});

describe('nextFlowStep', () => {
  it('opens the list for the check once everyone answered and someone nominated', () => {
    const waiting = makeCycle({
      status: 'nominating',
      responses: 5,
      nominationIds: ['a', 'b', 'c'],
    });
    const ready = makeCycle({ status: 'nominating', responses: 6, nominationIds: ['a', 'b', 'c'] });
    const nobody = makeCycle({ status: 'nominating', responses: 6, nominationIds: [] });
    expect(nextFlowStep([waiting], 6)).toBeNull();
    expect(nextFlowStep([ready], 6)).toEqual({ kind: 'start-review', cycle: ready });
    expect(nextFlowStep([nobody], 6)).toBeNull();
    // Someone let go is still choosing again, even if the count says everyone answered.
    const letGo = makeCycle({ ...ready, letGo: ['x'], letGoAt: new Date() });
    expect(nextFlowStep([letGo], 6)).toBeNull();
  });

  it('checks the open list, then opens the vote only if nothing was flagged', () => {
    const answered = { status: 'nominating' as const, responses: 6, nominationIds: ['a', 'b'] };
    const checking = makeCycle({ ...answered, review: { conflicts: null } });
    const clear = makeCycle({ ...answered, review: { conflicts: [] } });
    const flagged = makeCycle({
      ...answered,
      review: { conflicts: [{ ids: ['a', 'b'], reason: 'Mesmo título.' }] },
    });
    expect(nextFlowStep([checking], 6)?.kind).toBe('check');
    expect(nextFlowStep([clear], 6)?.kind).toBe('open-voting');
    expect(nextFlowStep([flagged], 6)).toBeNull();
  });

  it('closes the vote once everyone voted, or right away with a single book', () => {
    const voting = makeCycle({ status: 'voting', options: ['a', 'b'], ballots: 6 });
    const single = makeCycle({ status: 'voting', options: ['a'], ballots: 0 });
    expect(nextFlowStep([voting], 6)?.kind).toBe('close-voting');
    expect(nextFlowStep([single], 6)?.kind).toBe('close-voting');
    expect(nextFlowStep([{ ...voting, ballots: 5 }], 6)).toBeNull();
  });

  it('declares the winner once voting closed', () => {
    expect(nextFlowStep([makeCycle({ status: 'tallying' })], 6)?.kind).toBe('declare');
  });

  it('ends the book once everyone finished it, unless another is queued', () => {
    const reading = makeCycle({ number: 3, status: 'reading', winner, finishedReaders: 6 });
    const queued = makeCycle({ number: 4, status: 'upcoming', winner });
    expect(nextFlowStep([reading], 6)).toEqual({ kind: 'finish-reading', cycle: reading });
    expect(nextFlowStep([{ ...reading, finishedReaders: 4 }], 6)).toBeNull();
    expect(nextFlowStep([reading, queued], 6)).toBeNull();
  });

  it('names cycles by number', () => {
    expect(cycleIdFor(5)).toBe('ciclo-5');
  });
});
