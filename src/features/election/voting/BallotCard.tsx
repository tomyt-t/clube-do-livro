import { motion } from 'motion/react';

import { splitTitle } from '@/domain/book';
import type { Nomination } from '@/domain/types';
import { BookCover } from '@/ui/BookCover';
import { cx } from '@/ui/cx';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CrossIcon } from '@/ui/icons';
import { synopsisCredit } from '@/ui/synopsis-credit';
import { SynopsisText } from '@/ui/SynopsisText';
import { useOverlayScrollbar } from '@/ui/use-overlay-scrollbar';

import { rankLabel } from './ballot-draft';
import { swipeDirection } from './deck';
import styles from './BallotDeck.module.css';

export interface CardState {
  rank: number | null;
  disliked: boolean;
  own: boolean;
  /** False when both choices are taken by other books. */
  canPick: boolean;
}

function Badge({ state }: { state: CardState }) {
  if (state.own) return <span className={cx(styles.badge, styles.badgeOwn)}>Sua indicação</span>;
  if (state.rank !== null) {
    return (
      <span className={styles.badge}>
        <i aria-hidden="true">{state.rank}</i>
        {rankLabel(state.rank)}
      </span>
    );
  }
  return state.disliked ? (
    <span className={cx(styles.badge, styles.badgeNo)}>Não curti</span>
  ) : null;
}

function Synopsis({ nomination }: { nomination: Nomination }) {
  const { areaRef, barRef } = useOverlayScrollbar<HTMLDivElement, HTMLSpanElement>();
  const { synopsis, synopsisSource, synopsisUrl } = nomination.book;
  const credit = synopsisCredit(synopsisSource);
  const link = synopsisUrl && (
    <a href={synopsisUrl} target="_blank" rel="noopener noreferrer">
      {synopsis ? 'Abrir o link' : 'Ler a sinopse no link'}
      <span className="visually-hidden"> (abre em outra aba)</span>
    </a>
  );

  return (
    <>
      <div ref={areaRef} className={styles.synopsis}>
        {synopsis ? (
          <SynopsisText text={synopsis} />
        ) : (
          <p className={styles.noSynopsis}>Esta leitura veio sem sinopse.</p>
        )}
        {(credit ?? link) && (
          <p className={styles.credit}>
            {credit} {link}
          </p>
        )}
      </div>
      <span ref={barRef} className={styles.scrollbar} aria-hidden="true" />
    </>
  );
}

interface BallotCardProps {
  nomination: Nomination;
  position: number;
  total: number;
  state: CardState;
  /** -1 when it came from the left, 1 from the right. */
  direction: number;
  chevrons: boolean;
  onPick: () => void;
  onDislike: () => void;
  onMove: (step: -1 | 1) => void;
}

export function BallotCard(props: BallotCardProps) {
  const { nomination, position, total, state, direction, chevrons, onPick, onDislike, onMove } =
    props;
  const { title, author } = splitTitle(nomination.book.title);

  return (
    <motion.article
      className={cx(
        styles.card,
        state.rank !== null && styles.chosen,
        state.disliked && styles.disliked,
      )}
      aria-roledescription="carta"
      aria-label={`Leitura ${String(position)} de ${String(total)}: ${title}`}
      initial={{ x: direction * 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.5}
      onDragEnd={(_event, info) => {
        const step = swipeDirection(info);
        if (step !== 0) onMove(step);
      }}
    >
      <div className={styles.head}>
        <BookCover book={nomination.book} className={styles.cover} />
        <div>
          <Badge state={state} />
          <h3 className={styles.title}>{title}</h3>
          {author && <p className={styles.author}>{author}</p>}
        </div>
      </div>
      <Synopsis nomination={nomination} />
      {chevrons && <Chevrons position={position} total={total} onMove={onMove} />}
      <CardActions state={state} onPick={onPick} onDislike={onDislike} />
    </motion.article>
  );
}

/** Desktop only: where this card sits, and arrows on the card's edges. */
function Chevrons({
  position,
  total,
  onMove,
}: Pick<BallotCardProps, 'position' | 'total' | 'onMove'>) {
  return (
    <>
      <span className={styles.count}>
        {position} de {total}
      </span>
      <button
        type="button"
        className={cx(styles.flip, styles.prev)}
        aria-label="Leitura anterior"
        onClick={() => {
          onMove(-1);
        }}
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        className={cx(styles.flip, styles.next)}
        aria-label="Próxima leitura"
        onClick={() => {
          onMove(1);
        }}
      >
        <ChevronRightIcon />
      </button>
    </>
  );
}

/** ✕ is a private note; ✓ chooses the reading. */
function CardActions({
  state,
  onPick,
  onDislike,
}: Pick<BallotCardProps, 'state' | 'onPick' | 'onDislike'>) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={cx(styles.no, state.disliked && styles.on)}
        aria-pressed={state.disliked}
        aria-label="Não curti (só você vê)"
        onClick={onDislike}
      >
        <CrossIcon />
      </button>
      <button
        type="button"
        className={cx(styles.yes, state.rank !== null && styles.on)}
        aria-pressed={state.rank !== null}
        aria-label={
          state.rank === null ? 'Escolher esta leitura' : `Tirar da ${rankLabel(state.rank)}`
        }
        disabled={state.own || (state.rank === null && !state.canPick)}
        onClick={onPick}
      >
        <CheckIcon />
      </button>
    </div>
  );
}
