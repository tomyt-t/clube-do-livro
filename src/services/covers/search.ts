import { BackendError } from '../backend';

import { searchAniList } from './anilist';
import { searchGoogleBooks } from './google-books';
import { searchOpenLibrary } from './open-library';
import type { CoverOption, Fetcher, SourceRequest } from './types';

export interface CoverSearchOptions {
  googleBooksApiKey: string | null;
  signal?: AbortSignal;
  fetcher?: Fetcher;
}

export const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 12;

type Source = (query: string, request: SourceRequest) => Promise<CoverOption[]>;

function sourcesFor(apiKey: string | null): Source[] {
  const catalogs: Source[] = [searchOpenLibrary, searchAniList];
  if (!apiKey) return catalogs;
  return [(query, request) => searchGoogleBooks(query, apiKey, request), ...catalogs];
}

/** Takes the 1st of each list, then the 2nd of each... so every catalog shows up early. */
export function interleave<T>(lists: readonly (readonly T[])[]): T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, index) =>
    lists.map((list) => list[index]).filter((item) => item !== undefined),
  ).flat();
}

function withoutDuplicates(options: CoverOption[]): CoverOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.imageUrl)) return false;
    seen.add(option.imageUrl);
    return true;
  });
}

/**
 * Looks for covers in every catalog at once. A catalog that fails is skipped;
 * only when all of them fail does the search fail.
 */
export async function searchCovers(
  query: string,
  { googleBooksApiKey, signal, fetcher = fetch }: CoverSearchOptions,
): Promise<CoverOption[]> {
  const term = query.trim();
  if (term.length < MIN_QUERY_LENGTH) return [];

  const request: SourceRequest = signal ? { fetcher, signal } : { fetcher };
  const settled = await Promise.allSettled(
    sourcesFor(googleBooksApiKey).map((search) => search(term, request)),
  );
  signal?.throwIfAborted();

  const found = settled.filter((result) => result.status === 'fulfilled').map((r) => r.value);
  if (found.length === 0) {
    throw new BackendError('unavailable', 'Não foi possível buscar capas agora.');
  }
  return withoutDuplicates(interleave(found)).slice(0, MAX_RESULTS);
}
