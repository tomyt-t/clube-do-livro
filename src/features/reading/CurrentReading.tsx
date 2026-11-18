import { useId } from 'react';

import { splitTitle } from '@/domain/book';
import type { Cycle, DecisionMethod, Winner } from '@/domain/types';
import { BookCover } from '@/ui/BookCover';
import { buttonClass } from '@/ui/button-class';
import { cx } from '@/ui/cx';
import { countOf, formatDay } from '@/ui/format';
import { ExternalIcon } from '@/ui/icons';

import styles from './CurrentReading.module.css';

/** "Escolhida …": how the club got to this book. */
const CHOSEN: Record<DecisionMethod, string> = {
  votes: 'na votação',
  'first-choices': 'no desempate',
  draw: 'no sorteio',
  unopposed: 'sem disputa',
};

/** Long titles step down a size so they do not break mid-word on a phone. */
const LONG_TITLE = 26;

interface CurrentReadingProps {
  cycle: Cycle;
  winner: Winner;
}

export function CurrentReading({ cycle, winner }: CurrentReadingProps) {
  const titleId = useId();
  const { title, author } = splitTitle(winner.book.title);
  const { synopsisUrl } = winner.book;

  return (
    <article className={styles.reading} aria-labelledby={titleId}>
      <div className={styles.hero}>
        <BookCover book={winner.book} className={styles.cover} />
        <div>
          <p className={styles.number}>Leitura nº {cycle.number}</p>
          <h2
            id={titleId}
            className={cx(styles.title, title.length > LONG_TITLE && styles.longTitle)}
          >
            {title}
          </h2>
          {author && <p className={styles.author}>{author}</p>}
        </div>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Lendo desde</dt>
          <dd>{formatDay(cycle.readingStartedAt ?? winner.decidedAt)}</dd>
        </div>
        <div>
          <dt>Escolhida</dt>
          <dd>{CHOSEN[winner.method]}</dd>
        </div>
        <div>
          <dt>Indicações</dt>
          <dd>{countOf(Math.max(cycle.options.length, 1), 'leitura', 'leituras')}</dd>
        </div>
      </dl>

      {synopsisUrl && (
        <div className={styles.actions}>
          <a
            className={buttonClass({ variant: 'secondary' })}
            href={synopsisUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalIcon width={18} height={18} />
            Ler sinopse
            <span className="visually-hidden"> (abre em outra aba)</span>
          </a>
        </div>
      )}
    </article>
  );
}
