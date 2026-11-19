import { useState } from 'react';

import { splitTitle } from '@/domain/book';
import type { Book } from '@/domain/types';
import type { LookupResult } from '@/services/lookup';
import { BookCover } from '@/ui/BookCover';
import { Button } from '@/ui/Button';

import { CoverPicker } from './CoverPicker';
import {
  checkPicks,
  composeBook,
  coverIn,
  hasPickErrors,
  NO_PICK_ERRORS,
  synopsisIn,
  titleOf,
  type CoverPick,
  type Draft,
  type SynopsisPick,
} from './draft';
import styles from './NominationForm.module.css';
import { SynopsisPicker } from './SynopsisPicker';
import { useBookLookup } from './use-lookups';

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

/** Which reading the search settled on, so a wrong match is easy to spot. */
function FoundWork({ result }: { result: LookupResult | null }) {
  if (result === null) return null;
  const { work, others } = result;
  if (work === null) {
    return (
      <p className={styles.found}>
        Não achamos esta leitura nos catálogos. Envie uma capa e cole a sinopse, se quiser.
      </p>
    );
  }
  const by = work.authors.length > 0 ? `, de ${work.authors.join(', ')}` : '';
  const details = work.details ? ` (${work.details})` : '';
  return (
    <p className={styles.found}>
      Encontramos: <b>{work.title}</b>
      {by}
      {details}.{' '}
      {others.length > 0
        ? `Pode ser também ${others.map((other) => other.title).join(' ou ')}: se não for este, volte e escreva o autor.`
        : 'Se não for este, volte e escreva o autor.'}
    </p>
  );
}

interface ReviewNominationProps {
  draft: Draft;
  /** What the member picked, null until they do (the best found is used). */
  coverPick: CoverPick | null;
  synopsisPick: SynopsisPick | null;
  onCoverPick: (pick: CoverPick) => void;
  onSynopsisPick: (pick: SynopsisPick) => void;
  /** Back to the title and author, to change the reading. */
  onBack: () => void;
  onSend: (book: Book) => void;
}

/**
 * The reading as the club will see it: the cover and synopsis found for
 * it, which the member confirms, switches or replaces (always naming where
 * a replacement came from).
 */
export function ReviewNomination(props: ReviewNominationProps) {
  const { draft, onBack, onSend } = props;
  const lookup = useBookLookup(titleOf(draft));
  const result = lookup.status === 'done' ? lookup.result : null;
  const [tried, setTried] = useState(false);
  const cover = coverIn(result, props.coverPick);
  const synopsis = synopsisIn(result, props.synopsisPick);
  const book = composeBook(draft, cover, synopsis);
  const errors = tried ? checkPicks(draft, cover, synopsis) : NO_PICK_ERRORS;

  return (
    <form
      className={styles.review}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (!hasPickErrors(checkPicks(draft, cover, synopsis))) onSend(book);
      }}
    >
      <Button variant="quiet" className={styles.change} onClick={onBack}>
        Voltar e trocar o livro
      </Button>
      <BookPreview book={book} />
      <FoundWork result={result} />
      <CoverPicker
        covers={result?.covers ?? null}
        pick={cover}
        sourceError={errors.coverSource}
        onPick={props.onCoverPick}
      />
      <SynopsisPicker
        options={result?.synopses ?? null}
        pick={synopsis}
        error={errors.synopsisText}
        title={titleOf(draft)}
        onPick={props.onSynopsisPick}
      />
      <div className={styles.actions}>
        <Button type="submit" disabled={result === null}>
          {result === null ? 'Buscando capa e sinopse…' : 'Enviar indicação'}
        </Button>
        <Button variant="quiet" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
