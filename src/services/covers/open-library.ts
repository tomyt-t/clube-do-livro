import { fetchJson, isRecord, joinDetails, listAt, textAt } from './http';
import type { CoverOption, SourceRequest } from './types';

/** Books, comics and graphic novels; no key needed. */

export function openLibraryUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    limit: '8',
    fields: 'key,title,author_name,first_publish_year,cover_i',
  });
  return `https://openlibrary.org/search.json?${params.toString()}`;
}

function toOption(doc: unknown): CoverOption | null {
  if (!isRecord(doc) || typeof doc.cover_i !== 'number') return null;
  const title = textAt(doc, 'title');
  if (!title) return null;
  const author = listAt(doc, 'author_name').find((name) => typeof name === 'string');
  const year = typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null;
  return {
    id: `open-library:${String(doc.cover_i)}`,
    imageUrl: `https://covers.openlibrary.org/b/id/${String(doc.cover_i)}-L.jpg`,
    title,
    details: joinDetails([author, year]),
    source: 'open-library',
  };
}

export function readOpenLibrary(json: unknown): CoverOption[] {
  return listAt(json, 'docs')
    .map(toOption)
    .filter((option) => option !== null);
}

export async function searchOpenLibrary(query: string, request: SourceRequest) {
  return readOpenLibrary(await fetchJson(openLibraryUrl(query), request));
}
