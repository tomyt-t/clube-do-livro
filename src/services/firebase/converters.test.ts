import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { makeBook } from '@/test/factories';

import { toBook, toCycle, toNomination, toOwnAnswer, toRound, toTally } from './converters';

const at = new Date('2026-05-01T12:00:00Z');
const stamp = Timestamp.fromDate(at);

describe('toCycle', () => {
  const raw = {
    number: 3,
    status: 'voting',
    currentRound: 1,
    responses: 5,
    nominationDeadline: null,
    votingDeadline: stamp,
    createdAt: stamp,
    winner: null,
    readingStartedAt: null,
    finishedAt: null,
  };

  it('reads a cycle and converts timestamps to dates', () => {
    expect(toCycle('c3', raw)).toMatchObject({
      id: 'c3',
      number: 3,
      status: 'voting',
      votingDeadline: at,
      winner: null,
    });
  });

  it('reads the winner', () => {
    const winner = { nominationId: 'n1', book: makeBook(), method: 'draw', decidedAt: stamp };
    expect(toCycle('c3', { ...raw, winner })?.winner).toEqual({ ...winner, decidedAt: at });
  });

  it('skips cycles with an unknown status or no creation date', () => {
    expect(toCycle('c3', { ...raw, status: 'hacked' })).toBeNull();
    expect(toCycle('c3', { ...raw, createdAt: null })).toBeNull();
  });
});

describe('toBook', () => {
  it('fills safe defaults for missing optional fields', () => {
    expect(toBook({ title: 'Torto Arado' })).toEqual({
      title: 'Torto Arado',
      synopsisUrl: null,
      coverUrl: null,
    });
  });

  it('rejects books without a title', () => {
    expect(toBook({ coverUrl: 'https://example.com/capa.jpg' })).toBeNull();
    expect(toNomination('n1', { book: 'nope' })).toBeNull();
  });
});

describe('toRound', () => {
  it('reads a round with its results', () => {
    const round = toRound({
      number: 2,
      kind: 'runoff',
      options: ['a', 'b', 7],
      votesPerMember: 1,
      status: 'closed',
      ballots: 6,
      openedAt: stamp,
      closedAt: stamp,
      results: { a: 3, b: 'x' },
    });
    expect(round).toMatchObject({ options: ['a', 'b'], results: { a: 3, b: 0 }, closedAt: at });
  });

  it('skips rounds with an unknown kind', () => {
    expect(toRound({ kind: 'third', status: 'open', openedAt: stamp })).toBeNull();
  });
});

describe('small readers', () => {
  it('reads answers and tallies', () => {
    expect(toOwnAnswer({ nominationId: 'n1' })).toEqual({ kind: 'nominated', nominationId: 'n1' });
    expect(toOwnAnswer({ nominationId: null })).toEqual({ kind: 'passed' });
    expect(toTally({ a: 2, b: -1 })).toEqual({ a: 2, b: 0 });
    expect(toTally(null)).toBeNull();
  });
});
