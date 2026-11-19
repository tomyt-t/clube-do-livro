import { splitTitle } from '@/domain/book';

import { searchAniList } from './anilist';
import { searchGoogleBooks } from './google-books';
import { searchOpenLibrary, workDescription } from './open-library';
import { searchPublishers } from './publishers';
import {
  gate,
  groupWorks,
  rankCovers,
  rankSynopses,
  rankWorks,
  summarize,
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

function searchesFor(apiKey: string | null): Search[] {
  const free: Search[] = [searchPublishers, searchOpenLibrary, searchWikipedia, searchAniList];
  return apiKey ? [(query, request) => searchGoogleBooks(query, apiKey, request), ...free] : free;
}

async function allCandidates(query: Query, options: LookupOptions, request: SourceRequest) {
  const timeout = options.timeoutMs ?? 8000;
  const settled = await Promise.allSettled(
    searchesFor(options.googleBooksApiKey).map((search) =>
      withTimeout(search(query, request), timeout),
    ),
  );
  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
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

/** Every synopsis of the chosen work, ranked. */
async function synopsesOf(work: Work, request: SourceRequest, timeout: number) {
  // One encyclopedia article: the top hit, whose plot section is asked for too.
  const article = work.members.find((m) => m.candidate.article)?.candidate;
  const found = work.members
    .filter(({ candidate }) => candidate.source !== 'wikipedia' || candidate === article)
    .flatMap(({ candidate }) => sourced(candidate));
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
  const works = rankWorks(
    groupWorks(gate(query, await allCandidates(query, options, request))),
    query,
  );
  options.signal?.throwIfAborted();
  const [chosen, ...rest] = works;
  if (!chosen) return NOTHING_FOUND;
  const [covers, synopses] = await Promise.all([
    rankCovers(chosen, options.measure),
    synopsesOf(chosen, request, options.timeoutMs ?? 8000),
  ]);
  const others = rest
    .filter((work) => chosen.score - work.score <= 1)
    .slice(0, 2)
    .map(summarize);
  return { work: summarize(chosen), covers, synopses, others };
}
