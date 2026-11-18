import { describe, expect, it } from 'vitest';

import {
  eligibleOptions,
  hasRoomForNomination,
  MAX_OPTIONS,
  ownNominationOf,
  requiredChoices,
  validateBallot,
  VOTES_PER_MEMBER,
} from './voting';

const options = ['a', 'b', 'c'];

describe('hasRoomForNomination', () => {
  it('takes nominations until the ballot is full', () => {
    const ids = (count: number) => Array.from({ length: count }, (_, i) => `n${String(i)}`);
    expect(hasRoomForNomination(ids(MAX_OPTIONS - 1))).toBe(true);
    expect(hasRoomForNomination(ids(MAX_OPTIONS))).toBe(false);
  });
});

describe('ownNominationOf', () => {
  it('returns the nominated book only when the member nominated one', () => {
    expect(ownNominationOf({ kind: 'nominated', nominationId: 'a' })).toBe('a');
    expect(ownNominationOf({ kind: 'passed' })).toBeNull();
    expect(ownNominationOf(null)).toBeNull();
  });
});

describe('eligibleOptions', () => {
  it('hides your own nomination', () => {
    expect(eligibleOptions(options, 'a')).toEqual(['b', 'c']);
  });

  it('keeps every option when you nominated nothing', () => {
    expect(eligibleOptions(options, null)).toEqual(['a', 'b', 'c']);
  });
});

describe('requiredChoices', () => {
  it('asks for a first and a second choice', () => {
    expect(VOTES_PER_MEMBER).toBe(2);
    expect(requiredChoices(options, 'a')).toBe(2);
  });

  it('asks for fewer when there are not enough eligible options', () => {
    expect(requiredChoices(['a', 'b'], 'a')).toBe(1);
    expect(requiredChoices(['a'], 'a')).toBe(0);
  });
});

describe('validateBallot', () => {
  it('accepts a first and a second choice', () => {
    expect(validateBallot(options, 'a', ['c', 'b'])).toBeNull();
  });

  it.each([
    { choices: ['b'], error: 'wrong-count' },
    { choices: ['b', 'b'], error: 'duplicate' },
    { choices: ['b', 'z'], error: 'not-an-option' },
    { choices: ['a', 'b'], error: 'own-nomination' },
  ])('rejects $choices with $error', ({ choices, error }) => {
    expect(validateBallot(options, 'a', choices)).toBe(error);
  });

  it('accepts a single choice when only one book is eligible', () => {
    expect(validateBallot(['a', 'b'], 'a', ['b'])).toBeNull();
  });
});
