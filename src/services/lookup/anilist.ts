import { fetchJson, isRecord, listAt, textAt } from './http';

import type { Candidate, Query, SourceRequest } from './types';

/** Manga, manhwa and light novels: AniList's public GraphQL API, no key. */

export const ANILIST_URL = 'https://graphql.anilist.co';

const QUERY = `
query ($search: String) {
  Page(perPage: 6) {
    media(search: $search, type: MANGA, sort: SEARCH_MATCH, isAdult: false) {
      id
      format
      siteUrl
      title { romaji english native }
      synonyms
      description(asHtml: true)
      coverImage { extraLarge large }
      startDate { year }
      staff(perPage: 3, sort: RELEVANCE) { edges { role node { name { full } } } }
    }
  }
}`;

function authorsOf(media: Record<string, unknown>): string[] {
  return listAt(media.staff, 'edges')
    .filter(isRecord)
    .filter((edge) => typeof edge.role === 'string' && /story|art|original/i.test(edge.role))
    .map((edge) => (isRecord(edge.node) ? textAt(edge.node.name, 'full') : null))
    .filter((name): name is string => name !== null);
}

function titlesOf(media: Record<string, unknown>): string[] {
  const titles = ['english', 'romaji', 'native'].map((key) => textAt(media.title, key));
  const synonyms = listAt(media, 'synonyms').filter((s): s is string => typeof s === 'string');
  return [...titles.filter((t): t is string => t !== null), ...synonyms];
}

function extrasOf(media: Record<string, unknown>, sourceUrl: string) {
  const image = textAt(media.coverImage, 'extraLarge') ?? textAt(media.coverImage, 'large');
  const year = isRecord(media.startDate) ? media.startDate.year : null;
  return {
    year: typeof year === 'number' ? year : null,
    cover: image?.startsWith('https://') ? { url: image, sourceUrl } : null,
  };
}

function synopsisOf(media: Record<string, unknown>, sourceUrl: string) {
  const raw = textAt(media, 'description');
  return raw ? { raw, sourceUrl } : null;
}

function toCandidate(media: unknown): Candidate | null {
  if (!isRecord(media) || typeof media.id !== 'number') return null;
  const page = textAt(media, 'siteUrl');
  const titles = titlesOf(media);
  const [title] = titles;
  if (!page || !title) return null;
  return {
    source: 'anilist',
    titles,
    title,
    authors: authorsOf(media),
    mentions: null,
    publisher: null,
    isbn: null,
    // One-shots and novels are rarely what a club means by the series' name.
    kind: media.format === 'MANGA' ? 'manga' : 'other',
    ...extrasOf(media, page),
    synopsis: synopsisOf(media, page),
  };
}

export function readAniList(json: unknown): Candidate[] {
  const page = isRecord(json) && isRecord(json.data) ? json.data.Page : null;
  return listAt(page, 'media')
    .map(toCandidate)
    .filter((candidate) => candidate !== null);
}

export async function searchAniList(query: Query, request: SourceRequest) {
  const json = await fetchJson(ANILIST_URL, request, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { search: query.title } }),
  });
  return readAniList(json);
}
