import { describe, expect, it } from 'vitest';

import type { CoverOption } from '@/services/covers';

import { checkDraft, composeBook } from './draft';

const option: CoverOption = {
  id: 'anilist:1',
  imageUrl: 'https://s4.anilist.co/capa.jpg',
  title: 'Berserk',
  details: '',
  source: 'anilist',
  synopsis: null,
  workKey: null,
};

describe('checkDraft', () => {
  it('accepts a title alone', () => {
    expect(checkDraft({ title: 'Berserk, Kentaro Miura', link: '' })).toEqual({
      title: null,
      link: null,
    });
  });

  it('explains what to fix in each field', () => {
    expect(checkDraft({ title: '   ', link: 'pt.wikipedia.org/wiki/Berserk' })).toEqual({
      title: 'Escreva o título e, se quiser, o autor.',
      link: 'Use um link completo, começando com https://.',
    });
    expect(checkDraft({ title: 'x'.repeat(201), link: '' }).title).toBe('Use até 200 caracteres.');
  });
});

describe('composeBook', () => {
  it('puts together the typed text, the chosen cover and the synopsis', () => {
    const book = composeBook(
      { title: ' Berserk,  Kentaro Miura ', link: ' ' },
      { kind: 'catalog', option },
      { text: ' Guts. ', source: 'anilist' },
    );
    expect(book).toEqual({
      title: 'Berserk, Kentaro Miura',
      synopsis: 'Guts.',
      synopsisSource: 'anilist',
      synopsisUrl: null,
      coverUrl: 'https://s4.anilist.co/capa.jpg',
    });
  });

  it('drops the credit when the synopsis was erased', () => {
    const book = composeBook(
      { title: 'Berserk', link: '' },
      { kind: 'none' },
      { text: '', source: 'anilist' },
    );
    expect(book).toMatchObject({ coverUrl: null, synopsis: null, synopsisSource: null });
  });
});
