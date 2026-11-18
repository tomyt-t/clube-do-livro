import { describe, expect, it } from 'vitest';

import { linkHost, withHost } from './link-host';

describe('linkHost', () => {
  it('names where a link goes', () => {
    expect(linkHost('https://pt.wikipedia.org/wiki/Dom_Casmurro')).toBe('pt.wikipedia.org');
    expect(linkHost('https://www.example.com/x')).toBe('example.com');
    expect(withHost('Abrir o link', 'https://login-google.example/')).toBe(
      'Abrir o link (login-google.example)',
    );
    expect(withHost('Abrir o link', 'não é link')).toBe('Abrir o link');
  });
});
