import { describe, expect, it } from 'vitest';

import { makeRound } from '@/test/factories';

import {
  eligibleOptions,
  ownNominationOf,
  requiredChoices,
  rulesFor,
  validateBallot,
} from './voting';

describe('ownNominationOf', () => {
  it('returns the nominated book only when the member nominated one', () => {
    expect(ownNominationOf({ kind: 'nominated', nominationId: 'a' })).toBe('a');
    expect(ownNominationOf({ kind: 'passed' })).toBeNull();
    expect(ownNominationOf(null)).toBeNull();
  });
});

describe('rulesFor', () => {
  it('gives two votes in the first round and one in a runoff', () => {
    expect(rulesFor('first').votesPerMember).toBe(2);
    expect(rulesFor('runoff').votesPerMember).toBe(1);
  });
});

describe('eligibleOptions', () => {
  const first = makeRound({ kind: 'first', options: ['a', 'b', 'c'] });
  const runoff = makeRound({ kind: 'runoff', options: ['a', 'b'], votesPerMember: 1 });

  it('hides your own nomination in the first round', () => {
    expect(eligibleOptions(first, 'a')).toEqual(['b', 'c']);
  });

  it('keeps every option when you nominated nothing', () => {
    expect(eligibleOptions(first, null)).toEqual(['a', 'b', 'c']);
  });

  it('lets you vote for your own nomination in a runoff', () => {
    expect(eligibleOptions(runoff, 'a')).toEqual(['a', 'b']);
  });
});

describe('requiredChoices', () => {
  it('asks for two choices in a regular first round', () => {
    expect(requiredChoices(makeRound({ options: ['a', 'b', 'c'] }), 'a')).toBe(2);
  });

  it('asks for fewer choices when there are not enough eligible options', () => {
    expect(requiredChoices(makeRound({ options: ['a', 'b'] }), 'a')).toBe(1);
  });
});

describe('validateBallot', () => {
  const round = makeRound({ options: ['a', 'b', 'c'] });

  it('accepts two distinct eligible choices', () => {
    expect(validateBallot(round, 'a', ['b', 'c'])).toBeNull();
  });

  it.each([
    { choices: ['b'], error: 'wrong-count' },
    { choices: ['b', 'b'], error: 'duplicate' },
    { choices: ['b', 'z'], error: 'not-an-option' },
    { choices: ['a', 'b'], error: 'own-nomination' },
  ])('rejects $choices with $error', ({ choices, error }) => {
    expect(validateBallot(round, 'a', choices)).toBe(error);
  });

  it('accepts your own nomination in a runoff', () => {
    const runoff = makeRound({ kind: 'runoff', options: ['a', 'b'], votesPerMember: 1 });
    expect(validateBallot(runoff, 'a', ['a'])).toBeNull();
  });
});
