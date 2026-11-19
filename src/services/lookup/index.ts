import { splitTitle } from '@/domain/book';

import { searchAniList } from './anilist';
import { searchGoogleBooks } from './google-books';
import { searchOpenLibrary, workDescription } from './open-library';
import { englishTitle } from './original';
import { searchPublishers } from './publishers';
import {
  gate,
  groupWorks,
  looseGate,
  rankCovers,
  rankSynopses,
  rankWorks,
  summarize,
  type Matched,
  type SourcedSynopsis,
  type Work,
} from './rank';
import type { Candidate, Fetcher, LookupResult, MeasureImage, Query, SourceRequest } from './types';
import { plotSynopsis, searchWikipedia } from './wikipedia';

export type { CoverChoice, LookupResult, LookupSource, SynopsisChoice, WorkSummary } from './types';

/**
 * Finding a nomination's cover and synopsis from its title alone, by
 * ordinary lookups in public catalogs (no language model): every catalog
 * is asked at once, results that are not this reading are dropped, and the
 * best cover and synopsis of the chosen reading come back ranked, each with
 * its source. Nothing found is a normal outcome.
 */

export interface LookupOptions {
  googleBooksApiKey: string | null;
  measure: MeasureImage;
  fetcher?: Fetcher;
  signal?: AbortSignal;
  /** Per catalog; a slow one is skipped rather than waited for. */
  timeoutMs?: number;
}

export const NOTHING_FOUND: LookupResult = { work: null, covers: [], synopses: [], others: [] };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('demorou demais')), ms)),
  ]);
}

type Search = (query: Query, request: SourceRequest) => Promise<Candidate[]>;

const timeoutOf = (options: LookupOptions) => options.timeoutMs ?? 8000;

function withGoogle(apiKey: string | null, free: Search[]): Search[] {
  return apiKey ? [(query, request) => searchGoogleBooks(query, apiKey, request), ...free] : free;
}

/** Under the title typed: every catalog. */
const searchesFor = (apiKey: string | null) =>
  withGoogle(apiKey, [searchPublishers, searchOpenLibrary, searchWikipedia, searchAniList]);

/** Under the work's English title: the catalogs that carry other languages. */
const originalSearches = (apiKey: string | null) =>
  withGoogle(apiKey, [
    searchOpenLibrary,
    (query, request) => searchWikipedia(query, request, 'en'),
  ]);

async function candidatesFrom(
  searches: Search[],
  query: Query,
  timeout: number,
  request: SourceRequest,
) {
  const settled = await Promise.allSettled(
    searches.map((search) => withTimeout(search(query, request), timeout)),
  );
  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

/** No cover or no synopsis among the work's results (or no work at all). */
function lacking(work: Work | undefined): boolean {
  if (!work) return true;
  const candidates = work.members.map((m) => m.candidate);
  return !candidates.some((c) => c.cover) || !candidates.some((c) => c.synopsis);
}

/** The work's results under its English title (from Wikidata); they never name the work. */
async function underOriginalTitle(
  query: Query,
  options: LookupOptions,
  request: SourceRequest,
): Promise<Matched[]> {
  const timeout = timeoutOf(options);
  const title = await withTimeout(englishTitle(query, request), timeout).catch(() => null);
  if (!title) return [];
  const original = { title, author: query.author };
  const searches = originalSearches(options.googleBooksApiKey);
  const found = await candidatesFrom(searches, original, timeout, request);
  return gate(original, found).map((match) => ({ ...match, exact: false }));
}

interface Choice {
  chosen: Work | undefined;
  rest: Work[];
  approximate: boolean;
}

async function chooseWork(
  query: Query,
  options: LookupOptions,
  request: SourceRequest,
): Promise<Choice> {
  const searches = searchesFor(options.googleBooksApiKey);
  const candidates = await candidatesFrom(searches, query, timeoutOf(options), request);
  const strict = gate(query, candidates);
  // Nothing under the title typed: maybe the same book under another translation's title.
  const approximate = strict.length === 0;
  const matched = approximate ? looseGate(query, candidates) : strict;
  const [chosen, ...rest] = rankWorks(groupWorks(matched), query);
  if (!lacking(chosen)) return { chosen, rest, approximate };
  // Still no cover or synopsis: the same work under its English title.
  const more = await underOriginalTitle(query, options, request);
  if (more.length === 0) return { chosen, rest, approximate };
  if (chosen)
    return { chosen: { ...chosen, members: [...chosen.members, ...more] }, rest, approximate };
  const [found] = rankWorks(groupWorks(more), query);
  return { chosen: found, rest: [], approximate: false };
}

function sourced({ synopsis, source, publisher }: Candidate): SourcedSynopsis[] {
  if (!synopsis) return [];
  return [
    { synopsis, source, publisher, ...(source === 'wikipedia' ? { part: 'introdução' } : {}) },
  ];
}

/**
 * Texts asked only for the chosen work: the opening of its encyclopedia
 * plot section and its Open Library description. A slow one is skipped.
 */
async function extraSynopses(work: Work, request: SourceRequest, timeout: number) {
  const candidates = work.members.map((m) => m.candidate);
  const article = candidates.find((c) => c.article)?.article;
  const olWork = candidates.find((c) => c.work)?.work;
  const [plot, description] = await Promise.all([
    article ? withTimeout(plotSynopsis(article, request), timeout).catch(() => null) : null,
    olWork ? withTimeout(workDescription(olWork, request), timeout).catch(() => null) : null,
  ]);
  const extra: SourcedSynopsis[] = [];
  if (plot)
    extra.push({ synopsis: plot, source: 'wikipedia', publisher: null, part: 'início do enredo' });
  if (description) extra.push({ synopsis: description, source: 'open-library', publisher: null });
  return extra;
}

/** One article per encyclopedia (Portuguese, English): the top hit of each. */
function onePerWiki(work: Work): Candidate[] {
  const seen = new Set<string>();
  return work.members
    .map((m) => m.candidate)
    .filter((candidate) => {
      if (candidate.source !== 'wikipedia') return true;
      const host = candidate.synopsis?.sourceUrl.split('/')[2] ?? '';
      if (seen.has(host)) return false;
      seen.add(host);
      return true;
    });
}

/** Every synopsis of the chosen work, ranked. */
async function synopsesOf(work: Work, request: SourceRequest, timeout: number) {
  const found = onePerWiki(work).flatMap(sourced);
  return rankSynopses([...found, ...(await extraSynopses(work, request, timeout))]);
}

export function queryOf(text: string): Query {
  const { title, author } = splitTitle(text.trim());
  return { title, author };
}

export async function lookupBook(text: string, options: LookupOptions): Promise<LookupResult> {
  const query = queryOf(text);
  if (query.title.length < 2) return NOTHING_FOUND;
  const request: SourceRequest = {
    // Called unbound, never as a method: browsers refuse `fetch` with another `this`.
    fetcher: options.fetcher ?? ((input, init) => fetch(input, init)),
    ...(options.signal ? { signal: options.signal } : {}),
  };
  const { chosen, rest, approximate } = await chooseWork(query, options, request);
  options.signal?.throwIfAborted();
  if (!chosen) return NOTHING_FOUND;
  const [covers, synopses] = await Promise.all([
    rankCovers(chosen, options.measure),
    synopsesOf(chosen, request, timeoutOf(options)),
  ]);
  const others = rest
    .filter((work) => chosen.score - work.score <= 1)
    .slice(0, 2)
    .map(summarize);
  return {
    work: summarize(chosen),
    covers,
    synopses,
    others,
    ...(approximate ? { approximate } : {}),
  };
}
