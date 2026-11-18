import { describe, expect, it } from 'vitest';

import { isEmail, normalizeEmail, parseEmails } from './email';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ana.Souza@Gmail.COM ')).toBe('ana.souza@gmail.com');
  });
});

describe('isEmail', () => {
  it.each(['ana@gmail.com', 'ana+livros@exemplo.com.br'])('accepts %s', (value) => {
    expect(isEmail(value)).toBe(true);
  });

  it.each(['ana', 'ana@', '@gmail.com', 'ana@gmail', 'ana @gmail.com', 'a@b@c.com'])(
    'rejects %s',
    (value) => {
      expect(isEmail(value)).toBe(false);
    },
  );
});

describe('parseEmails', () => {
  it('reads a pasted list in any shape, without repeats', () => {
    const pasted = 'Rafa <Rafa@Example.com>, julia@example.com; teo@example.com\nrafa@example.com';
    expect(parseEmails(pasted)).toEqual({
      valid: ['rafa@example.com', 'julia@example.com', 'teo@example.com'],
      invalid: [],
    });
  });

  it('ignores names and points out what only looks like an email', () => {
    expect(parseEmails('Marina marina@ lia@example.com bruno@exemplo')).toEqual({
      valid: ['lia@example.com'],
      invalid: ['marina@', 'bruno@exemplo'],
    });
  });
});
