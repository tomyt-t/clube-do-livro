import { normalizeBook, validateBook, type BookError } from '@/domain/book';
import type { Book } from '@/domain/types';

export class InvalidBookError extends Error {
  readonly errors: BookError[];

  constructor(errors: BookError[]) {
    super(`Livro inválido: ${errors.join(', ')}`);
    this.name = 'InvalidBookError';
    this.errors = errors;
  }
}

/** Rules accept links as printable ASCII, so links are stored URL-encoded. */
function encodeLink(link: string | null): string | null {
  if (link === null || link.startsWith('data:')) return link;
  try {
    return new URL(link).href;
  } catch {
    return link;
  }
}

/** The exact shape `firestore.rules` accepts for a book. Throws if invalid. */
export function toBookData(book: Book): Book {
  const clean = normalizeBook(book);
  const data: Book = {
    title: clean.title,
    synopsisUrl: encodeLink(clean.synopsisUrl),
    coverUrl: encodeLink(clean.coverUrl),
  };
  const errors = validateBook(data);
  if (errors.length > 0) throw new InvalidBookError(errors);
  return data;
}
