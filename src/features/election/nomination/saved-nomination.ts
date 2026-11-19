import { useEffect, useState } from 'react';

import { SYNOPSIS_SOURCES } from '@/domain/book';
import type { CycleId, MemberId, SynopsisSource } from '@/domain/types';
import type { CoverChoice, SynopsisChoice } from '@/services/lookup';

import { EMPTY_DRAFT, type CoverPick, type Draft, type SynopsisPick } from './draft';

export type Stage = 'choose' | 'details' | 'review';

/** How far the member got in nominating: kept while the browser tab lives. */
export interface NominationProgress {
  stage: Stage;
  draft: Draft;
  /** Null until the member picks one: the best found is used. */
  cover: CoverPick | null;
  synopsis: SynopsisPick | null;
}

export const FRESH: NominationProgress = {
  stage: 'choose',
  draft: EMPTY_DRAFT,
  cover: null,
  synopsis: null,
};

/** Per round and per member, so someone signing in after them never sees it. */
export const progressKey = (cycleId: CycleId, uid: MemberId) => `clube:indicacao:${cycleId}:${uid}`;

export type ProgressStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// ------------------------------------------------------------- reading back

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const STAGES: readonly unknown[] = ['choose', 'details', 'review'] satisfies Stage[];

function toSource(value: unknown): SynopsisSource | null {
  return SYNOPSIS_SOURCES.find((source) => source === value) ?? null;
}

function toCoverChoice(value: unknown): CoverChoice | null {
  if (!isFields(value)) return null;
  const { url, sourceUrl, label } = value;
  const source = toSource(value.source);
  if (!isText(url) || !isText(sourceUrl) || !isText(label) || !source) return null;
  return { url, sourceUrl, label, source };
}

function toSynopsisChoice(value: unknown): SynopsisChoice | null {
  if (!isFields(value)) return null;
  const { text, sourceUrl, label } = value;
  const source = toSource(value.source);
  if (!isText(text) || !isText(sourceUrl) || !isText(label) || !source) return null;
  return { text, sourceUrl, label, source };
}

function toCoverPick(value: unknown): CoverPick | null {
  if (!isFields(value)) return null;
  if (value.kind === 'none') return { kind: 'none' };
  const { dataUrl, sourceUrl } = value;
  if (value.kind === 'upload' && isText(dataUrl) && isText(sourceUrl)) {
    return { kind: 'upload', dataUrl, sourceUrl };
  }
  const cover = value.kind === 'found' ? toCoverChoice(value.cover) : null;
  return cover ? { kind: 'found', cover } : null;
}

function toSynopsisPick(value: unknown): SynopsisPick | null {
  if (!isFields(value)) return null;
  if (value.kind === 'own' && isText(value.text)) {
    return { kind: 'own', text: value.text, from: toSynopsisChoice(value.from) };
  }
  const option = value.kind === 'found' ? toSynopsisChoice(value.option) : null;
  return option ? { kind: 'found', option } : null;
}

/** Anything unreadable (another version's shape, a hand edit) starts over. */
export function toProgress(value: unknown): NominationProgress {
  if (!isFields(value) || !STAGES.includes(value.stage)) return FRESH;
  const { draft } = value;
  if (!isFields(draft) || !isText(draft.title) || !isText(draft.author)) return FRESH;
  return {
    stage: value.stage as Stage,
    draft: { title: draft.title, author: draft.author },
    cover: toCoverPick(value.cover),
    synopsis: toSynopsisPick(value.synopsis),
  };
}

// ---------------------------------------------------------------- storage

/** The tab's session storage, or none (blocked, private window, no window). */
function sessionStore(): ProgressStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readProgress(store: ProgressStore | null, key: string): NominationProgress {
  try {
    const saved = store?.getItem(key);
    return saved ? toProgress(JSON.parse(saved)) : FRESH;
  } catch {
    return FRESH;
  }
}

/** Saving is a convenience: when storage refuses (full, blocked), the page goes on without it. */
export function writeProgress(
  store: ProgressStore | null,
  key: string,
  progress: NominationProgress,
) {
  try {
    if (progress === FRESH) store?.removeItem(key);
    else store?.setItem(key, JSON.stringify(progress));
  } catch {
    // Nothing to do: the draft just will not survive leaving the page.
  }
}

/**
 * The nomination in progress, restored when the member comes back to the
 * page in the same tab (switching to "Lendo" unmounts the form).
 */
export function useSavedNomination(cycleId: CycleId, uid: MemberId) {
  const key = progressKey(cycleId, uid);
  const [progress, setProgress] = useState<NominationProgress>(() =>
    readProgress(sessionStore(), key),
  );

  useEffect(() => {
    writeProgress(sessionStore(), key, progress);
  }, [key, progress]);

  const update = (change: Partial<NominationProgress>) => {
    setProgress((current) => ({ ...current, ...change }));
  };

  /** After the answer is sent: nothing left to restore. */
  const clear = () => {
    writeProgress(sessionStore(), key, FRESH);
    setProgress(FRESH);
  };

  return { progress, update, clear };
}
