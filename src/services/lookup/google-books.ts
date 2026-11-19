import { fetchJson, isRecord, listAt, textAt } from './http';

import type { Candidate, Query, SourceRequest } from './types';

/**
 * Google Books: the best catalog for Brazilian editions, with publishers'
 * blurbs. Needs the site's API key (the keyless quota is zero). Two
 * searches: one limited to Portuguese, one open, since editions are often
 * mislabeled and the original may be the only one with a cover.
 */

const FIELDS =
  'items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,language,imageLinks/thumbnail,canonicalVolumeLink,infoLink,printType))';

export function googleBooksUrl(query: Query, apiKey: string, portuguese: boolean): string {
  const terms = [`intitle:${query.title}`, query.author ? `inauthor:${query.author}` : ''];
  const params = new URLSearchParams({
    q: terms.filter(Boolean).join(' '),
    maxResults: '20',
    printType: 'books',
    fields: FIELDS,
    key: apiKey,
  });
  if (portuguese) params.set('langRestrict', 'pt');
  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

/** Thumbnails come as small http images; this asks for a larger https one (the known-good recipe). */
export function largerCover(thumbnail: string): string | null {
  try {
    const url = new URL(thumbnail);
    url.protocol = 'https:';
    url.searchParams.delete('edge');
    url.searchParams.set('zoom', '1');
    url.searchParams.set('fife', 'w600-h900');
    return url.toString();
  } catch {
    return null;
  }
}

function isbnOf(info: Record<string, unknown>): string | null {
  const ids = listAt(info, 'industryIdentifiers').filter(isRecord);
  const isbn13 = ids.find((id) => id.type === 'ISBN_13');
  return textAt(isbn13 ?? ids[0], 'identifier');
}

function yearOf(info: Record<string, unknown>): number | null {
  const year = Number.parseInt(textAt(info, 'publishedDate')?.slice(0, 4) ?? '', 10);
  return Number.isNaN(year) ? null : year;
}

/** The volume's page, kept as the source of its cover and blurb. */
function pageOf(info: Record<string, unknown>): string | null {
  const page = textAt(info, 'canonicalVolumeLink') ?? textAt(info, 'infoLink');
  return page ? page.replace(/^http:/, 'https:') : null;
}

function coverAndBlurb(info: Record<string, unknown>, sourceUrl: string) {
  const thumbnail = textAt(info.imageLinks, 'thumbnail');
  const url = thumbnail ? largerCover(thumbnail) : null;
  const description = textAt(info, 'description');
  return {
    cover: url ? { url, sourceUrl } : null,
    synopsis: description ? { raw: description, sourceUrl } : null,
  };
}

function toCandidate(item: unknown): Candidate | null {
  if (!isRecord(item) || !isRecord(item.volumeInfo)) return null;
  const info = item.volumeInfo;
  const title = textAt(info, 'title');
  const sourceUrl = pageOf(info);
  if (!title || !sourceUrl) return null;
  const subtitle = textAt(info, 'subtitle');
  const full = subtitle ? `${title}: ${subtitle}` : title;
  return {
    source: 'google-books',
    titles: [title, full],
    title: full,
    authors: listAt(info, 'authors').filter((name): name is string => typeof name === 'string'),
    mentions: null,
    publisher: textAt(info, 'publisher'),
    year: yearOf(info),
    isbn: isbnOf(info),
    kind: 'book',
    ...coverAndBlurb(info, sourceUrl),
  };
}

export function readGoogleBooks(json: unknown): Candidate[] {
  return listAt(json, 'items')
    .map(toCandidate)
    .filter((candidate) => candidate !== null);
}

export async function searchGoogleBooks(
  query: Query,
  apiKey: string,
  request: SourceRequest,
): Promise<Candidate[]> {
  const [portuguese, open] = await Promise.allSettled([
    fetchJson(googleBooksUrl(query, apiKey, true), request),
    fetchJson(googleBooksUrl(query, apiKey, false), request),
  ]);
  const found = [portuguese, open].filter((result) => result.status === 'fulfilled');
  if (found.length === 0) throw new Error('Google Livros indisponível');
  const seen = new Set<string>();
  return found
    .flatMap((result) => readGoogleBooks(result.value))
    .filter((candidate) => {
      const key = candidate.cover?.url ?? candidate.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
