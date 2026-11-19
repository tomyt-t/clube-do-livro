import { describe, expect, it } from 'vitest';

import type { Winner } from '@/domain/types';
import { makeBook } from '@/test/factories';

import { materialsOf, shownSynopsis } from './materials';

const winner = (extra: Partial<Winner> = {}, book = {}): Winner => ({
  nominationId: 'n1',
  book: makeBook({ synopsis: 'Duas irmãs.', synopsisUrl: 'https://example.com/torto', ...book }),
  method: 'votes',
  decidedAt: new Date(),
  drawnFrom: [],
  ...extra,
});

describe('the reading materials', () => {
  it('default to the text and no PDF for readings chosen before', () => {
    expect(materialsOf(winner())).toEqual({ display: 'text', pdfUrl: null });
    expect(shownSynopsis(winner())).toBe('Duas irmãs.');
  });

  it('hide the text only when there is a link to show instead', () => {
    expect(shownSynopsis(winner({ display: 'link' }))).toBeNull();
    expect(shownSynopsis(winner({ display: 'link' }, { synopsisUrl: null }))).toBe('Duas irmãs.');
  });
});
