import { fetchJson, isRecord, listAt, textAt } from './http';
import { toPlainText } from './text';

import { normalize } from './match';
import type { Candidate, FoundCover, Query, SourceRequest } from './types';

/**
 * Publishers' own sites: the synopsis the publisher wrote, taken from the
 * publisher. Only catalogs that answer the club's site directly (CORS) are
 * listed. Companhia das Letras, Todavia, DarkSide and others do not, so
 * their texts arrive only through Google Books, which receives them from
 * the publishers.
 */

interface Found {
  title: string;
  page: string;
  synopsis: string;
  cover: string | null;
  isbn: string | null;
}

interface Catalog {
  name: string;
  url: (query: Query) => string;
  read: (json: unknown) => Found[];
}

const digitsOf = (value: string | null) => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 13 ? digits : null;
};

// ------------------------------------------------------------- WordPress

function wordPress(name: string, api: string, type: string): Catalog {
  return {
    name,
    url: (query) => {
      const params = new URLSearchParams({
        search: query.title,
        per_page: '6',
        _fields: 'title,link,content',
      });
      return `${api}/${type}?${params.toString()}`;
    },
    read: (json) =>
      (Array.isArray(json) ? json : []).flatMap((post) => {
        const title = textAt(isRecord(post) ? post.title : null, 'rendered');
        const page = textAt(post, 'link');
        const synopsis = textAt(isRecord(post) ? post.content : null, 'rendered');
        return title && page && synopsis
          ? [{ title, page, synopsis, cover: null, isbn: null }]
          : [];
      }),
  };
}

// --------------------------------------------------------------- Shopify

/** Shopify keeps each Storefront API version for a year: move this along yearly. */
const SHOPIFY_API = '2026-10';

/** The title in quotes, so the search does not also match other books' descriptions. */
function shopifyQuery(query: Query): string {
  const title = query.title.replace(/["\\]/g, ' ').trim();
  return `{products(first:6,query:${JSON.stringify(`title:"${title}"`)}){edges{node{title onlineStoreUrl descriptionHtml featuredImage{url} variants(first:1){edges{node{sku barcode}}}}}}}`;
}

function shopifyProduct(node: unknown): Found | null {
  const title = textAt(node, 'title');
  const page = textAt(node, 'onlineStoreUrl');
  const synopsis = textAt(node, 'descriptionHtml');
  if (!title || !page || !synopsis) return null;
  const image = textAt(isRecord(node) ? node.featuredImage : null, 'url');
  const [variant] = listAt(isRecord(node) ? node.variants : null, 'edges');
  const codes = isRecord(variant) ? variant.node : null;
  return {
    title,
    page,
    synopsis,
    cover: image ? `${image}${image.includes('?') ? '&' : '?'}width=800` : null,
    isbn: digitsOf(textAt(codes, 'barcode')) ?? digitsOf(textAt(codes, 'sku')),
  };
}

function shopify(name: string, host: string): Catalog {
  return {
    name,
    url: (query) =>
      `https://${host}/api/${SHOPIFY_API}/graphql.json?query=${encodeURIComponent(shopifyQuery(query))}`,
    read: (json) => {
      const data = isRecord(json) ? json.data : null;
      return listAt(isRecord(data) ? data.products : null, 'edges')
        .map((edge) => shopifyProduct(isRecord(edge) ? edge.node : null))
        .filter((found) => found !== null);
    },
  };
}

// ----------------------------------------------------------- Globo Livros

const slugOf = (title: string) => normalize(title).replace(/ /g, '-');

const globoLivros: Catalog = {
  name: 'Globo Livros',
  url: (query) => {
    const params = new URLSearchParams({ isHome: 'false', active: 'true', search: query.title });
    return `https://globolivros.globo.com/api/book?${params.toString()}`;
  },
  read: (json) =>
    (Array.isArray(json) ? json : []).flatMap((book) => {
      const title = textAt(book, 'title');
      const id = textAt(book, 'id');
      const synopsis = textAt(book, 'description');
      if (!title || !id || !synopsis) return [];
      const page = `https://globolivros.globo.com/livro/${slugOf(title)}/${id}`;
      const isbn = digitsOf(textAt(book, 'isbn'));
      return [{ title, page, synopsis, cover: textAt(book, 'image_url'), isbn }];
    }),
};

export const CATALOGS: readonly Catalog[] = [
  wordPress('Rocco', 'https://rocco.com.br/wp-json/wp/v2', 'product'),
  wordPress('Intrínseca', 'https://intrinseca.com.br/wp-json/wp/v2', 'livro'),
  wordPress('Antofágica', 'https://www.antofagica.com.br/wp-json/wp/v2', 'product'),
  shopify('Record', 'www.record.com.br'),
  shopify('HarperCollins Brasil', 'harpercollins.com.br'),
  shopify('Aleph', 'aleph.com.br'),
  shopify('Sextante', 'sextante.com.br'),
  globoLivros,
];

function toCandidate(name: string, found: Found): Candidate | null {
  if (!found.page.startsWith('https://')) return null;
  const title = toPlainText(found.title);
  const cover: FoundCover | null = found.cover?.startsWith('https://')
    ? { url: found.cover, sourceUrl: found.page }
    : null;
  return {
    source: 'publisher',
    titles: [title],
    title,
    authors: [],
    // The text usually names the author ("Último livro de Clarice Lispector…").
    mentions: normalize(toPlainText(found.synopsis)),
    publisher: name,
    year: null,
    isbn: found.isbn,
    kind: 'book',
    cover,
    synopsis: { raw: found.synopsis, sourceUrl: found.page },
  };
}

export function readCatalog(catalog: Catalog, json: unknown): Candidate[] {
  return catalog
    .read(json)
    .map((found) => toCandidate(catalog.name, found))
    .filter((candidate) => candidate !== null);
}

/** Every publisher at once; one that fails or is slow is simply left out. */
export async function searchPublishers(query: Query, request: SourceRequest) {
  const settled = await Promise.allSettled(
    CATALOGS.map(async (catalog) =>
      readCatalog(catalog, await fetchJson(catalog.url(query), request)),
    ),
  );
  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}
