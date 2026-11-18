import { describe, expect, it } from 'vitest';

import { makeBook } from '@/test/factories';

import { BOOK_LIMITS, isUploadedCover, normalizeBook, validateBook } from './book';

const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';

describe('normalizeBook', () => {
  it('collapses whitespace in the title', () => {
    expect(normalizeBook(makeBook({ title: '  Berserk,   Kentaro  Miura ' })).title).toBe(
      'Berserk, Kentaro Miura',
    );
  });

  it('turns blank links into missing links', () => {
    const book = normalizeBook(makeBook({ coverUrl: '   ', synopsisUrl: ' ' }));
    expect(book.coverUrl).toBeNull();
    expect(book.synopsisUrl).toBeNull();
  });
});

describe('validateBook', () => {
  it('accepts any reading described in free text', () => {
    expect(validateBook(makeBook({ title: 'Watchmen (Alan Moore)' }))).toEqual([]);
    expect(validateBook(makeBook({ title: 'Berserk vol. 1' }))).toEqual([]);
  });

  it('accepts a title alone, without cover or link', () => {
    expect(validateBook({ title: 'Um livro qualquer', synopsisUrl: null, coverUrl: null })).toEqual(
      [],
    );
  });

  it('requires a title within the limit', () => {
    expect(validateBook(makeBook({ title: '' }))).toEqual(['title-missing']);
    expect(validateBook(makeBook({ title: 'x'.repeat(BOOK_LIMITS.title + 1) }))).toEqual([
      'title-too-long',
    ]);
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
