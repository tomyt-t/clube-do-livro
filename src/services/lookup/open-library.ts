import { fetchJson, isRecord, listAt, textAt } from './http';

import type { Candidate, Query, SourceRequest } from './types';

/**
 * Open Library: no key, good coverage of classics. Asked for a Portuguese
 * edition of each work (`lang=pt`), whose cover is preferred over the
 * work's (often an English one). Its descriptions are written by
 * volunteers, so they are never used as the synopsis.
 */

const FIELDS = [
  'key',
  'title',
  'subtitle',
  'author_name',
  'first_publish_year',
  'cover_i',
  'editions',
  'editions.key',
  'editions.title',
  'editions.language',
  'editions.cover_i',
  'editions.isbn',
  'editions.publisher',
].join(',');

export function openLibraryUrl(query: Query): string {
  const params = new URLSearchParams({
    title: query.title,
    lang: 'pt',
    limit: '8',
    fields: FIELDS,
  });
  if (query.author) params.set('author', query.author);
  return `https://openlibrary.org/search.json?${params.toString()}`;
}

const coverOf = (id: unknown) =>
  typeof id === 'number' && id > 0
    ? `https://covers.openlibrary.org/b/id/${String(id)}-L.jpg`
    : null;

const firstText = (value: unknown, key: string) =>
  listAt(value, key).find((item): item is string => typeof item === 'string') ?? null;

/** The Portuguese edition Open Library matched (`lang=pt`), if any: its cover beats the work's. */
function editionParts(doc: Record<string, unknown>, workKey: string) {
  const [edition = null] = listAt(doc.editions, 'docs').filter(isRecord);
  const editionCover = coverOf(edition?.cover_i);
  const editionKey = textAt(edition, 'key');
  const cover = editionCover ?? coverOf(doc.cover_i);
  const page = editionCover && editionKey ? editionKey : workKey;
  return {
    editionTitle: textAt(edition, 'title'),
    isbn: firstText(edition, 'isbn'),
    publisher: firstText(edition, 'publisher'),
    cover: cover ? { url: cover, sourceUrl: `https://openlibrary.org${page}` } : null,
  };
}

function toCandidate(doc: unknown): Candidate | null {
  if (!isRecord(doc)) return null;
  const title = textAt(doc, 'title');
  const key = textAt(doc, 'key');
  if (!title || !key) return null;
  const { editionTitle, isbn, publisher, cover } = editionParts(doc, key);
  return {
    source: 'open-library',
    titles: editionTitle ? [title, editionTitle] : [title],
    title: editionTitle ?? title,
    authors: listAt(doc, 'author_name').filter((name): name is string => typeof name === 'string'),
    mentions: null,
    publisher,
    year: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
    isbn,
    kind: 'book',
    cover,
    synopsis: null,
  };
}

export function readOpenLibrary(json: unknown): Candidate[] {
  return listAt(json, 'docs')
    .map(toCandidate)
    .filter((candidate) => candidate !== null);
}

export async function searchOpenLibrary(query: Query, request: SourceRequest) {
  return readOpenLibrary(await fetchJson(openLibraryUrl(query), request));
}
