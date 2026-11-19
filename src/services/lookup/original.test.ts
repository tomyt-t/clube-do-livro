import { describe, expect, it } from 'vitest';

import { englishTitle, pickWork } from './original';

const SEARCH = {
  search: [
    { id: 'Q1', label: 'O Marinheiro que Perdeu as Graças do Mar', description: 'filme de 1976' },
    {
      id: 'Q2397134',
      label: 'O Marinheiro que Perdeu as Graças do Mar',
      description: 'novel by Yukio Mishima',
    },
  ],
};

const query = { title: 'O marinheiro que perdeu as graças do mar', author: null };

describe('pickWork', () => {
  it('takes the reading with the title typed, by the author typed', () => {
    expect(pickWork(query, SEARCH)).toBe('Q2397134');
    expect(pickWork({ ...query, author: 'Yukio Mishima' }, SEARCH)).toBe('Q2397134');
    expect(pickWork({ ...query, author: 'Clarice Lispector' }, SEARCH)).toBeNull();
    expect(pickWork({ title: 'Coração de Cão', author: null }, SEARCH)).toBeNull();
  });
});

describe('englishTitle', () => {
  it("asks Wikidata for the work's English title", async () => {
    const labels = {
      entities: {
        Q2397134: { labels: { en: { value: 'The Sailor Who Fell from Grace with the Sea' } } },
      },
    };
    const fetcher = ((input: string) => {
      const body = input.includes('wbsearchentities') ? SEARCH : labels;
      return Promise.resolve(new Response(JSON.stringify(body)));
    }) as typeof fetch;
    await expect(englishTitle(query, { fetcher })).resolves.toBe(
      'The Sailor Who Fell from Grace with the Sea',
    );
  });
});
