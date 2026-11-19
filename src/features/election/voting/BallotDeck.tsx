import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Nomination, NominationId } from '@/domain/types';
import { cx } from '@/ui/cx';

import { rankOf, type BallotDraft } from './ballot-draft';
import { BallotCard } from './BallotCard';
import styles from './BallotDeck.module.css';
import { cardAfter, deckStep } from './deck';

/** Lets CSS size the deck to the screen space left below it. */
function useDeckTop() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const deck = ref.current;
    if (!deck) return;
    const measure = () => {
      const top = deck.getBoundingClientRect().top + window.scrollY;
      deck.style.setProperty('--deck-top', `${String(Math.round(top))}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);
  return ref;
}

interface BallotDeckProps {
  options: readonly Nomination[];
  ballot: BallotDraft;
  required: number;
  own: NominationId | null;
  /** Desktop: chevrons inside the card and the keyboard hint. */
  wide: boolean;
  /** Off while a dialog is open, so arrows do not move cards behind it. */
  keyboard: boolean;
  /** The reading to open on (its synopsis was tapped in the list); the first otherwise. */
  startAt?: NominationId | null;
  onPick: (id: NominationId) => void;
  onDislike: (id: NominationId) => void;
}

/** One reading at a time, to read the synopsis; swipe or use the arrows to move on. */
export function BallotDeck({
  options,
  ballot,
  required,
  own,
  wide,
  keyboard,
  startAt = null,
  ...on
}: BallotDeckProps) {
  const deckRef = useDeckTop();
  const [at, setAt] = useState(() => ({
    index: Math.max(
      0,
      options.findIndex((option) => option.id === startAt),
    ),
    direction: 0,
  }));
  const total = options.length;

  const move = useCallback(
    (step: -1 | 1) => {
      setAt((current) => ({ index: cardAfter(current.index, step, total), direction: step }));
    },
    [total],
  );

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (event: KeyboardEvent) => {
      const step = deckStep(event);
      if (step === 0) return;
      event.preventDefault();
      move(step);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [keyboard, move]);

  const index = Math.min(at.index, total - 1);
  const nomination = options[index];
  if (!nomination) return null;
  const { id } = nomination;

  return (
    <div className={styles.area}>
      <div ref={deckRef} className={styles.deck}>
        <span className={cx(styles.back, styles.back2)} aria-hidden="true" />
        <span className={cx(styles.back, styles.back1)} aria-hidden="true" />
        <BallotCard
          key={id}
          nomination={nomination}
          position={index + 1}
          total={total}
          direction={at.direction}
          chevrons={wide}
          state={{
            rank: rankOf(ballot, id),
            disliked: ballot.disliked.includes(id),
            own: id === own,
            canPick: ballot.picks.length < required,
          }}
          onPick={() => {
            on.onPick(id);
          }}
          onDislike={() => {
            on.onDislike(id);
          }}
          onMove={move}
        />
      </div>
      <p className="visually-hidden" aria-live="polite">
        Leitura {index + 1} de {total}
      </p>
      {wide && (
        <p className={styles.keys} aria-hidden="true">
          <kbd>←</kbd> <kbd>→</kbd> passar
        </p>
      )}
    </div>
  );
}
