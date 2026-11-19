import { describe, expect, it } from 'vitest';

import {
  FRESH,
  progressKey,
  readProgress,
  toProgress,
  writeProgress,
  type NominationProgress,
  type ProgressStore,
} from './saved-nomination';

function memoryStore(): ProgressStore & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

const refusing: ProgressStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const KEY = progressKey('ciclo-4', 'marina');

const midway: NominationProgress = {
  stage: 'review',
  draft: { title: 'Duna', author: 'Frank Herbert' },
  cover: { kind: 'upload', dataUrl: 'data:image/jpeg;base64,AAAA', sourceUrl: '' },
  synopsis: {
    kind: 'own',
    text: 'Paul vai a Arrakis.',
    from: {
      text: 'O jovem Paul Atreides parte para Arrakis.',
      sourceUrl: 'https://aleph.com.br/products/duna',
      source: 'publisher',
      label: 'Site da Aleph',
    },
  },
};

describe('the nomination in progress', () => {
  it('is kept per round and per member', () => {
    expect(KEY).toBe('clube:indicacao:ciclo-4:marina');
    expect(progressKey('ciclo-4', 'rafa')).not.toBe(KEY);
  });

  it('comes back as it was left: step, title, uploaded cover and edited synopsis', () => {
    const store = memoryStore();
    writeProgress(store, KEY, midway);
    expect(readProgress(store, KEY)).toEqual(midway);
  });

  it('leaves nothing behind once cleared', () => {
    const store = memoryStore();
    writeProgress(store, KEY, midway);
    writeProgress(store, KEY, FRESH);
    expect(store.items.size).toBe(0);
    expect(readProgress(store, KEY)).toBe(FRESH);
  });

  it('starts over when storage is missing, blocked or holds something else', () => {
    expect(readProgress(null, KEY)).toBe(FRESH);
    expect(readProgress(refusing, KEY)).toBe(FRESH);
    expect(() => {
      writeProgress(refusing, KEY, midway);
    }).not.toThrow();
    const store = memoryStore();
    store.setItem(KEY, '{not json');
    expect(readProgress(store, KEY)).toBe(FRESH);
    expect(toProgress({ stage: 'sending', draft: midway.draft })).toBe(FRESH);
    expect(toProgress({ stage: 'details', draft: { title: 3 } })).toBe(FRESH);
  });

  it('drops picks it cannot read, keeping the title', () => {
    const odd = {
      stage: 'review',
      draft: midway.draft,
      cover: { kind: 'found', cover: { url: 'https://x.com/a.jpg' } },
      synopsis: { kind: 'found', option: { text: 'Oi', source: 'blog' } },
    };
    expect(toProgress(odd)).toEqual({ ...midway, cover: null, synopsis: null });
  });
});
