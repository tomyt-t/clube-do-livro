import type { Book } from './types';

/** Field limits. `firestore.rules` enforces the same numbers server-side. */
export const BOOK_LIMITS = {
  title: 200,
  author: 120,
  authors: 10,
  synopsis: 4000,
  link: 1000,
  /** Characters of an uploaded cover's data URL (≈150 KB of image). */
  uploadedCover: 200_000,
} as const;

const UPLOADED_COVER = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export type BookError =
  | 'title-missing'
  | 'title-too-long'
  | 'too-many-authors'
  | 'author-too-long'
  | 'synopsis-too-long'
  | 'synopsis-link-invalid'
  | 'cover-invalid';

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function nullIfBlank(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Trims fields, drops empty authors and keeps paragraph breaks in the synopsis. */
export function normalizeBook(book: Book): Book {
  return {
    ...book,
    title: cleanText(book.title),
    authors: book.authors.map(cleanText).filter(Boolean),
    synopsis: book.synopsis
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
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

function authorErrors(authors: readonly string[]): BookError[] {
  const errors: BookError[] = [];
  if (authors.length > BOOK_LIMITS.authors) errors.push('too-many-authors');
  if (authors.some((author) => author.length > BOOK_LIMITS.author)) errors.push('author-too-long');
  return errors;
}

export function validateBook(book: Book): BookError[] {
  const errors: BookError[] = [];
  if (book.title.length === 0) errors.push('title-missing');
  if (book.title.length > BOOK_LIMITS.title) errors.push('title-too-long');
  if (book.synopsis.length > BOOK_LIMITS.synopsis) errors.push('synopsis-too-long');
  return [...errors, ...authorErrors(book.authors), ...linkErrors(book)];
}

export function formatAuthors(authors: readonly string[]): string {
  return new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(authors);
}
