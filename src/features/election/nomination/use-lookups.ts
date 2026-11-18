import { useEffect, useState } from 'react';

import { useConfig } from '@/app/services';
import { searchCovers, type CoverOption } from '@/services/covers';
import { findSynopsis, type FoundSynopsis } from '@/services/synopsis';

/**
 * Catalog lookups for the nomination review. Each one restarts when its
 * input changes and ignores answers to questions no longer being asked.
 */

export type CoverSearch =
  { status: 'loading' } | { status: 'ready'; options: CoverOption[] } | { status: 'error' };

export function useCoverSearch(query: string): CoverSearch {
  const { googleBooksApiKey } = useConfig();
  const [result, setResult] = useState<{ query: string; search: CoverSearch } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const settle = (search: CoverSearch) => {
      if (!controller.signal.aborted) setResult({ query, search });
    };
    searchCovers(query, { googleBooksApiKey, signal: controller.signal }).then(
      (options) => {
        settle({ status: 'ready', options });
      },
      () => {
        settle({ status: 'error' });
      },
    );
    return () => {
      controller.abort();
    };
  }, [query, googleBooksApiKey]);

  return result?.query === query ? result.search : { status: 'loading' };
}

export type SynopsisLookup =
  { status: 'loading' } | { status: 'done'; found: FoundSynopsis | null };

export function useFoundSynopsis(link: string | null, option: CoverOption | null): SynopsisLookup {
  const key = `${link ?? ''} ${option?.id ?? ''}`;
  const [result, setResult] = useState<{ key: string; found: FoundSynopsis | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void findSynopsis({ link, option }, { fetcher: fetch, signal: controller.signal }).then(
      (found) => {
        if (!controller.signal.aborted) setResult({ key, found });
      },
    );
    return () => {
      controller.abort();
    };
  }, [key, link, option]);

  return result?.key === key ? { status: 'done', found: result.found } : { status: 'loading' };
}
