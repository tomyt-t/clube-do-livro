import { splitTitle } from '@/domain/book';
import type { Book, Nomination, NominationId } from '@/domain/types';
import { BookCover } from '@/ui/BookCover';
import { cx } from '@/ui/cx';

import { rankLabel, rankOf, type BallotDraft } from './ballot-draft';
import styles from './BallotList.module.css';

interface BallotListProps {
  options: readonly Nomination[];
  ballot: BallotDraft;
  required: number;
  own: NominationId | null;
  onPick: (id: NominationId) => void;
  /** Opens the reading's card, to read its whole synopsis. */
  onRead: (id: NominationId) => void;
}

/** Enough text to fill the faded lines; the card shows the rest. */
const EXCERPT = 360;

function excerptOf(book: Book): string {
  if (book.synopsis) return book.synopsis.slice(0, EXCERPT);
  return book.synopsisUrl ? 'Sinopse no link.' : 'Sem sinopse.';
}

/**
 * Mark-only view: tap a row to choose it; the first tap is the first
 * choice. The synopsis beside it opens the reading's card instead.
 */
export function BallotList({ options, ballot, required, own, onPick, onRead }: BallotListProps) {
  const full = ballot.picks.length >= required;
  return (
    <ul className={styles.list}>
      {options.map(({ id, book }) => {
        const { title, author } = splitTitle(book.title);
        const rank = rankOf(ballot, id);
        const isOwn = id === own;
        const disliked = ballot.disliked.includes(id);
        return (
          <li
            key={id}
            className={cx(styles.item, rank !== null && styles.picked, isOwn && styles.own)}
          >
            <label className={styles.row}>
              <input
                type="checkbox"
                className="visually-hidden"
                checked={rank !== null}
                disabled={isOwn || (rank === null && full)}
                onChange={() => {
                  onPick(id);
                }}
              />
              <BookCover book={book} className={styles.thumb} />
              <span className={styles.text}>
                <span className={styles.title}>{title}</span>
                <span className={styles.author}>{isOwn ? 'Sua indicação' : author}</span>
                {disliked && <span className={styles.disliked}>Não curti</span>}
              </span>
              <span className={styles.box} aria-hidden="true">
                {rank}
              </span>
              {rank !== null && <span className="visually-hidden"> ({rankLabel(rank)})</span>}
            </label>
            <button
              type="button"
              className={cx(styles.read, !book.synopsis && styles.empty)}
              aria-label={`Ler a sinopse de ${title}`}
              onClick={() => {
                onRead(id);
              }}
            >
              <span className={styles.excerpt} aria-hidden="true">
                {excerptOf(book)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
