import { AnimatePresence, motion } from 'motion/react';
import { useId } from 'react';

import { splitTitle } from '@/domain/book';
import type { Nomination, NominationId } from '@/domain/types';
import { BookCover } from '@/ui/BookCover';
import { countOf } from '@/ui/format';

import styles from './NominationStep.module.css';

const ARRIVAL = { duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const;

interface NominationListProps {
  /** Already in the order to show. */
  nominations: readonly Nomination[];
  own: NominationId | null;
  title?: string;
}

/** Every nomination so far, never who sent it. New ones slide into place. */
export function NominationList({
  nominations,
  own,
  title = 'Indicações até agora',
}: NominationListProps) {
  const headingId = useId();
  return (
    <section className={styles.listSection} aria-labelledby={headingId}>
      <div className={styles.listHeading}>
        <h3 id={headingId}>{title}</h3>
        <span>{countOf(nominations.length, 'leitura', 'leituras')}</span>
      </div>
      {nominations.length === 0 ? (
        <p className={styles.empty}>Nenhuma indicação ainda.</p>
      ) : (
        <ul className={styles.list}>
          <AnimatePresence initial={false}>
            {nominations.map(({ id, book }) => {
              const { title, author } = splitTitle(book.title);
              return (
                <motion.li
                  key={id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={ARRIVAL}
                  className={styles.row}
                >
                  <BookCover book={book} className={styles.thumb} />
                  <div className={styles.rowText}>
                    <p className={styles.rowTitle}>{title}</p>
                    {author && <p className={styles.rowAuthor}>{author}</p>}
                  </div>
                  {id === own && <span className={styles.tag}>Sua indicação</span>}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
