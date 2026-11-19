import { describe, expect, it } from 'vitest';

import { readWikipedia } from './wikipedia';

function page(index: number, title: string, extract: string) {
  return { index, title, fullurl: `https://pt.wikipedia.org/wiki/${title}`, extract };
}

describe('readWikipedia', () => {
  it('keeps books and leaves out articles about songs, films and shows', () => {
    const json = {
      query: {
        pages: [
          page(1, 'Coração Cachorro', 'Coração Cachorro é uma canção de forró eletrônico.'),
          page(2, 'Heart of a Dog', 'Heart of a Dog é um documentário estado-unidense.'),
          page(3, 'Dom Casmurro', 'Dom Casmurro é um romance escrito por Machado de Assis.'),
          page(4, 'Harry Potter', 'Harry Potter é uma série de livros de fantasia.'),
        ],
      },
    };
    expect(readWikipedia(json).map((candidate) => candidate.title)).toEqual([
      'Dom Casmurro',
      'Harry Potter',
    ]);
  });

  it('reads English leads too, without the Portuguese plot section', () => {
    const json = {
      query: {
        pages: [
          page(1, 'The Sailor (film)', 'The Sailor is a 1976 British drama film.'),
          page(2, 'The Sailor', 'The Sailor is a 1963 novel by Yukio Mishima.'),
        ],
      },
    };
    const [novel, ...rest] = readWikipedia(json, 'en');
    expect(rest).toEqual([]);
    expect(novel?.title).toBe('The Sailor');
    expect(novel?.article).toBeUndefined();
  });
});
