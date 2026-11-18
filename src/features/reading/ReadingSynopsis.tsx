import { useId, useState } from 'react';

import type { Book } from '@/domain/types';
import { cx } from '@/ui/cx';
import { SynopsisText } from '@/ui/SynopsisText';
import { synopsisCredit } from '@/ui/synopsis-credit';

import styles from './ReadingSynopsis.module.css';

/** Longer than this, the synopsis starts folded with "Ler mais". */
const FOLD_AFTER = 360;

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (abre em outra aba)</span>
    </a>
  );
}

/** The synopsis text, its credit and the member's link, if any. */
export function ReadingSynopsis({ book, text }: { book: Book; text: string }) {
  const textId = useId();
  const [open, setOpen] = useState(false);
  const foldable = text.length > FOLD_AFTER;
  const credit = synopsisCredit(book.synopsisSource);

  return (
    <section className={styles.synopsis} aria-label="Sinopse">
      <SynopsisText id={textId} text={text} className={cx(foldable && !open && styles.folded)} />
      {foldable && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => {
            setOpen((value) => !value);
          }}
        >
          {open ? 'Mostrar menos' : 'Ler mais'}
        </button>
      )}
      {(credit ?? book.synopsisUrl) && (
        <p className={styles.credit}>
          {credit}
          {credit && book.synopsisUrl && ' '}
          {book.synopsisUrl && <ExternalLink href={book.synopsisUrl}>Abrir o link</ExternalLink>}
        </p>
      )}
    </section>
  );
}
