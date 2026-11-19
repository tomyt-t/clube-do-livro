import { toPlainText } from './text';

import { detectLanguage, type TextLanguage } from './language';
import {
  isAdaptation,
  isBrazilianIsbn,
  isPortugueseIsbn,
  mainTitle,
  matchAuthor,
  matchTitle,
  normalize,
} from './match';
import type {
  Candidate,
  CoverChoice,
  FoundSynopsis,
  LookupSource,
  MeasureImage,
  Query,
  SynopsisChoice,
  WorkSummary,
} from './types';

/**
 * Picking the reading, then its best cover and synopsis, from what every
 * catalog returned. Results that do not match the title (and the author,
 * when typed) are dropped first; the rest are grouped into works, and the
 * cover and synopsis always come from inside the chosen work, so a stray
 * result can never lend its picture or text.
 */

export const SOURCE_NAMES: Record<LookupSource, string> = {
  publisher: 'Site da editora',
  'google-books': 'Google Livros',
  'open-library': 'Open Library',
  wikipedia: 'Wikipédia',
  anilist: 'AniList',
};

export interface Matched {
  candidate: Candidate;
  exact: boolean;
  author: boolean | null;
}

function mentionsAuthor(typed: string | null, mentions: string | null): boolean | null {
  if (!typed || !mentions) return null;
  const words = normalize(typed)
    .split(' ')
    .filter((word) => word.length >= 4);
  const surname = words[words.length - 1];
  return surname && ` ${mentions} `.includes(` ${surname} `) ? true : null;
}

/** Keeps only results for the reading typed: the title must match; a typed author must not differ. */
export function gate(query: Query, candidates: readonly Candidate[]): Matched[] {
  return candidates.flatMap((candidate) => {
    const title = matchTitle(query.title, candidate.titles);
    if (!title.matches) return [];
    const author =
      matchAuthor(query.author, candidate.authors) ??
      mentionsAuthor(query.author, candidate.mentions);
    if (author === false) return [];
    return [{ candidate, exact: title.exact, author }];
  });
}

export interface Work {
  key: string;
  members: Matched[];
  score: number;
}

const surnames = (authors: readonly string[]) =>
  new Set(
    authors.flatMap((name) =>
      normalize(name)
        .split(' ')
        .filter((word) => word.length >= 3),
    ),
  );

/** Same main title, compatible authors, and both adaptations or neither. */
function belongsTo(work: Work, item: Matched): boolean {
  const { candidate } = item;
  const key = mainTitle(candidate.title) + (isAdaptation(candidate.title) ? '#adaptacao' : '');
  if (key !== work.key) return false;
  const theirs = surnames(work.members.flatMap((m) => m.candidate.authors));
  const mine = surnames(candidate.authors);
  if (mine.size === 0 || theirs.size === 0) return true;
  return [...mine].some((word) => theirs.has(word));
}

export function groupWorks(items: readonly Matched[]): Work[] {
  const works: Work[] = [];
  // Results with authors first, so the encyclopedia joins the right work.
  const ordered = [...items].sort(
    (a, b) => b.candidate.authors.length - a.candidate.authors.length,
  );
  for (const item of ordered) {
    const work = works.find((candidateWork) => belongsTo(candidateWork, item));
    if (work) work.members.push(item);
    else {
      const adaptation = isAdaptation(item.candidate.title) ? '#adaptacao' : '';
      works.push({ key: mainTitle(item.candidate.title) + adaptation, members: [item], score: 0 });
    }
  }
  return works;
}

function workScore(work: Work, query: Query): number {
  const { members } = work;
  const sources = new Set(members.map((m) => m.candidate.source)).size;
  const wantsAdaptation = isAdaptation(query.title);
  return (
    (members.some((m) => m.exact) ? 3 : 0) +
    (members.some((m) => m.author === true) ? 2 : 0) +
    (sources - 1) +
    (members.some((m) => isBrazilianIsbn(m.candidate.isbn)) ? 1 : 0) +
    (members.some((m) => m.candidate.kind !== 'other') ? 1 : -2) +
    (work.key.endsWith('#adaptacao') && !wantsAdaptation ? -2 : 0)
  );
}

export function rankWorks(works: readonly Work[], query: Query): Work[] {
  return works
    .map((work) => ({ ...work, score: workScore(work, query) }))
    .sort((a, b) => b.score - a.score || b.members.length - a.members.length);
}

/** "Todavia, 2019". */
function detailsOf(candidate: Candidate): string {
  return [candidate.publisher, candidate.year].filter((part) => part !== null).join(', ');
}

export function summarize(work: Work): WorkSummary {
  const candidates = work.members.map((m) => m.candidate);
  const best = candidates.find((c) => c.authors.length > 0) ?? candidates[0];
  const edition = candidates.find((c) => isBrazilianIsbn(c.isbn)) ?? best;
  return {
    title: best?.title ?? '',
    authors: best?.authors ?? [],
    details: edition ? detailsOf(edition) : '',
  };
}

// ------------------------------------------------------------------ covers

