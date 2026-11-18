import { fetchJson, isRecord, joinDetails, listAt, textAt } from './http';
import type { CoverOption, SourceRequest } from './types';

/**
 * Best for Brazilian editions. Needs an API key: the keyless quota is shared
 * by everyone and is usually exhausted.
 */

export function googleBooksUrl(query: string, apiKey: string): string {
  const params = new URLSearchParams({
    q: query,
    maxResults: '8',
    fields: 'items(id,volumeInfo(title,authors,publishedDate,imageLinks/thumbnail))',
    key: apiKey,
  });
  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

/** Thumbnails come as small http images; ask for a larger https one. */
export function largerCover(thumbnail: string): string | null {
  try {
    const url = new URL(thumbnail);
    url.protocol = 'https:';
    url.searchParams.delete('edge');
    url.searchParams.set('fife', 'w600-h900');
    return url.toString();
  } catch {
    return null;
  }
}

function toOption(item: unknown): CoverOption | null {
  if (!isRecord(item) || !isRecord(item.volumeInfo)) return null;
  const info = item.volumeInfo;
  const thumbnail = textAt(info.imageLinks, 'thumbnail');
  const imageUrl = thumbnail ? largerCover(thumbnail) : null;
  const title = textAt(info, 'title');
  const id = textAt(item, 'id');
  if (!imageUrl || !title || !id) return null;

  const author = listAt(info, 'authors').find((name) => typeof name === 'string');
  const year = textAt(info, 'publishedDate')?.slice(0, 4);
  return {
    id: `google-books:${id}`,
    imageUrl,
    title,
    details: joinDetails([author, year]),
    source: 'google-books',
  };
}

export function readGoogleBooks(json: unknown): CoverOption[] {
  return listAt(json, 'items')
    .map(toOption)
    .filter((option) => option !== null);
}

export async function searchGoogleBooks(query: string, apiKey: string, request: SourceRequest) {
  return readGoogleBooks(await fetchJson(googleBooksUrl(query, apiKey), request));
}
