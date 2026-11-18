import { useId } from 'react';

import { splitTitle } from '@/domain/book';
import type { Nomination } from '@/domain/types';
import { BookCover } from '@/ui/BookCover';
import { countOf } from '@/ui/format';

import styles from './NominationStep.module.css';

const REVEAL = 'A lista completa aparece quando todos responderem.';

function hiddenNote(count: number, hasOwn: boolean): string {
  if (count === 0) return `Nenhuma indicação ainda. ${REVEAL}`;
  return hasOwn ? `Você vê só a sua. ${REVEAL}` : `Elas ficam escondidas. ${REVEAL}`;
}

interface HiddenNominationsProps {
  /** How many readings were nominated so far. */
  count: number;
  /** The member's own nomination: the only one they see until everyone answered. */
  own: Nomination | null;
}

/** The nominations so far, kept hidden until everyone answered; never who sent them. */
export function HiddenNominations({ count, own }: HiddenNominationsProps) {
  const headingId = useId();
  const parts = own ? splitTitle(own.book.title) : null;

  return (
    <section className={styles.listSection} aria-labelledby={headingId}>
      <div className={styles.listHeading}>
        <h3 id={headingId}>Indicações até agora</h3>
        <span>{countOf(count, 'leitura', 'leituras')}</span>
      </div>
      {own && parts && (
        <ul className={styles.list}>
          <li className={styles.row}>
            <BookCover book={own.book} className={styles.thumb} />
            <div className={styles.rowText}>
              <p className={styles.rowTitle}>{parts.title}</p>
              {parts.author && <p className={styles.rowAuthor}>{parts.author}</p>}
            </div>
            <span className={styles.tag}>Sua indicação</span>
          </li>
        </ul>
      )}
      <p className={styles.empty}>{hiddenNote(count, own !== null)}</p>
    </section>
  );
}
