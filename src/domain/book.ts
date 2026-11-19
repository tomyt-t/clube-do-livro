import { titleKey } from './title-key';
import type { Book, SynopsisSource } from './types';

/** Field limits. `firestore.rules` enforces the same numbers server-side. */
export const BOOK_LIMITS = {
  title: 200,
  synopsis: 2000,
  link: 1000,
  /** Characters of an uploaded cover's data URL (≈150 KB of image). */
  uploadedCover: 200_000,
} as const;

const UPLOADED_COVER = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Only safety checks: sizes and link formats. Any kind of reading is valid,
 * so there is no "is this a real book" check.
 */
export type BookError =
  | 'title-missing'
  | 'title-too-long'
  | 'synopsis-too-long'
  | 'synopsis-source-invalid'
  | 'synopsis-link-invalid'
  | 'cover-invalid'
  | 'cover-source-missing'
  | 'cover-source-invalid';

export const SYNOPSIS_SOURCES: readonly SynopsisSource[] = [
  'publisher',
  'google-books',
  'wikipedia',
  'open-library',
  'anilist',
];

function nullIfBlank(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Keeps paragraphs, drops stray spaces and runs of blank lines. */
export function normalizeSynopsis(text: string | null): string | null {
  const clean = (text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return nullIfBlank(clean);
}

/** Collapses whitespace in the title and turns blank fields into nothing. */
export function normalizeBook(book: Book): Book {
  const synopsis = normalizeSynopsis(book.synopsis);
  const coverUrl = nullIfBlank(book.coverUrl);
  return {
    title: book.title.replace(/\s+/g, ' ').trim(),
    synopsis,
    synopsisSource: synopsis === null ? null : book.synopsisSource,
    synopsisUrl: nullIfBlank(book.synopsisUrl),
    coverUrl,
    coverSourceUrl: coverUrl === null ? null : nullIfBlank(book.coverSourceUrl),
  };
}

/** A full https link within the size the rules accept. */
export function isSecureLink(value: string): boolean {
  if (value.length > BOOK_LIMITS.link) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isUploadedCover(value: string): boolean {
  return value.length <= BOOK_LIMITS.uploadedCover && UPLOADED_COVER.test(value);
}

function linkErrors(book: Book): BookError[] {
  const errors: BookError[] = [];
  if (book.synopsisUrl !== null && !isSecureLink(book.synopsisUrl)) {
    errors.push('synopsis-link-invalid');
  }
  const cover = book.coverUrl;
  if (cover !== null && !isSecureLink(cover) && !isUploadedCover(cover)) {
    errors.push('cover-invalid');
  }
  return [...errors, ...coverSourceErrors(book)];
}

/** Every cover says where it came from: a catalog's page, or the page the member's image is from. */
function coverSourceErrors({ coverUrl, coverSourceUrl }: Book): BookError[] {
  if (coverSourceUrl !== null && !isSecureLink(coverSourceUrl)) return ['cover-source-invalid'];
  return coverUrl !== null && coverSourceUrl === null ? ['cover-source-missing'] : [];
}

/** A synopsis found by the search keeps its page; a pasted one may have none. */
function synopsisErrors({ synopsis, synopsisSource }: Book): BookError[] {
  const errors: BookError[] = [];
  if (synopsis !== null && synopsis.length > BOOK_LIMITS.synopsis) {
    errors.push('synopsis-too-long');
  }
  const knownSource = synopsisSource === null || SYNOPSIS_SOURCES.includes(synopsisSource);
  if (!knownSource || (synopsisSource !== null && synopsis === null)) {
    errors.push('synopsis-source-invalid');
  }
  return errors;
}

export function validateBook(book: Book): BookError[] {
  const errors: BookError[] = [];
  // A title with no letter or digit has no key to tell it apart from others.
  if (titleKey(book.title) === '') errors.push('title-missing');
  if (book.title.length > BOOK_LIMITS.title) errors.push('title-too-long');
  return [...errors, ...synopsisErrors(book), ...linkErrors(book)];
}

export interface TitleParts {
  title: string;
  author: string | null;
}

/** Explicit separators win over a comma, which titles also use ("Eu, Robô"). */
const AUTHOR_SEPARATORS = [' / ', ' — ', ' – ', ' - '];

/** [index, length] of the last explicit separator, if any. */
function lastExplicitSeparator(text: string): [number, number] | null {
  const found = AUTHOR_SEPARATORS.map((separator): [number, number] => [
    text.lastIndexOf(separator),
    separator.length,
  ])
    .filter(([index]) => index > 0)
    .sort((a, b) => b[0] - a[0]);
  return found[0] ?? null;
}

function lastSeparator(text: string): [number, number] | null {
  const comma = text.lastIndexOf(', ');
  return lastExplicitSeparator(text) ?? (comma > 0 ? [comma, 2] : null);
}

/**
 * Reads "Título, autor" (or "Título / autor", "Título - autor") from the
 * single field members type. Without a separator, it is all title.
 */
export function splitTitle(text: string): TitleParts {
  const separator = lastSeparator(text);
  if (!separator) return { title: text, author: null };
  const [index, length] = separator;
  const title = text.slice(0, index).trim();
  const author = text.slice(index + length).trim();
  return title && author ? { title, author } : { title: text, author: null };
}

const TITLE_ORDER = new Intl.Collator('pt-BR', { sensitivity: 'base', ignorePunctuation: true });

/** Alphabetical as a Brazilian reader expects: accents and case do not split groups. */
export function byTitle<T extends { book: Book }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => TITLE_ORDER.compare(a.book.title, b.book.title));
}
