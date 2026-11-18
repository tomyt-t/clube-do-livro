import type { SynopsisSource } from '@/domain/types';

import { fetchJson, isRecord, textAt } from '../covers/http';
import type { CoverOption, SourceRequest } from '../covers/types';

import { toPlainText } from './text';

/**
 * Finds a synopsis for a nomination: from the Wikipedia link the member
 * pasted (usually in Portuguese), or else from the catalog of the cover they
 * picked. Nothing found is a normal outcome, never an error.
 */

export interface FoundSynopsis {
  text: string;
  source: SynopsisSource;
}

const WIKIPEDIA_HOST = /^([a-z][a-z-]{1,11})\.(?:m\.)?wikipedia\.org$/;
const WORK_KEY = /^\/works\/OL\d+W$/;

/** The REST summary of a Wikipedia article link, or null for any other link. */
export function wikipediaSummaryUrl(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const language = WIKIPEDIA_HOST.exec(url.hostname)?.[1];
  const title = url.pathname.startsWith('/wiki/') ? url.pathname.slice(6) : '';
  if (url.protocol !== 'https:' || !language || title === '') return null;
  return `https://${language}.wikipedia.org/api/rest_v1/page/summary/${title}`;
}

export function readWikipediaSummary(json: unknown): string | null {
  if (!isRecord(json) || json.type === 'disambiguation') return null;
  return textAt(json, 'extract');
}

/** Open Library sends descriptions as text or as `{ value }`. */
export function readOpenLibraryWork(json: unknown): string | null {
  if (!isRecord(json)) return null;
  return textAt(json, 'description') ?? textAt(json.description, 'value');
}

function found(raw: string | null, source: SynopsisSource): FoundSynopsis | null {
  const text = raw === null ? '' : toPlainText(raw);
  return text === '' ? null : { text, source };
}

async function fromLink(link: string, request: SourceRequest) {
  const url = wikipediaSummaryUrl(link);
  if (!url) return null;
  return found(readWikipediaSummary(await fetchJson(url, request)), 'wikipedia');
}

async function fromCatalog(option: CoverOption, request: SourceRequest) {
  if (option.synopsis !== null) return found(option.synopsis, option.source);
  if (option.workKey === null || !WORK_KEY.test(option.workKey)) return null;
  const json = await fetchJson(`https://openlibrary.org${option.workKey}.json`, request);
  return found(readOpenLibraryWork(json), 'open-library');
}

const quietly = <T>(promise: Promise<T>) => promise.catch(() => null);

export async function findSynopsis(
  { link, option }: { link: string | null; option: CoverOption | null },
  request: SourceRequest,
): Promise<FoundSynopsis | null> {
  const fromWikipedia = link ? await quietly(fromLink(link, request)) : null;
  if (fromWikipedia) return fromWikipedia;
  return option ? quietly(fromCatalog(option, request)) : null;
}
