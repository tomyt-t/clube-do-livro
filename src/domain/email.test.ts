import { describe, expect, it } from 'vitest';

import { isEmail, normalizeEmail } from './email';

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
