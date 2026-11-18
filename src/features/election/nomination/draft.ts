import { normalizeBook, validateBook, type BookError } from '@/domain/book';
import type { Book, SynopsisSource } from '@/domain/types';
import type { CoverOption } from '@/services/covers';

/** What the member typed before choosing a cover. */
export interface Draft {
  title: string;
  link: string;
}

export const EMPTY_DRAFT: Draft = { title: '', link: '' };

export type CoverChoice =
  { kind: 'catalog'; option: CoverOption } | { kind: 'upload'; dataUrl: string } | { kind: 'none' };

export interface DraftErrors {
  title: string | null;
  link: string | null;
}

const MESSAGES: Partial<Record<BookError, string>> = {
  'title-missing': 'Escreva o título e, se quiser, o autor.',
  'title-too-long': 'Use até 200 caracteres.',
  'synopsis-link-invalid': 'Use um link completo, começando com https://.',
};

function firstMessage(errors: BookError[], codes: BookError[]): string | null {
  return errors.filter((error) => codes.includes(error)).map((error) => MESSAGES[error])[0] ?? null;
}

function bookFrom(draft: Draft, extra: Partial<Book> = {}): Book {
  return normalizeBook({
    title: draft.title,
    synopsis: null,
    synopsisSource: null,
    synopsisUrl: draft.link,
    coverUrl: null,
    ...extra,
  });
}

export function checkDraft(draft: Draft): DraftErrors {
  const errors = validateBook(bookFrom(draft));
  return {
    title: firstMessage(errors, ['title-missing', 'title-too-long']),
    link: firstMessage(errors, ['synopsis-link-invalid']),
  };
}

export function coverUrlOf(choice: CoverChoice): string | null {
  if (choice.kind === 'catalog') return choice.option.imageUrl;
  return choice.kind === 'upload' ? choice.dataUrl : null;
}

/** The book as it will be sent: what was typed, the chosen cover and the synopsis. */
export function composeBook(
  draft: Draft,
  choice: CoverChoice,
  synopsis: { text: string; source: SynopsisSource | null },
): Book {
  return bookFrom(draft, {
    coverUrl: coverUrlOf(choice),
    synopsis: synopsis.text,
    synopsisSource: synopsis.source,
  });
}
