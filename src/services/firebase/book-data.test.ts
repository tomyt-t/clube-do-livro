import { describe, expect, it } from 'vitest';

import { makeBook } from '@/test/factories';

import { InvalidBookError, toBookData } from './book-data';

describe('toBookData', () => {
  it('normalizes the book and keeps exactly the stored fields', () => {
    const data = toBookData({ ...makeBook({ title: '  Torto   Arado ' }), extra: 'x' } as never);
    expect(data.title).toBe('Torto Arado');
    expect(Object.keys(data).sort()).toEqual(['coverUrl', 'synopsisUrl', 'title']);
  });

  it('URL-encodes links so they are plain ASCII', () => {
    const data = toBookData(makeBook({ synopsisUrl: 'https://example.com/sinopse de livro' }));
    expect(data.synopsisUrl).toBe('https://example.com/sinopse%20de%20livro');
  });

  it('keeps uploaded covers untouched', () => {
    const coverUrl = 'data:image/png;base64,iVBORw0KGgo=';
    expect(toBookData(makeBook({ coverUrl })).coverUrl).toBe(coverUrl);
  });

  it('refuses invalid books before they reach the server', () => {
    expect(() => toBookData(makeBook({ title: ' ' }))).toThrow(InvalidBookError);
    expect(() => toBookData(makeBook({ synopsisUrl: 'http://example.com' }))).toThrow(
      InvalidBookError,
    );
  });
});
