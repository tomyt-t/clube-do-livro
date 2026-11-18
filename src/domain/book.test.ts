import { describe, expect, it } from 'vitest';

import { makeBook } from '@/test/factories';

import {
  BOOK_LIMITS,
  byTitle,
  isUploadedCover,
  normalizeBook,
  normalizeSynopsis,
  splitTitle,
  validateBook,
} from './book';

const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';

describe('normalizeBook', () => {
  it('collapses whitespace in the title', () => {
    expect(normalizeBook(makeBook({ title: '  Berserk,   Kentaro  Miura ' })).title).toBe(
      'Berserk, Kentaro Miura',
    );
  });

  it('keeps synopsis paragraphs but drops stray spaces and blank runs', () => {
    expect(normalizeSynopsis('  Primeiro   parágrafo. \r\n\n\n\n  Segundo.  ')).toBe(
      'Primeiro parágrafo.\n\nSegundo.',
    );
    expect(normalizeSynopsis('   ')).toBeNull();
  });

  it('forgets the source of a synopsis that was erased', () => {
    const book = normalizeBook(makeBook({ synopsis: ' ', synopsisSource: 'wikipedia' }));
    expect(book).toMatchObject({ synopsis: null, synopsisSource: null });
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
    const bare = {
      title: 'Um livro qualquer',
      synopsis: null,
      synopsisSource: null,
      synopsisUrl: null,
      coverUrl: null,
    };
    expect(validateBook(bare)).toEqual([]);
  });

  it('requires a title within the limit', () => {
    expect(validateBook(makeBook({ title: '' }))).toEqual(['title-missing']);
    expect(validateBook(makeBook({ title: 'x'.repeat(BOOK_LIMITS.title + 1) }))).toEqual([
      'title-too-long',
    ]);
  });

  it('limits the synopsis and only credits known sources', () => {
    const long = 'x'.repeat(BOOK_LIMITS.synopsis + 1);
    expect(validateBook(makeBook({ synopsis: long }))).toEqual(['synopsis-too-long']);
    expect(validateBook(makeBook({ synopsisSource: 'anilist' }))).toEqual([]);
    expect(validateBook(makeBook({ synopsisSource: 'blog' as never }))).toEqual([
      'synopsis-source-invalid',
    ]);
    expect(validateBook(makeBook({ synopsis: null, synopsisSource: 'wikipedia' }))).toEqual([
      'synopsis-source-invalid',
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

describe('splitTitle', () => {
  it.each([
    ['Torto Arado, Itamar Vieira Junior', 'Torto Arado', 'Itamar Vieira Junior'],
    ['Berserk vol. 1 / Kentaro Miura', 'Berserk vol. 1', 'Kentaro Miura'],
    ['Watchmen - Alan Moore', 'Watchmen', 'Alan Moore'],
    ['Eu, Robô — Isaac Asimov', 'Eu, Robô', 'Isaac Asimov'],
    [
      'Memórias Póstumas de Brás Cubas, Machado de Assis',
      'Memórias Póstumas de Brás Cubas',
      'Machado de Assis',
    ],
  ])('reads %s', (text, title, author) => {
    expect(splitTitle(text)).toEqual({ title, author });
  });

  it('keeps everything as the title without a separator', () => {
    expect(splitTitle('Grande Sertão: Veredas')).toEqual({
      title: 'Grande Sertão: Veredas',
      author: null,
    });
    expect(splitTitle('Sem autor, ')).toEqual({ title: 'Sem autor, ', author: null });
  });
});

describe('byTitle', () => {
  it('sorts the way a Brazilian reader expects', () => {
    const titles = ['memórias', 'Ébano', 'Ensaio', 'A Hora', 'ebó', '"Berserk"'];
    const sorted = byTitle(titles.map((title) => ({ book: makeBook({ title }) })));
    expect(sorted.map((item) => item.book.title)).toEqual([
      'A Hora',
      '"Berserk"',
      'Ébano',
      'ebó',
      'Ensaio',
      'memórias',
    ]);
  });
});
