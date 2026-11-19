import { describe, expect, it } from 'vitest';

import { looseGate, rankSynopses, summarize, type SourcedSynopsis } from './rank';
import type { Candidate } from './types';

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
    expect(ranked.map((option) => option.foreign)).toEqual([undefined, true]);
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

function edition(authors: string[], publisher: string | null = null): Candidate {
  return {
    source: 'open-library',
    titles: ['Dom Casmurro'],
    title: 'Dom Casmurro',
    authors,
    mentions: null,
    publisher,
    year: null,
    isbn: null,
    kind: 'book',
    cover: null,
    synopsis: null,
  };
}

describe('summarize', () => {
  it('names the author the catalogs agree on, not a stray co-author', () => {
    const members = [
      edition(['Adiel de Jesus', 'Machado ASSIS'], 'L&PM'),
      edition(['Machado de Assis']),
      edition(['Machado de Assis'], 'Antofágica'),
    ].map((candidate) => ({ candidate, exact: true, author: true }));
    expect(summarize({ key: 'dom casmurro', members, score: 0 }).authors).toEqual([
      'Machado de Assis',
    ]);
  });

  it('shows the plainest title that matched exactly', () => {
    const members = [
      { candidate: { ...edition(['Kentaro Miura']), title: 'Berserk: 4. 19' }, exact: true },
      { candidate: { ...edition(['Kentaro Miura']), title: 'Berserk' }, exact: true },
      { candidate: { ...edition([]), title: 'B' }, exact: false },
    ].map((member) => ({ ...member, author: true }));
    expect(summarize({ key: 'berserk', members, score: 0 }).title).toBe('Berserk');
  });

  it('lists an author once, whatever the accents', () => {
    const members = [edition(['Itamar Vieira Junior', 'Itamar Vieira Júnior'])].map(
      (candidate) => ({ candidate, exact: true, author: true }),
    );
    expect(summarize({ key: 'torto arado', members, score: 0 }).authors).toEqual([
      'Itamar Vieira Júnior',
    ]);
  });
});

describe('looseGate', () => {
  const titled = (title: string, authors: string[]): Candidate => ({
    ...edition(authors),
    titles: [title],
    title,
  });
  const dogHeart = titled('Coração de Cão', ['Mikhail Bulgakov']);

  it("takes another translation's title, only with the author typed", () => {
    expect(
      looseGate({ title: 'Coração de Cachorro', author: 'Mikhail Bulgákov' }, [dogHeart]),
    ).toHaveLength(1);
    expect(looseGate({ title: 'Coração de Cachorro', author: null }, [dogHeart])).toHaveLength(0);
    expect(
      looseGate({ title: 'Coração de Cachorro', author: 'Clarice Lispector' }, [dogHeart]),
    ).toHaveLength(0);
    expect(
      looseGate({ title: 'O Mestre e Margarida', author: 'Bulgakov' }, [dogHeart]),
    ).toHaveLength(0);
  });

  it('keeps volumes apart', () => {
    const second = titled('Os Mercenários 2', ['Ana Souza']);
    expect(
      looseGate({ title: 'Mercenários do Sul 1', author: 'Ana Souza' }, [second]),
    ).toHaveLength(0);
    expect(
      looseGate({ title: 'Mercenários do Sul 2', author: 'Ana Souza' }, [second]),
    ).toHaveLength(1);
  });
});
