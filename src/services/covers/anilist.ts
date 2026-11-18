import { fetchJson, isRecord, joinDetails, listAt, textAt } from './http';
import type { CoverOption, SourceRequest } from './types';

/** Manga, manhwa and light novels; public GraphQL API, no key needed. */

export const ANILIST_URL = 'https://graphql.anilist.co';

const QUERY = `
query ($search: String) {
  Page(perPage: 8) {
    media(search: $search, type: MANGA, sort: SEARCH_MATCH, isAdult: false) {
      id
      format
      title { romaji english }
      coverImage { extraLarge large }
      startDate { year }
      staff(perPage: 1, sort: RELEVANCE) { nodes { name { full } } }
    }
  }
}`;

const FORMATS: Record<string, string> = {
  MANGA: 'Mangá',
  NOVEL: 'Light novel',
  ONE_SHOT: 'One-shot',
};

export function anilistBody(query: string): string {
  return JSON.stringify({ query: QUERY, variables: { search: query } });
}

function firstStaff(media: Record<string, unknown>): string | null {
  const [node] = listAt(media.staff, 'nodes');
  return isRecord(node) ? textAt(node.name, 'full') : null;
}

function detailsOf(media: Record<string, unknown>): string {
  const format = typeof media.format === 'string' ? FORMATS[media.format] : undefined;
  const year = isRecord(media.startDate) ? media.startDate.year : null;
  return joinDetails([firstStaff(media), format, typeof year === 'number' ? year : null]);
}

function toOption(media: unknown): CoverOption | null {
  if (!isRecord(media) || typeof media.id !== 'number') return null;
  const imageUrl = textAt(media.coverImage, 'extraLarge') ?? textAt(media.coverImage, 'large');
  const title = textAt(media.title, 'english') ?? textAt(media.title, 'romaji');
  if (!imageUrl?.startsWith('https://') || !title) return null;

  return {
    id: `anilist:${String(media.id)}`,
    imageUrl,
    title,
    details: detailsOf(media),
    source: 'anilist',
  };
}

export function readAniList(json: unknown): CoverOption[] {
  const page = isRecord(json) && isRecord(json.data) ? json.data.Page : null;
  return listAt(page, 'media')
    .map(toOption)
    .filter((option) => option !== null);
}

export async function searchAniList(query: string, request: SourceRequest) {
  const json = await fetchJson(ANILIST_URL, request, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: anilistBody(query),
  });
  return readAniList(json);
}