/** Google's "image not available" pictures come in these sizes. */
const PLACEHOLDERS = new Set(['128x170', '300x391', '575x750', '800x1043', '1280x1670']);

function editionTier(candidate: Candidate): number {
  if (isBrazilianIsbn(candidate.isbn)) return 3;
  if (candidate.source === 'anilist' || isPortugueseIsbn(candidate.isbn)) return 2;
  return 1;
}

const COVER_TRUST: Record<LookupSource, number> = {
  publisher: 2,
  'google-books': 2,
  'open-library': 2,
  anilist: 2,
  wikipedia: 0,
};

const isBookShaped = ({ width, height }: { width: number; height: number }) =>
  width >= 150 &&
  height / width >= 1.2 &&
  height / width <= 1.9 &&
  !PLACEHOLDERS.has(`${String(width)}x${String(height)}`);

/** The work's covers that load and look like covers, best first (Brazilian editions lead). */
export async function rankCovers(work: Work, measure: MeasureImage): Promise<CoverChoice[]> {
  const seen = new Set<string>();
  const found = work.members
    .map((m) => m.candidate)
    .filter((candidate) => {
      const url = candidate.cover?.url;
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  const sized = await Promise.all(
    found.map(async (candidate) => ({
      candidate,
      size: await measure(candidate.cover?.url ?? ''),
    })),
  );
  return sized
    .filter(({ size }) => size !== null && isBookShaped(size))
    .map(({ candidate, size }) => ({
      candidate,
      score:
        editionTier(candidate) * 10 +
        COVER_TRUST[candidate.source] +
        Math.min(size?.height ?? 0, 900) / 300,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ candidate }) => ({
      url: candidate.cover?.url ?? '',
      sourceUrl: candidate.cover?.sourceUrl ?? '',
      source: candidate.source,
      label: [SOURCE_NAMES[candidate.source], detailsOf(candidate)].filter(Boolean).join(' · '),
    }));
}

// ---------------------------------------------------------------- synopses

const LANGUAGE_WEIGHT: Record<TextLanguage, number> = {
  'pt-BR': 1,
  'pt-PT': 0.8,
  en: 0.3,
  other: 0,
};
const LANGUAGE_NAMES: Record<TextLanguage, string> = {
  'pt-BR': 'português',
  'pt-PT': 'português de Portugal',
  en: 'inglês',
  other: 'outro idioma',
};

/** The publisher's own site first, then Google Books (publishers' texts), then the others. */
const SOURCE_ORDER: Record<LookupSource, number> = {
  publisher: 4,
  'google-books': 3,
  wikipedia: 2,
  'open-library': 1,
  anilist: 1,
};

/** Enough options to compare, without the same publisher text once per edition. */
const MOST_PER_SOURCE: Record<LookupSource, number> = {
  publisher: 3,
  'google-books': 3,
  wikipedia: 2,
  'open-library': 1,
  anilist: 1,
};

const MOST_SYNOPSES = 8;

export interface SourcedSynopsis {
  synopsis: FoundSynopsis;
  source: LookupSource;
  publisher: string | null;
  /** Which part of the page it is, when a source gives more than one ("início do enredo"). */
  part?: string;
}

function synopsisLabel(found: SourcedSynopsis, language: TextLanguage) {
  const { source, publisher, part } = found;
  let where = SOURCE_NAMES[source];
  if (publisher && source === 'publisher') where = `Site da ${publisher}`;
  else if (publisher) where = `${where} · ${publisher}`;
  if (part) where = `${where} · ${part}`;
  return language === 'pt-BR' ? where : `${where} · ${LANGUAGE_NAMES[language]}`;
}

interface Option {
  choice: SynopsisChoice;
  source: LookupSource;
  score: number;
}

function optionOf(found: SourcedSynopsis): Option | null {
  const text = toPlainText(found.synopsis.raw);
  if (!text) return null;
  const language = detectLanguage(text);
  const { source } = found;
  const score =
    LANGUAGE_WEIGHT[language] * 10 + SOURCE_ORDER[source] + (text.length >= 150 ? 2 : 0);
  const choice = {
    text,
    sourceUrl: found.synopsis.sourceUrl,
    source,
    label: synopsisLabel(found, language),
  };
  return { choice, source, score };
}

/**
 * Every synopsis found for the work, whole and in any language: Portuguese
 * first, then by source. The same text once, a few per source.
 */
export function rankSynopses(found: readonly SourcedSynopsis[]): SynopsisChoice[] {
  const seen = new Set<string>();
  const perSource = new Map<LookupSource, number>();
  return found
    .map(optionOf)
    .filter((option) => option !== null)
    .sort((a, b) => b.score - a.score)
    .filter(({ choice, source }) => {
      const key = normalize(choice.text).slice(0, 80);
      const count = perSource.get(source) ?? 0;
      if (seen.has(key) || count >= MOST_PER_SOURCE[source]) return false;
      seen.add(key);
      perSource.set(source, count + 1);
      return true;
    })
    .slice(0, MOST_SYNOPSES)
    .map(({ choice }) => choice);
}
