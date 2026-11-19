import { describe, expect, it } from 'vitest';

import type { CoverChoice, LookupResult, SynopsisChoice } from '@/services/lookup';

import {
  checkDraft,
  checkPicks,
  composeBook,
  coverIn,
  hasPickErrors,
  PASTE,
  synopsisIn,
  titleOf,
} from './draft';

const cover: CoverChoice = {
  url: 'https://cdn.shopify.com/capa.png?width=800',
  sourceUrl: 'https://aleph.com.br/products/duna',
  source: 'publisher',
  label: 'Site da editora · Aleph',
};

const synopsis: SynopsisChoice = {
  text: 'O jovem Paul Atreides parte para Arrakis.',
  sourceUrl: 'https://aleph.com.br/products/duna',
  source: 'publisher',
  label: 'Site da Aleph',
};

const draft = { title: ' Duna ', author: ' Frank Herbert ' };

describe('the typed title', () => {
  it('joins title and author the way the club stores them', () => {
    expect(titleOf(draft)).toBe('Duna, Frank Herbert');
    expect(titleOf({ title: 'Duna', author: ' ' })).toBe('Duna');
  });

  it('asks for a title, within the size limit', () => {
    expect(checkDraft(draft)).toBeNull();
    expect(checkDraft({ title: '  ', author: 'Frank Herbert' })).toBe(
      'Escreva o título da leitura.',
    );
    expect(checkDraft({ title: 'x'.repeat(150), author: 'y'.repeat(60) })).toBe(
      'Título e autor somam mais de 200 caracteres.',
    );
  });
});

describe('composeBook', () => {
  it('sends what was found with the pages it came from', () => {
    expect(
      composeBook(draft, { kind: 'found', cover }, { kind: 'found', option: synopsis }),
    ).toEqual({
      title: 'Duna, Frank Herbert',
      synopsis: 'O jovem Paul Atreides parte para Arrakis.',
      synopsisSource: 'publisher',
      synopsisUrl: 'https://aleph.com.br/products/duna',
      coverUrl: 'https://cdn.shopify.com/capa.png?width=800',
      coverSourceUrl: 'https://aleph.com.br/products/duna',
    });
  });

  it('keeps the credit and page of an edited text, and none for a pasted one', () => {
    const edited = { kind: 'own', text: 'Paul vai a Arrakis.', from: synopsis } as const;
    expect(composeBook(draft, { kind: 'none' }, edited)).toMatchObject({
      synopsis: 'Paul vai a Arrakis.',
      synopsisSource: 'publisher',
      synopsisUrl: 'https://aleph.com.br/products/duna',
      coverUrl: null,
      coverSourceUrl: null,
    });
    expect(composeBook(draft, { kind: 'none' }, { ...edited, from: null })).toMatchObject({
      synopsis: 'Paul vai a Arrakis.',
      synopsisSource: null,
      synopsisUrl: null,
    });
  });

  it('sends no synopsis when the box is left blank', () => {
    expect(composeBook(draft, { kind: 'none' }, { ...PASTE, text: '  ' })).toMatchObject({
      synopsis: null,
      synopsisSource: null,
      synopsisUrl: null,
    });
  });
});

describe('checkPicks', () => {
  it('lets what was found go as it is', () => {
    const errors = checkPicks(draft, { kind: 'found', cover }, { kind: 'found', option: synopsis });
    expect(hasPickErrors(errors)).toBe(false);
  });

  it('asks where an uploaded image came from', () => {
    const upload = {
      kind: 'upload',
      dataUrl: 'data:image/jpeg;base64,/9j/',
      sourceUrl: '',
    } as const;
    expect(checkPicks(draft, upload, PASTE).coverSource).toBe(
      'Cole o link da página de onde veio a imagem.',
    );
    expect(checkPicks(draft, { ...upload, sourceUrl: 'loja.com/duna' }, PASTE).coverSource).toBe(
      'Use um link completo, começando com https://.',
    );
  });

  it('never asks where a pasted synopsis came from, only that it fits', () => {
    expect(checkPicks(draft, { kind: 'none' }, { ...PASTE, text: 'Paul.' })).toEqual({
      coverSource: null,
      synopsisText: null,
    });
    const long = { ...PASTE, text: 'x'.repeat(2001) };
    expect(checkPicks(draft, { kind: 'none' }, long).synopsisText).toBe(
      'Use até 2.000 caracteres.',
    );
  });
});

describe('picks saved before the search ran again', () => {
  const result: LookupResult = {
    work: null,
    covers: [{ ...cover }],
    synopses: [{ ...synopsis }],
    others: [],
  };

  it('are found again among the new results by their page and text', () => {
    const [newCover] = result.covers;
    const [newSynopsis] = result.synopses;
    const coverAgain = coverIn(result, { kind: 'found', cover });
    expect(coverAgain.kind === 'found' && coverAgain.cover).toBe(newCover);
    const again = synopsisIn(result, { kind: 'found', option: synopsis });
    expect(again.kind === 'found' && again.option).toBe(newSynopsis);
  });

  it('give way to the best found when they are gone, and keep a pasted text', () => {
    const gone = { ...synopsis, text: 'Outro texto.' };
    expect(synopsisIn(result, { kind: 'found', option: gone })).toEqual({
      kind: 'found',
      option: synopsis,
    });
    const pasted = { ...PASTE, text: 'Colado.' };
    expect(synopsisIn(result, pasted)).toBe(pasted);
    expect(synopsisIn(null, null)).toEqual(PASTE);
    expect(coverIn(null, null)).toEqual({ kind: 'none' });
  });
});
