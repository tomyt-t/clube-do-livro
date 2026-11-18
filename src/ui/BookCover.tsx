import { useMemo, useState } from 'react';

import { splitTitle } from '@/domain/book';
import type { Book } from '@/domain/types';

import styles from './BookCover.module.css';
import { cx } from './cx';
import { isSafeDataImage } from './data-image';

interface BookCoverProps {
  book: Book;
  className?: string;
}

/**
 * The cover as an object on the page: a hint of spine and a soft shadow.
 * The title is set on plain cloth underneath, so there is something to see
 * while a slow catalog image loads, or if it never does. Decorative: the
 * title is always written next to it.
 */
/** A cover worth loading: catalog links always; uploads only if their declared size is sane. */
function showable(coverUrl: string | null): string | null {
  if (coverUrl === null) return null;
  return !coverUrl.startsWith('data:') || isSafeDataImage(coverUrl) ? coverUrl : null;
}

export function BookCover({ book, className }: BookCoverProps) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const cover = useMemo(() => showable(book.coverUrl), [book.coverUrl]);
  const image = cover !== null && failed !== cover ? cover : null;

  return (
    <div className={cx(styles.cover, className)} aria-hidden="true">
      <span className={styles.plain}>{splitTitle(book.title).title}</span>
      {image && (
        <img
          className={cx(styles.image, loaded === image && styles.loaded)}
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => {
            setLoaded(image);
          }}
          onError={() => {
            setFailed(image);
          }}
        />
      )}
    </div>
  );
}
