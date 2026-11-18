import { useState } from 'react';

import { splitTitle } from '@/domain/book';
import type { Book, SynopsisSource } from '@/domain/types';
import { BookCover } from '@/ui/BookCover';
import { Button } from '@/ui/Button';
import { synopsisCredit } from '@/ui/synopsis-credit';
import { TextArea } from '@/ui/TextField';

import { CoverPicker } from './CoverPicker';
import { composeBook, type CoverChoice, type Draft } from './draft';
import styles from './NominationForm.module.css';
import {
  useCoverSearch,
  useFoundSynopsis,
  type CoverSearch,
  type SynopsisLookup,
} from './use-lookups';

/** Until the member picks, the best catalog match is the cover. */
function firstChoice(covers: CoverSearch): CoverChoice {
  const [best] = covers.status === 'ready' ? covers.options : [];
  return best ? { kind: 'catalog', option: best } : { kind: 'none' };
}

function BookPreview({ book }: { book: Book }) {
  const { title, author } = splitTitle(book.title);
  return (
    <div className={styles.preview}>
      <BookCover book={book} className={styles.previewCover} />
      <div>
        <p className={styles.previewTitle}>{title}</p>
        {author && <p className={styles.previewAuthor}>{author}</p>}
        <p className={styles.previewNote}>É assim que o clube vai ver sua indicação.</p>
      </div>
    </div>
  );
}

interface Edited {
  text: string;
  /** The source of the text the member started from. */
  source: SynopsisSource | null;
}

interface SynopsisFieldProps {
  synopsis: Edited;
  searching: boolean;
  onEdit: (edited: Edited) => void;
}

function SynopsisField({ synopsis, searching, onEdit }: SynopsisFieldProps) {
  const credit = synopsis.text.trim() ? synopsisCredit(synopsis.source) : null;
  return (
    <TextArea
      label="Sinopse (opcional)"
      value={synopsis.text}
      rows={6}
      maxLength={2000}
      disabled={searching}
      placeholder={searching ? 'Procurando sinopse…' : 'Nenhuma sinopse encontrada.'}
      hint={credit ? `${credit} Dá para editar.` : 'Aparece na votação e na aba Lendo.'}
      onChange={(event) => {
        onEdit({ text: event.target.value, source: synopsis.source });
      }}
    />
  );
}

/** What the member wrote wins; otherwise whatever was found for the chosen cover. */
function synopsisOf(edited: Edited | null, lookup: SynopsisLookup): Edited {
  if (edited) return edited;
  const found = lookup.status === 'done' ? lookup.found : null;
  return { text: found?.text ?? '', source: found?.source ?? null };
}

interface ReviewNominationProps {
  draft: Draft;
  onBack: () => void;
  onSend: (book: Book) => void;
}

export function ReviewNomination({ draft, onBack, onSend }: ReviewNominationProps) {
  const covers = useCoverSearch(draft.title.trim());
  const [picked, setPicked] = useState<CoverChoice | null>(null);
  const choice = picked ?? firstChoice(covers);
  const lookup = useFoundSynopsis(
    draft.link.trim() || null,
    choice.kind === 'catalog' ? choice.option : null,
  );
  const [edited, setEdited] = useState<Edited | null>(null);
  const synopsis = synopsisOf(edited, lookup);
  const book = composeBook(draft, choice, synopsis);

  return (
    <form
      className={styles.review}
      onSubmit={(event) => {
        event.preventDefault();
        onSend(book);
      }}
    >
      <BookPreview book={book} />
      <CoverPicker covers={covers} choice={choice} onPick={setPicked} />
      <SynopsisField
        synopsis={synopsis}
        searching={edited === null && lookup.status === 'loading'}
        onEdit={setEdited}
      />
      <div className={styles.actions}>
        <Button type="submit">Enviar indicação</Button>
        <Button variant="quiet" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
