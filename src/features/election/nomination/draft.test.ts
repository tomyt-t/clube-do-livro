import { describe, expect, it } from 'vitest';

import type { CoverChoice, SynopsisChoice } from '@/services/lookup';

import { checkDraft, checkPicks, composeBook, hasPickErrors, titleOf } from './draft';

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

  it('keeps the credit of an edited text, and none for one written from scratch', () => {
    const edited = {
      kind: 'own',
      text: 'Paul vai a Arrakis.',
      sourceUrl: synopsis.sourceUrl,
      from: synopsis,
    } as const;
    expect(composeBook(draft, { kind: 'none' }, edited)).toMatchObject({
      synopsis: 'Paul vai a Arrakis.',
      synopsisSource: 'publisher',
      coverUrl: null,
      coverSourceUrl: null,
    });
    const written = { ...edited, from: null, sourceUrl: 'https://example.com/duna' };
    expect(composeBook(draft, { kind: 'none' }, written)).toMatchObject({
      synopsisSource: null,
      synopsisUrl: 'https://example.com/duna',
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
    expect(checkPicks(draft, upload, { kind: 'none' }).coverSource).toBe(
      'Cole o link da página de onde veio a imagem.',
    );
    expect(
      checkPicks(draft, { ...upload, sourceUrl: 'loja.com/duna' }, { kind: 'none' }).coverSource,
    ).toBe('Use um link completo, começando com https://.');
  });

  it('asks for the text and the page of a synopsis the member writes', () => {
    const blank = { kind: 'own', text: ' ', sourceUrl: '', from: null } as const;
    expect(checkPicks(draft, { kind: 'none' }, blank)).toEqual({
      coverSource: null,
      synopsisText: 'Escreva a sinopse, ou escolha “Sem sinopse”.',
      synopsisLink: null,
    });
    expect(checkPicks(draft, { kind: 'none' }, { ...blank, text: 'Paul.' }).synopsisLink).toBe(
      'Cole o link da página de onde veio a sinopse.',
    );
  });
});
