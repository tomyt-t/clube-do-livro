import { fetchJson, isRecord, textAt } from './http';

import { normalize } from './match';
import type { Candidate, FoundSynopsis, Query, SourceRequest } from './types';

/**
 * Portuguese Wikipedia: strong on Brazilian classics and prize winners.
 * The search recognizes the reading (the lead's first paragraph names its
 * author), and the lead is offered as a synopsis. For the reading chosen,
 * the opening of the article's plot section is offered too: only its first
 * paragraph, which sets the story up, not the ones that tell how it ends.
 */

export function wikipediaSearchUrl(query: Query): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: [query.title, query.author].filter(Boolean).join(' '),
    gsrlimit: '4',
    prop: 'extracts|pageimages|info',
    exintro: '1',
    explaintext: '1',
    piprop: 'original',
    inprop: 'url',
    redirects: '1',
  });
  return `https://pt.wikipedia.org/w/api.php?${params.toString()}`;
}

/** "Berserk (mangá)" → "Berserk"; the parenthesis tells the kind. */
function plainTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '');
}

export function firstParagraph(extract: string): string {
  const [first = ''] = extract
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return first;
}

const KINDS = /(mang[aá]|light novel|banda desenhada|quadrinhos|hq)/i;
const NOT_A_READING =
  /(filme|série de televisão|telenovela|álbum|canção|banda|desambiguação|jogo)/i;

function imageOf(page: Record<string, unknown>, sourceUrl: string) {
  const image = isRecord(page.original) ? textAt(page.original, 'source') : null;
  return image?.startsWith('https://') ? { url: image, sourceUrl } : null;
}

function toCandidate(page: unknown): Candidate | null {
  if (!isRecord(page)) return null;
  const title = textAt(page, 'title');
  const url = textAt(page, 'fullurl');
  const extract = textAt(page, 'extract');
  if (!title || !url || !extract || NOT_A_READING.test(title)) return null;
  const paragraph = firstParagraph(extract);
  return {
    source: 'wikipedia',
    titles: [plainTitle(title)],
    title: plainTitle(title),
    authors: [],
    // Authors are not listed; the paragraph names them ("…romance de Machado de Assis").
    mentions: normalize(paragraph),
    publisher: null,
    year: null,
    isbn: null,
    kind: KINDS.test(title) ? 'manga' : 'book',
    cover: imageOf(page, url),
    synopsis: { raw: extract, sourceUrl: url },
    article: { title, url },
  };
}

export function readWikipedia(json: unknown): Candidate[] {
  const pages = isRecord(json) && isRecord(json.query) ? json.query.pages : null;
  if (!Array.isArray(pages)) return [];
  return pages
    .slice()
    .sort((a, b) => (isRecord(a) && isRecord(b) ? Number(a.index) - Number(b.index) : 0))
    .map(toCandidate)
    .filter((candidate) => candidate !== null);
}

export async function searchWikipedia(query: Query, request: SourceRequest) {
  return readWikipedia(await fetchJson(wikipediaSearchUrl(query), request));
}

/** Plot sections, by their usual headings (not "Narrativa" or "História", which discuss other things). */
const PLOT = /^(enredo|sinopse|resumo|resumo do enredo|trama|argumento|enredo e personagens)$/;

/** The first paragraph of the article's plot section, or null if it has none. */
export function plotOpening(extract: string): string | null {
  const parts = extract.split(/^={2,}\s*(.+?)\s*={2,}\s*$/m);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    if (!PLOT.test(normalize(parts[i] ?? ''))) continue;
    const paragraphs = (parts[i + 1] ?? '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    // A section that opens with a quotation ("…do Capítulo 13:") gives no
    // clean opening: where the quote ends cannot be told.
    const [first = null] = paragraphs;
    return first?.endsWith(':') ? null : first;
  }
  return null;
}

export function wikipediaArticleUrl(title: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'extracts',
    explaintext: '1',
    redirects: '1',
    titles: title,
  });
  return `https://pt.wikipedia.org/w/api.php?${params.toString()}`;
}

export async function plotSynopsis(
  article: { title: string; url: string },
  request: SourceRequest,
): Promise<FoundSynopsis | null> {
  const json = await fetchJson(wikipediaArticleUrl(article.title), request);
  const pages = isRecord(json) && isRecord(json.query) ? json.query.pages : null;
  const extract = Array.isArray(pages) ? textAt(pages[0], 'extract') : null;
  const opening = extract ? plotOpening(extract) : null;
  return opening ? { raw: opening, sourceUrl: article.url } : null;
}
