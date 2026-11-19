import { normalizeBook, validateBook, type BookError } from '@/domain/book';
import type { Book } from '@/domain/types';
import type { CoverChoice, LookupResult, SynopsisChoice } from '@/services/lookup';

/** What the member typed: the title and, if they want, the author. */
export interface Draft {
  title: string;
  author: string;
}

export const EMPTY_DRAFT: Draft = { title: '', author: '' };

/** "Torto Arado, Itamar Vieira Junior": the one text the club stores and shows. */
export function titleOf(draft: Draft): string {
  const title = draft.title.trim();
  const author = draft.author.trim();
  return author ? `${title}, ${author}` : title;
}

/** A cover found by the search, an image the member sent (with its page), or none. */
export type CoverPick =
  | { kind: 'found'; cover: CoverChoice }
  | { kind: 'upload'; dataUrl: string; sourceUrl: string }
  | { kind: 'none' };

/**
 * A synopsis found by the search as it is; one the member wrote or edited
 * (`from` is the found one they started from); or none.
 */
export type SynopsisPick =
  | { kind: 'found'; option: SynopsisChoice }
  | { kind: 'own'; text: string; sourceUrl: string; from: SynopsisChoice | null }
  | { kind: 'none' };

/** Until the member picks, the best of each that was found. */
export function firstCover(result: LookupResult | null): CoverPick {
  const [best] = result?.covers ?? [];
  return best ? { kind: 'found', cover: best } : { kind: 'none' };
}

export function firstSynopsis(result: LookupResult | null): SynopsisPick {
  const [best] = result?.synopses ?? [];
  return best ? { kind: 'found', option: best } : { kind: 'none' };
}

function coverFields(pick: CoverPick): Pick<Book, 'coverUrl' | 'coverSourceUrl'> {
  if (pick.kind === 'found')
    return { coverUrl: pick.cover.url, coverSourceUrl: pick.cover.sourceUrl };
  if (pick.kind === 'upload') return { coverUrl: pick.dataUrl, coverSourceUrl: pick.sourceUrl };
  return { coverUrl: null, coverSourceUrl: null };
}

function synopsisFields(
  pick: SynopsisPick,
): Pick<Book, 'synopsis' | 'synopsisSource' | 'synopsisUrl'> {
  if (pick.kind === 'found') {
    const { text, source, sourceUrl } = pick.option;
    return { synopsis: text, synopsisSource: source, synopsisUrl: sourceUrl };
  }
  if (pick.kind === 'own') {
    // Edited from a found one, it keeps that credit; written from scratch, it has none.
    return {
      synopsis: pick.text,
      synopsisSource: pick.from?.source ?? null,
      synopsisUrl: pick.sourceUrl,
    };
  }
  return { synopsis: null, synopsisSource: null, synopsisUrl: null };
}

/** The book as it will be sent. */
export function composeBook(draft: Draft, cover: CoverPick, synopsis: SynopsisPick): Book {
  return normalizeBook({
    title: titleOf(draft),
    ...synopsisFields(synopsis),
    ...coverFields(cover),
  });
}

const LINK = 'Use um link completo, começando com https://.';

const MESSAGES: Partial<Record<BookError, string>> = {
  'title-missing': 'Escreva o título da leitura.',
  'title-too-long': 'Título e autor somam mais de 200 caracteres.',
  'synopsis-too-long': 'Use até 2.000 caracteres.',
  'synopsis-link-missing': 'Cole o link da página de onde veio a sinopse.',
  'synopsis-link-invalid': LINK,
  'cover-source-missing': 'Cole o link da página de onde veio a imagem.',
  'cover-source-invalid': LINK,
};

function firstMessage(errors: BookError[], codes: BookError[]): string | null {
  return errors.filter((error) => codes.includes(error)).map((error) => MESSAGES[error])[0] ?? null;
}

/** Only typos stop the member: a reading nominated twice is sorted out after the call. */
export function checkDraft(draft: Draft): string | null {
  // The author alone is no title, though "Título, autor" would read as one.
  if (draft.title.trim() === '') return MESSAGES['title-missing'] ?? null;
  const errors = validateBook(composeBook(draft, { kind: 'none' }, { kind: 'none' }));
  return firstMessage(errors, ['title-missing', 'title-too-long']);
}

export interface PickErrors {
  coverSource: string | null;
  synopsisText: string | null;
  synopsisLink: string | null;
}

export const NO_PICK_ERRORS: PickErrors = {
  coverSource: null,
  synopsisText: null,
  synopsisLink: null,
};

export function checkPicks(draft: Draft, cover: CoverPick, synopsis: SynopsisPick): PickErrors {
  const errors = validateBook(composeBook(draft, cover, synopsis));
  const blank = synopsis.kind === 'own' && synopsis.text.trim() === '';
  return {
    coverSource: firstMessage(errors, ['cover-source-missing', 'cover-source-invalid']),
    synopsisText: blank
      ? 'Escreva a sinopse, ou escolha “Sem sinopse”.'
      : firstMessage(errors, ['synopsis-too-long']),
    synopsisLink: blank
      ? null
      : firstMessage(errors, ['synopsis-link-missing', 'synopsis-link-invalid']),
  };
}

export const hasPickErrors = (errors: PickErrors) =>
  errors.coverSource !== null || errors.synopsisText !== null || errors.synopsisLink !== null;
