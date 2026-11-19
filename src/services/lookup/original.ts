import { fetchJson, isRecord, listAt, textAt } from './http';

import { matchTitle, normalize } from './match';
import type { Query, SourceRequest } from './types';

/**
 * Wikidata knows a work's titles in other languages. When the catalogs have
 * no cover or synopsis under a translated title, the English one usually
 * finds an edition with both ("O Marinheiro que Perdeu as Graças do Mar" →
 * "The Sailor Who Fell from Grace with the Sea").
 */

const API = 'https://www.wikidata.org/w/api.php';

/** Descriptions of readings: "novel by Yukio Mishima", "obra literária escrita por…". */
const READING =
  /\b(novel|novella|book|short stor|manga|comic|poem|essay|play|romance|livro|obra liter|conto|novela|manga|poema|ensaio|peca)/;

export function wikidataSearchUrl(title: string): string {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: title,
    language: 'pt',
    uselang: 'pt',
    type: 'item',
    limit: '5',
    format: 'json',
    origin: '*',
  });
  return `${API}?${params.toString()}`;
}

export function wikidataLabelsUrl(id: string): string {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: id,
    props: 'labels',
    languages: 'en',
    format: 'json',
    origin: '*',
  });
  return `${API}?${params.toString()}`;
}

const surnameOf = (author: string) =>
  normalize(author)
    .split(' ')
    .filter((word) => word.length >= 3)
    .at(-1) ?? null;

/** The reading typed among Wikidata's results: its title, a reading, and the author typed. */
export function pickWork(query: Query, json: unknown): string | null {
  const surname = query.author ? surnameOf(query.author) : null;
  for (const item of listAt(json, 'search').filter(isRecord)) {
    const titles = [textAt(item, 'label'), textAt(item.match, 'text')].filter((t) => t !== null);
    const description = normalize(textAt(item, 'description') ?? '');
    const isReading = READING.test(description);
    const byAuthor = !surname || description.includes(surname);
    if (matchTitle(query.title, titles).matches && isReading && byAuthor) return textAt(item, 'id');
  }
  return null;
}

/** The work's English title, when Wikidata has the reading typed and it differs. */
export async function englishTitle(query: Query, request: SourceRequest): Promise<string | null> {
  const id = pickWork(query, await fetchJson(wikidataSearchUrl(query.title), request));
  if (!id) return null;
  const json = await fetchJson(wikidataLabelsUrl(id), request);
  const entity = isRecord(json) && isRecord(json.entities) ? json.entities[id] : null;
  const labels = isRecord(entity) ? entity.labels : null;
  const english = isRecord(labels) ? textAt(labels.en, 'value') : null;
  return english && normalize(english) !== normalize(query.title) ? english : null;
}
