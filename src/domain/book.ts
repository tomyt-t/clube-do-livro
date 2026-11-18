import type { Book } from './types';

/** Field limits. `firestore.rules` enforces the same numbers server-side. */
export const BOOK_LIMITS = {
  title: 200,
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
  'title-missing' | 'title-too-long' | 'synopsis-link-invalid' | 'cover-invalid';

function nullIfBlank(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Collapses whitespace in the title and turns blank links into no link. */
export function normalizeBook(book: Book): Book {
  return {
    title: book.title.replace(/\s+/g, ' ').trim(),
    synopsisUrl: nullIfBlank(book.synopsisUrl),
    coverUrl: nullIfBlank(book.coverUrl),
  };
}

function isSecureLink(value: string): boolean {
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
  return errors;
}

export function validateBook(book: Book): BookError[] {
  const errors: BookError[] = [];
  if (book.title.length === 0) errors.push('title-missing');
  if (book.title.length > BOOK_LIMITS.title) errors.push('title-too-long');
  return [...errors, ...linkErrors(book)];
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
