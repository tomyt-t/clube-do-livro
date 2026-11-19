import { useEffect, useState } from 'react';

import { useConfig } from '@/app/services';
import { lookupBook, NOTHING_FOUND, type LookupResult } from '@/services/lookup';
import { measureInBrowser } from '@/services/lookup/measure';

/**
 * The cover and synopsis search for the nomination review: public catalogs
 * and publishers' sites, asked from this browser (nothing is saved until
 * the member sends). It restarts when the title changes and ignores
 * answers to a title no longer being asked; a failed search is simply
 * "nothing found".
 */

export type BookLookup = { status: 'loading' } | { status: 'done'; result: LookupResult };

export function useBookLookup(text: string): BookLookup {
  const { googleBooksApiKey } = useConfig();
  const [found, setFound] = useState<{ text: string; result: LookupResult } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const settle = (result: LookupResult) => {
      if (!controller.signal.aborted) setFound({ text, result });
    };
    lookupBook(text, {
      googleBooksApiKey,
      measure: measureInBrowser,
      signal: controller.signal,
    }).then(settle, () => {
      settle(NOTHING_FOUND);
    });
    return () => {
      controller.abort();
    };
  }, [text, googleBooksApiKey]);

  return found?.text === text ? { status: 'done', result: found.result } : { status: 'loading' };
}
