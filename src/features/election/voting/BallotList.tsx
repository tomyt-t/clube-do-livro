import { splitTitle } from '@/domain/book';
import type { Nomination, NominationId } from '@/domain/types';
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
}

/** Mark-only view: tap a row to choose it; the first tap is the first choice. */
export function BallotList({ options, ballot, required, own, onPick }: BallotListProps) {
  const full = ballot.picks.length >= required;
  return (
    <ul className={styles.list}>
      {options.map(({ id, book }) => {
        const { title, author } = splitTitle(book.title);
        const rank = rankOf(ballot, id);
        const isOwn = id === own;
        const disliked = ballot.disliked.includes(id);
        return (
          <li key={id}>
            <label className={cx(styles.row, rank !== null && styles.picked, isOwn && styles.own)}>
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
          </li>
        );
      })}
    </ul>
  );
}
