import { describe, expect, it, vi } from 'vitest';

import type { CoverOption, Fetcher } from '../covers/types';

import { findSynopsis, readOpenLibraryWork, readWikipediaSummary, wikipediaSummaryUrl } from '.';
import { fitToLimit, toPlainText } from './text';

function option(overrides: Partial<CoverOption> = {}): CoverOption {
  return {
    id: 'open-library:1',
    imageUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
    title: 'Torto Arado',
    details: '',
    source: 'open-library',
    synopsis: null,
    workKey: '/works/OL1W',
    ...overrides,
  };
}

/** Answers each URL with the given JSON; any other URL fails like a network error. */
function fakeFetch(responses: Record<string, unknown>): Fetcher {
  return vi.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!(url in responses)) return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(new Response(JSON.stringify(responses[url])));
  });
}

const SUMMARY = 'https://pt.wikipedia.org/api/rest_v1/page/summary/Torto_Arado';
const WORK = 'https://openlibrary.org/works/OL1W.json';

describe('toPlainText', () => {
  it('turns catalog HTML into paragraphs', () => {
    expect(toPlainText('<p>Um <i>romance</i> &amp; mais.</p><p>Outro&nbsp;parágrafo.</p>')).toBe(
      'Um romance & mais.\n\nOutro parágrafo.',
    );
    expect(toPlainText('Linha um<br>Linha dois<br/><br />Fim &#8212; &#x2014;')).toBe(
      'Linha um\nLinha dois\n\nFim — —',
    );
  });

  it('drops credits, extras and Markdown', () => {
    expect(toPlainText('Guts luta.<br><br>(Source: Dark Horse)')).toBe('Guts luta.');
    expect(
      toPlainText('A **saga** de [Arthur](https://x.org).\n----------\nContains: vol. 1'),
    ).toBe('A saga de Arthur.');
  });

  it('cuts long texts at the last full sentence that fits', () => {
    const text = `${'Frase curta. '.repeat(10)}Uma última frase que não cabe.`;
    expect(fitToLimit(text, 140)).toBe('Frase curta. '.repeat(10).trimEnd());
    expect(fitToLimit('x'.repeat(50), 20)).toBe(`${'x'.repeat(19)}…`);
  });
});

describe('wikipediaSummaryUrl', () => {
  it('reads article links in any language, mobile included', () => {
    expect(wikipediaSummaryUrl('https://pt.wikipedia.org/wiki/Torto_Arado')).toBe(SUMMARY);
    expect(wikipediaSummaryUrl('https://en.m.wikipedia.org/wiki/Berserk_(manga)')).toBe(
      'https://en.wikipedia.org/api/rest_v1/page/summary/Berserk_(manga)',
    );
  });

  it.each([
    'https://example.com/wiki/Torto_Arado',
    'https://pt.wikipedia.org/w/index.php?title=Torto_Arado',
    'https://pt.wikipedia.org.evil.com/wiki/Torto_Arado',
    'http://pt.wikipedia.org/wiki/Torto_Arado',
    'não é link',
  ])('ignores %s', (link) => {
    expect(wikipediaSummaryUrl(link)).toBeNull();
  });
});

describe('readers', () => {
  it('skips disambiguation pages', () => {
    expect(readWikipediaSummary({ type: 'standard', extract: 'Romance.' })).toBe('Romance.');
    expect(readWikipediaSummary({ type: 'disambiguation', extract: 'Pode ser...' })).toBeNull();
  });

  it('reads Open Library descriptions in both shapes', () => {
    expect(readOpenLibraryWork({ description: 'Texto.' })).toBe('Texto.');
    expect(readOpenLibraryWork({ description: { type: '/type/text', value: 'Texto.' } })).toBe(
      'Texto.',
    );
    expect(readOpenLibraryWork({})).toBeNull();
  });
});

describe('findSynopsis', () => {
  const link = 'https://pt.wikipedia.org/wiki/Torto_Arado';

  it('prefers the Wikipedia article the member linked', async () => {
    const fetcher = fakeFetch({ [SUMMARY]: { type: 'standard', extract: 'Romance de 2019.' } });
    expect(await findSynopsis({ link, option: option() }, { fetcher })).toEqual({
      text: 'Romance de 2019.',
      source: 'wikipedia',
    });
  });

  it('falls back to the synopsis sent with the chosen cover', async () => {
    const anilist = option({ source: 'anilist', synopsis: 'Guts.<br>(Source: X)', workKey: null });
    expect(await findSynopsis({ link, option: anilist }, { fetcher: fakeFetch({}) })).toEqual({
      text: 'Guts.',
      source: 'anilist',
    });
  });

  it('fetches the Open Library work only when needed', async () => {
    const fetcher = fakeFetch({ [WORK]: { description: { value: 'Duas irmãs.' } } });
    expect(await findSynopsis({ link: null, option: option() }, { fetcher })).toEqual({
      text: 'Duas irmãs.',
      source: 'open-library',
    });
  });

  it('finds nothing, quietly, when every source fails or is missing', async () => {
    const fetcher = fakeFetch({});
    expect(await findSynopsis({ link, option: option() }, { fetcher })).toBeNull();
    expect(await findSynopsis({ link: null, option: null }, { fetcher })).toBeNull();
    expect(
      await findSynopsis({ link: null, option: option({ workKey: '/../evil' }) }, { fetcher }),
    ).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
