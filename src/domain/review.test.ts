import { describe, expect, it } from 'vitest';

import {
  ballotOptions,
  ballotSeat,
  canLetGo,
  conflictIds,
  isLetGo,
  isReviewClear,
  mergeGroup,
  openingResults,
  withoutGroup,
} from './review';
import { addBallot } from './tally';
import { requiredChoices, validateBallot } from './voting';

const NOMINATIONS = ['a', 'b', 'c', 'd'];

describe('the review', () => {
  it('is clear only once checked with nothing left flagged', () => {
    expect(isReviewClear(null)).toBe(false);
    expect(isReviewClear({ conflicts: null })).toBe(false);
    expect(isReviewClear({ conflicts: [{ ids: ['a', 'b'], reason: '' }] })).toBe(false);
    expect(isReviewClear({ conflicts: [] })).toBe(true);
  });

  it('lists every flagged nomination once', () => {
    const groups = [
      { ids: ['a', 'b'], reason: '' },
      { ids: ['b', 'c'], reason: '' },
    ];
    expect(conflictIds(groups)).toEqual(['a', 'b', 'c']);
    expect(withoutGroup(groups, 0)).toEqual([{ ids: ['b', 'c'], reason: '' }]);
  });
});

describe('merging', () => {
  it('keeps the earliest nomination and folds the others into it', () => {
    expect(mergeGroup({}, ['c', 'a'], NOMINATIONS)).toEqual({ c: 'a' });
    expect(ballotOptions(NOMINATIONS, { c: 'a' })).toEqual(['a', 'b', 'd']);
  });

  it('keeps a reading that already took others in, and never moves an earlier merge', () => {
    // b already took c in: merging a and b keeps b, so c still points at a ballot option.
    expect(mergeGroup({ c: 'b' }, ['a', 'b'], NOMINATIONS)).toEqual({ c: 'b', a: 'b' });
    // Two readings that each took others in cannot become one.
    expect(mergeGroup({ c: 'a', d: 'b' }, ['a', 'b'], NOMINATIONS)).toBeNull();
    expect(mergeGroup({ c: 'a' }, ['a', 'c'], NOMINATIONS)).toBeNull();
  });

  it("lets a nomination go only if it was not merged, and frees its member's answer", () => {
    expect(canLetGo('b', { c: 'a' })).toBe(true);
    expect(canLetGo('a', { c: 'a' })).toBe(false);
    expect(canLetGo('c', { c: 'a' })).toBe(false);
    const cycle = { letGo: ['c'] };
    expect(isLetGo({ kind: 'nominated', nominationId: 'c' }, cycle)).toBe(true);
    expect(isLetGo({ kind: 'nominated', nominationId: 'a' }, cycle)).toBe(false);
    expect(isLetGo({ kind: 'passed' }, cycle)).toBe(false);
    expect(isLetGo(null, cycle)).toBe(false);
  });

  it('gives a merged reading a head start of one first choice per later nomination', () => {
    const merged = { c: 'a', d: 'a' };
    expect(openingResults(['a', 'b'], merged)).toEqual({
      votes: { a: 2, b: 0 },
      firsts: { a: 2, b: 0 },
    });
    expect(openingResults(['a', 'b'], {})).toEqual({
      votes: { a: 0, b: 0 },
      firsts: { a: 0, b: 0 },
    });
  });
});

describe('a merged nominator on the ballot', () => {
  const merged = { c: 'a' };
  const options = ballotOptions(NOMINATIONS, merged);

  it('who nominated it later cannot vote for it, and picks one', () => {
    const seat = ballotSeat('c', merged);
    expect(seat).toEqual({ own: 'a', merged: true });
    expect(requiredChoices(options, seat.own, seat.merged)).toBe(1);
    expect(validateBallot(options, seat.own, ['b'], seat.merged)).toBeNull();
    expect(validateBallot(options, seat.own, ['a'], seat.merged)).toBe('own-nomination');
    expect(validateBallot(options, seat.own, ['b', 'd'], seat.merged)).toBe('wrong-count');
  });

  it('who nominated it first votes as usual, never for it', () => {
    const seat = ballotSeat('a', merged);
    expect(seat).toEqual({ own: 'a', merged: false });
    expect(requiredChoices(options, seat.own, seat.merged)).toBe(2);
    expect(validateBallot(options, seat.own, ['b', 'd'], seat.merged)).toBeNull();
    expect(validateBallot(options, seat.own, ['a', 'b'], seat.merged)).toBe('own-nomination');
  });

  it('adds a vote without a first choice', () => {
    const start = openingResults(options, merged);
    expect(addBallot(start, ['b'], false)).toEqual({
      votes: { a: 1, b: 1, d: 0 },
      firsts: { a: 1, b: 0, d: 0 },
    });
  });

  it('leaves everyone else as they were', () => {
    expect(ballotSeat('b', merged)).toEqual({ own: 'b', merged: false });
    expect(ballotSeat(null, merged)).toEqual({ own: null, merged: false });
  });
});
