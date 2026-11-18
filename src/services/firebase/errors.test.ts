import { describe, expect, it } from 'vitest';

import { BackendError } from '../backend';

import { InvalidBookError } from './book-data';
import { guard, isCancelledSignIn, toBackendError } from './errors';

const firebaseError = (code: string) => Object.assign(new Error(code), { code });

describe('toBackendError', () => {
  it.each([
    ['permission-denied', 'permission-denied'],
    ['unavailable', 'unavailable'],
    ['auth/network-request-failed', 'unavailable'],
    ['invalid-argument', 'invalid-data'],
    ['internal', 'unknown'],
  ])('maps %s to %s', (code, expected) => {
    expect(toBackendError(firebaseError(code)).code).toBe(expected);
  });

  it('explains auth problems the person can fix', () => {
    expect(toBackendError(firebaseError('auth/popup-blocked')).message).toContain('pop-ups');
  });

  it('keeps backend errors and translates invalid books', () => {
    const original = new BackendError('unavailable');
    expect(toBackendError(original)).toBe(original);
    expect(toBackendError(new InvalidBookError(['title-missing'])).code).toBe('invalid-data');
  });

  it('copes with values that are not errors', () => {
    expect(toBackendError('boom').code).toBe('unknown');
  });
});

describe('guard', () => {
  it('passes results through and translates failures', async () => {
    await expect(guard(Promise.resolve(1))).resolves.toBe(1);
    await expect(guard(Promise.reject(firebaseError('permission-denied')))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});

describe('isCancelledSignIn', () => {
  it('recognizes a closed popup', () => {
    expect(isCancelledSignIn(firebaseError('auth/popup-closed-by-user'))).toBe(true);
    expect(isCancelledSignIn(firebaseError('auth/popup-blocked'))).toBe(false);
  });
});
