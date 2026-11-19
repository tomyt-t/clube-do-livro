import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { makeBook } from '@/test/factories';

import { toBook, toCycle, toNomination, toOwnAnswer, toResults } from './converters';

const at = new Date('2026-05-01T12:00:00Z');
const stamp = Timestamp.fromDate(at);

describe('toCycle', () => {
  const raw = {
    number: 3,
    status: 'voting',
    responses: 5,
    nominationDeadline: null,
    votingDeadline: stamp,
    createdAt: stamp,
    options: ['a', 'b', 7],
    ballots: 4,
    votingOpenedAt: stamp,
    votingClosedAt: null,
    results: null,
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
      options: ['a', 'b'],
      ballots: 4,
      votingOpenedAt: at,
      results: null,
      winner: null,
    });
  });

  it('reads the results, with unreadable counts as zero', () => {
    const results = { votes: { a: 3, b: 'x' }, firsts: { a: 1, b: 2 } };
    expect(toCycle('c3', { ...raw, results })?.results).toEqual({
      votes: { a: 3, b: 0 },
      firsts: { a: 1, b: 2 },
    });
  });

  it('reads the winner', () => {
    const winner = {
      nominationId: 'n1',
      book: makeBook(),
      method: 'draw',
      decidedAt: stamp,
      drawnFrom: ['a', 'n1', 7],
    };
    expect(toCycle('c3', { ...raw, winner })?.winner).toEqual({
      ...winner,
      decidedAt: at,
      drawnFrom: ['a', 'n1'],
      display: 'text',
      pdfUrl: null,
    });
  });

  it("reads the nominator's materials, and ignores a display it does not know", () => {
    const winner = {
      nominationId: 'n1',
      book: makeBook(),
      method: 'votes',
      decidedAt: stamp,
      drawnFrom: [],
      display: 'link',
      pdfUrl: 'https://drive.google.com/file/d/1/view',
    };
    expect(toCycle('c3', { ...raw, winner })?.winner).toMatchObject({
      display: 'link',
      pdfUrl: 'https://drive.google.com/file/d/1/view',
    });
    const odd = { ...winner, display: 'hidden' };
    expect(toCycle('c3', { ...raw, winner: odd })?.winner?.display).toBe('text');
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
      synopsis: null,
      synopsisSource: null,
      synopsisUrl: null,
      coverUrl: null,
      coverSourceUrl: null,
    });
  });

  it('credits only known synopsis sources, and only with a text', () => {
    expect(toBook({ title: 'A', synopsis: 'Texto', synopsisSource: 'anilist' })).toMatchObject({
      synopsis: 'Texto',
      synopsisSource: 'anilist',
    });
    expect(
      toBook({ title: 'A', synopsis: 'Texto', synopsisSource: 'blog' })?.synopsisSource,
    ).toBeNull();
    expect(toBook({ title: 'A', synopsisSource: 'anilist' })?.synopsisSource).toBeNull();
  });

  it('rejects books without a title', () => {
    expect(toBook({ coverUrl: 'https://example.com/capa.jpg' })).toBeNull();
    expect(toNomination('n1', { book: 'nope' })).toBeNull();
  });
});

describe('small readers', () => {
  it('reads answers and results', () => {
    expect(toOwnAnswer({ nominationId: 'n1' })).toEqual({ kind: 'nominated', nominationId: 'n1' });
    expect(toOwnAnswer({ nominationId: null })).toEqual({ kind: 'passed' });
    expect(toResults({ votes: { a: 2, b: -1 }, firsts: { a: 1 } })).toEqual({
      votes: { a: 2, b: 0 },
      firsts: { a: 1 },
    });
    expect(toResults({ votes: { a: 2 } })).toBeNull();
    expect(toResults(null)).toBeNull();
  });
});
