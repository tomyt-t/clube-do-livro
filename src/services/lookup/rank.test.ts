import { describe, expect, it } from 'vitest';

import { rankSynopses, type SourcedSynopsis } from './rank';

const PT =
  'Bentinho e Capitu crescem juntos no Rio de Janeiro e, ainda muito jovens, prometem casar um com o outro, apesar dos planos da mãe dele.';
const EN =
  'Bento Santiago tells the story of his life and of his love for Capitu, the girl next door, and of the jealousy that follows him.';

function found(raw: string, extra: Partial<SourcedSynopsis> = {}): SourcedSynopsis {
  return {
    synopsis: { raw, sourceUrl: 'https://example.com/livro' },
    source: 'google-books',
    publisher: null,
    ...extra,
  };
}

describe('rankSynopses', () => {
  it('offers every text, whole and in any language, Portuguese first', () => {
    const ranked = rankSynopses([found(EN, { source: 'publisher' }), found(PT)]);
    expect(ranked.map((option) => option.text)).toEqual([PT, EN]);
    expect(ranked[1]?.label).toBe('Site da editora · inglês');
  });

  it('keeps the same text once and names the part of the page', () => {
    const ranked = rankSynopses([
      found(PT, { source: 'wikipedia', part: 'início do enredo' }),
      found(`<p>${PT}</p>`, { source: 'publisher', publisher: 'Antofágica' }),
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.label).toBe('Site da Antofágica');
    expect(rankSynopses([found(PT, { source: 'wikipedia', part: 'introdução' })])[0]?.label).toBe(
      'Wikipédia · introdução',
    );
  });
});
