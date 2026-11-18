import { describe, expect, it } from 'vitest';

import { makeBook } from '@/test/factories';

import { BOOK_LIMITS, formatAuthors, isUploadedCover, normalizeBook, validateBook } from './book';

const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';

describe('normalizeBook', () => {
  it('collapses whitespace and drops empty authors', () => {
    const book = normalizeBook(
      makeBook({ title: '  Dom   Casmurro ', authors: [' Machado ', ' '] }),
    );
    expect(book.title).toBe('Dom Casmurro');
    expect(book.authors).toEqual(['Machado']);
  });

  it('turns blank links into missing links', () => {
    const book = normalizeBook(makeBook({ coverUrl: '   ', synopsisUrl: ' ' }));
    expect(book.coverUrl).toBeNull();
    expect(book.synopsisUrl).toBeNull();
  });

  it('keeps paragraph breaks but limits blank lines', () => {
    const book = normalizeBook(makeBook({ synopsis: 'Um.\r\n\r\n\r\n\r\nDois.  ' }));
    expect(book.synopsis).toBe('Um.\n\nDois.');
  });
});

describe('validateBook', () => {
  it('accepts a complete book', () => {
    expect(validateBook(makeBook())).toEqual([]);
  });

  it('accepts a book with only the typed title', () => {
    const typed = makeBook({ authors: [], synopsis: '', synopsisUrl: null, coverUrl: null });
    expect(validateBook(typed)).toEqual([]);
  });

  it('requires a title', () => {
    expect(validateBook(makeBook({ title: '' }))).toContain('title-missing');
  });

  it('enforces the length limits', () => {
    const book = makeBook({
      title: 'x'.repeat(BOOK_LIMITS.title + 1),
      synopsis: 'x'.repeat(BOOK_LIMITS.synopsis + 1),
      authors: Array.from({ length: BOOK_LIMITS.authors + 1 }, () => 'Autor'),
    });
    expect(validateBook(book)).toEqual(['title-too-long', 'synopsis-too-long', 'too-many-authors']);
  });

  it.each(['http://example.com/sinopse', 'javascript:alert(1)', 'sinopse'])(
    'rejects the synopsis link %s',
    (synopsisUrl) => {
      expect(validateBook(makeBook({ synopsisUrl }))).toEqual(['synopsis-link-invalid']);
    },
  );

  it('accepts https covers and uploaded images', () => {
    expect(validateBook(makeBook({ coverUrl: 'https://example.com/capa.jpg' }))).toEqual([]);
    expect(validateBook(makeBook({ coverUrl: TINY_JPEG }))).toEqual([]);
  });

  it.each([
    'http://example.com/capa.jpg',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:text/html;base64,PGgxPg==',
  ])('rejects the cover %s', (coverUrl) => {
    expect(validateBook(makeBook({ coverUrl }))).toEqual(['cover-invalid']);
  });
});

describe('isUploadedCover', () => {
  it('accepts small jpeg, png and webp images', () => {
    expect(isUploadedCover(TINY_JPEG)).toBe(true);
    expect(isUploadedCover('data:image/webp;base64,UklGRg==')).toBe(true);
  });

  it('rejects images over the size limit', () => {
    const huge = `data:image/jpeg;base64,${'A'.repeat(BOOK_LIMITS.uploadedCover)}`;
    expect(isUploadedCover(huge)).toBe(false);
  });
});

describe('formatAuthors', () => {
  it('joins names the Portuguese way', () => {
    expect(formatAuthors(['Ana', 'Bia', 'Caio'])).toBe('Ana, Bia e Caio');
  });
});
