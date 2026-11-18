import { describe, expect, it, vi } from 'vitest';

import { BackendError } from '../backend';

import { interleave, searchCovers } from './search';
import type { Fetcher } from './types';

const openLibraryJson = {
  docs: [
    { title: 'Berserk Deluxe', cover_i: 1 },
    { title: 'Berserk vol. 2', cover_i: 2 },
  ],
};

const anilistJson = {
  data: {
    Page: {
      media: [
        {
          id: 9,
          title: { romaji: 'Berserk' },
          coverImage: { large: 'https://s4.anilist.co/b.jpg' },
        },
      ],
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Answers each catalog by host; `failing` hosts return HTTP 500. */
function fakeFetch(failing: string[] = []) {
  return vi.fn<Fetcher>((input) => {
    const host = new URL(input instanceof Request ? input.url : String(input)).host;
    if (failing.includes(host)) return Promise.resolve(jsonResponse({}, 500));
    if (host === 'openlibrary.org') return Promise.resolve(jsonResponse(openLibraryJson));
    if (host === 'graphql.anilist.co') return Promise.resolve(jsonResponse(anilistJson));
    return Promise.resolve(jsonResponse({ items: [] }));
  });
}

const titles = (options: { title: string }[]) => options.map((option) => option.title);

describe('searchCovers', () => {
  it('mixes results from every catalog, first ones first', async () => {
    const results = await searchCovers('berserk', {
      googleBooksApiKey: null,
      fetcher: fakeFetch(),
    });
    expect(titles(results)).toEqual(['Berserk Deluxe', 'Berserk', 'Berserk vol. 2']);
  });

  it('skips a catalog that fails', async () => {
    const fetcher = fakeFetch(['openlibrary.org']);
    const results = await searchCovers('berserk', { googleBooksApiKey: null, fetcher });
    expect(titles(results)).toEqual(['Berserk']);
  });

  it('fails only when every catalog fails', async () => {
    const fetcher = fakeFetch(['openlibrary.org', 'graphql.anilist.co']);
    await expect(searchCovers('berserk', { googleBooksApiKey: null, fetcher })).rejects.toThrow(
      BackendError,
    );
  });

  it('asks Google Books only when there is an API key', async () => {
    const withoutKey = fakeFetch();
    await searchCovers('berserk', { googleBooksApiKey: null, fetcher: withoutKey });
    expect(withoutKey).toHaveBeenCalledTimes(2);

    const withKey = fakeFetch();
    await searchCovers('berserk', { googleBooksApiKey: 'key', fetcher: withKey });
    expect(withKey).toHaveBeenCalledTimes(3);
  });

  it('does not search for very short queries', async () => {
    const fetcher = fakeFetch();
    expect(await searchCovers(' b ', { googleBooksApiKey: null, fetcher })).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('stops when the search is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const search = searchCovers('berserk', {
      googleBooksApiKey: null,
      fetcher: fakeFetch(),
      signal: controller.signal,
    });
    await expect(search).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('removes repeated images', async () => {
    const duplicated = {
      docs: [
        { title: 'A', cover_i: 1 },
        { title: 'B', cover_i: 1 },
      ],
    };
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve(jsonResponse(duplicated)));
    const results = await searchCovers('berserk', { googleBooksApiKey: null, fetcher });
    expect(titles(results)).toEqual(['A']);
  });
});

describe('interleave', () => {
  it('alternates between lists of different sizes', () => {
    expect(interleave([[1, 2, 3], [10], [20, 21]])).toEqual([1, 10, 20, 2, 21, 3]);
  });
});
