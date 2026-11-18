import { describe, expect, it } from 'vitest';

import { toProfileData } from './member-writes';

describe('toProfileData', () => {
  it('keeps a trimmed name and an https photo', () => {
    expect(toProfileData({ name: '  Ana  ', photoURL: 'https://example.com/a.jpg' })).toEqual({
      name: 'Ana',
      photoURL: 'https://example.com/a.jpg',
    });
  });

  it('falls back to a generic name and drops insecure photos', () => {
    expect(toProfileData({ name: ' ', photoURL: 'http://example.com/a.jpg' })).toEqual({
      name: 'Leitor',
      photoURL: null,
    });
  });

  it('caps the name length', () => {
    expect(toProfileData({ name: 'x'.repeat(200), photoURL: null }).name).toHaveLength(80);
  });
});
