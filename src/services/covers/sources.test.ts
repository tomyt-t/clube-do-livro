import { describe, expect, it } from 'vitest';

import { anilistBody, readAniList } from './anilist';
import { googleBooksUrl, largerCover, readGoogleBooks } from './google-books';
import { joinDetails } from './http';
import { openLibraryUrl, readOpenLibrary } from './open-library';

describe('Open Library', () => {
  it('builds the search URL', () => {
    const url = new URL(openLibraryUrl('torto arado'));
    expect(url.searchParams.get('q')).toBe('torto arado');
  });

  it('keeps only results that have a cover', () => {
    const json = {
      docs: [
        {
          key: '/works/OL1W',
          title: 'Torto Arado',
          author_name: ['Itamar Vieira Junior'],
          first_publish_year: 2019,
          cover_i: 1,
        },
        { title: 'Sem capa', author_name: ['X'] },
      ],
    };
    expect(readOpenLibrary(json)).toEqual([
      {
        id: 'open-library:1',
        imageUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
        title: 'Torto Arado',
        details: 'Itamar Vieira Junior · 2019',
        source: 'open-library',
        synopsis: null,
        workKey: '/works/OL1W',
      },
    ]);
  });

  it('copes with unexpected payloads', () => {
    expect(readOpenLibrary({ docs: 'nope' })).toEqual([]);
    expect(readOpenLibrary(null)).toEqual([]);
  });
});

describe('Google Books', () => {
  it('sends the key and asks only for the fields it uses', () => {
    const url = new URL(googleBooksUrl('watchmen', 'secret'));
    expect(url.searchParams.get('key')).toBe('secret');
    expect(url.searchParams.get('fields')).toContain('imageLinks/thumbnail');
  });

  it('upgrades thumbnails to larger https images', () => {
    const thumbnail =
      'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl';
    const upgraded = new URL(largerCover(thumbnail) ?? '');
    expect(upgraded.protocol).toBe('https:');
    expect(upgraded.searchParams.has('edge')).toBe(false);
    expect(upgraded.searchParams.get('fife')).toBe('w600-h900');
  });

  it('reads volumes with a thumbnail', () => {
    const json = {
      items: [
        {
          id: 'abc',
          volumeInfo: {
            title: 'Watchmen',
            authors: ['Alan Moore'],
            publishedDate: '1987-09-01',
            description: '<p>Quem vigia os vigilantes?</p>',
            imageLinks: { thumbnail: 'http://books.google.com/books/content?id=abc' },
          },
        },
        { id: 'no-image', volumeInfo: { title: 'Sem capa' } },
      ],
    };
    const [option, ...rest] = readGoogleBooks(json);
    expect(rest).toEqual([]);
    expect(option).toMatchObject({
      id: 'google-books:abc',
      title: 'Watchmen',
      details: 'Alan Moore · 1987',
      source: 'google-books',
      synopsis: '<p>Quem vigia os vigilantes?</p>',
    });
  });
});

describe('AniList', () => {
  it('searches manga without adult titles', () => {
    const body = JSON.parse(anilistBody('berserk')) as { query: string; variables: unknown };
    expect(body.variables).toEqual({ search: 'berserk' });
    expect(body.query).toContain('isAdult: false');
  });

  it('prefers the English title and the largest cover', () => {
    const json = {
      data: {
        Page: {
          media: [
            {
              id: 30002,
              format: 'MANGA',
              title: { romaji: 'Berserk', english: 'Berserk' },
              description: 'Guts, the Black Swordsman.<br><br>(Source: Dark Horse)',
              coverImage: {
                extraLarge: 'https://s4.anilist.co/large.jpg',
                large: 'https://s4.anilist.co/medium.jpg',
              },
              startDate: { year: 1989 },
              staff: { nodes: [{ name: { full: 'Kentarou Miura' } }] },
            },
            { id: 2, title: { romaji: 'Inseguro' }, coverImage: { large: 'http://x/a.jpg' } },
          ],
        },
      },
    };
    expect(readAniList(json)).toEqual([
      {
        id: 'anilist:30002',
        imageUrl: 'https://s4.anilist.co/large.jpg',
        title: 'Berserk',
        details: 'Kentarou Miura · Mangá · 1989',
        source: 'anilist',
        synopsis: 'Guts, the Black Swordsman.<br><br>(Source: Dark Horse)',
        workKey: null,
      },
    ]);
  });
});

describe('joinDetails', () => {
  it('skips missing parts', () => {
    expect(joinDetails(['Alan Moore', null, undefined, '', 1987])).toBe('Alan Moore · 1987');
  });
});
