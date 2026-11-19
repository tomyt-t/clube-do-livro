import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { splitTitle } from '@/domain/book';
import type { Book } from '@/domain/types';
import { BookCover } from '@/ui/BookCover';
import { Button } from '@/ui/Button';
import { useMediaQuery } from '@/ui/use-media-query';

import styles from './DrawShow.module.css';
import { BattleView, RaceView, SumoView } from './GameViews';
import { castOf, planMatch, type GameKind, type Match } from './match';
import { battleAt, raceAt, sumoAt, tickAt, usePlayback } from './playback';

/** How long the tie is shown before the match starts on its own. */
const TIE_MS = 2600;
/** A pause on the last frame before the result. */
const FINALE_MS = 900;

const GAME_NAMES: Record<GameKind, string> = {
  race: 'uma corrida de patos',
  battle: 'uma batalha',
  sumo: 'uma luta de sumô',
};

const DRAW_DATE = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

type Phase = 'tie' | 'match' | 'result';

export interface DrawShowProps {
  heading: string;
  /** The tied readings, in ballot order. */
  tied: readonly Book[];
  /** The recorded winner's position in `tied`. */
  winner: number;
  /** The same seed always plays the same match. */
  seed: string;
  drawnAt: Date;
  /** Once the dialog is on screen. */
  onShown?: () => void;
  onClose: () => void;
}

const titleOf = (book: Book) => splitTitle(book.title).title;

function TiePanel({ tied, game }: { tied: readonly Book[]; game: GameKind }) {
  return (
    <>
      <p className={styles.lead}>
        {tied.length} leituras empataram em votos e em 1ª opção. Quem decide é {GAME_NAMES[game]}.
      </p>
      <ul className={styles.tied}>
        {tied.map((book, index) => (
          <li key={index}>
            <BookCover book={book} />
            <span>{titleOf(book)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Stage({ match, cast, elapsed }: { match: Match; cast: Book[]; elapsed: number }) {
  if (match.game === 'race') {
    return <RaceView cast={cast} progress={raceAt(match.frames, elapsed, match.tickMs)} />;
  }
  if (match.game === 'sumo') {
    return <SumoView cast={cast} offset={sumoAt(match.frames, elapsed, match.tickMs)} />;
  }
  const { index } = tickAt(match, elapsed);
  return <BattleView cast={cast} moment={battleAt(match.frames, index)} />;
}

function ResultPanel({ book, tied, drawnAt }: { book: Book; tied: number; drawnAt: Date }) {
  const { title, author } = splitTitle(book.title);
  return (
    <div className={styles.result}>
      <BookCover book={book} className={styles.winnerCover} />
      <p className={styles.kicker}>Venceu o sorteio</p>
      <p className={styles.winnerTitle}>{title}</p>
      {author && <p className={styles.author}>{author}</p>}
      <p className={styles.caption}>
        Sorteio entre {tied} leituras empatadas, em {DRAW_DATE.format(drawnAt)}.
      </p>
    </div>
  );
}

/** Opens as a modal on mount: focus stays inside and Esc closes it. */
function useModal(onShown: (() => void) | undefined) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    onShown?.();
    return () => {
      dialog?.close();
    };
  }, [onShown]);
  return ref;
}

/** How long until the show moves on by itself: after the tie, and after the match ends. */
function waitAfter(phase: Phase, ended: boolean): number | null {
  if (phase === 'tie') return TIE_MS;
  return ended ? FINALE_MS : null;
}

/** The phase on screen, moving on by itself after the tie and after the match. */
function usePhases(match: Match) {
  const calm = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [phase, setPhase] = useState<Phase>(calm ? 'result' : 'tie');
  const [paused, setPaused] = useState(false);
  const playback = usePlayback(match, phase === 'match' && !paused);
  const ended = phase === 'match' && playback.elapsed >= playback.duration;

  useEffect(() => {
    const wait = waitAfter(phase, ended);
    if (wait === null) return undefined;
    const timer = setTimeout(() => {
      setPhase(phase === 'tie' ? 'match' : 'result');
    }, wait);
    return () => {
      clearTimeout(timer);
    };
  }, [phase, ended]);

  const replay = () => {
    playback.setElapsed(0);
    setPaused(false);
    setPhase('tie');
  };
  return { phase, setPhase, paused, setPaused, elapsed: playback.elapsed, calm, replay };
}

/**
 * The draw staged as a game: first the tie, then a match whose winner wears
 * the cover the draw chose, then the result with the date of the draw.
 * Reduced motion goes straight to the result.
 */
export function DrawShow({
  heading,
  tied,
  winner,
  seed,
  drawnAt,
  onShown,
  onClose,
}: DrawShowProps) {
  const headingId = useId();
  const ref = useModal(onShown);
  const match = useMemo(() => planMatch(tied.length, seed), [tied.length, seed]);
  const cast = useMemo(() => castOf(tied, winner, match.winner), [tied, winner, match.winner]);
  const show = usePhases(match);
  const champion = tied[winner];

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.body} data-paused={show.paused || undefined}>
        <h2 id={headingId} className={styles.title}>
          {heading}
        </h2>
        {show.phase === 'tie' && <TiePanel tied={tied} game={match.game} />}
        {show.phase === 'match' && <Stage match={match} cast={cast} elapsed={show.elapsed} />}
        {show.phase === 'result' && champion && (
          <ResultPanel book={champion} tied={tied.length} drawnAt={drawnAt} />
        )}
        <p className="visually-hidden" aria-live="polite">
          {show.phase === 'match' ? `Começou ${GAME_NAMES[match.game]}.` : ''}
        </p>
      </div>
      <Controls show={show} onClose={onClose} />
    </dialog>
  );
}

function Controls({ show, onClose }: { show: ReturnType<typeof usePhases>; onClose: () => void }) {
  if (show.phase === 'result') {
    return (
      <div className={styles.controls}>
        {!show.calm && (
          <Button variant="quiet" onClick={show.replay}>
            Ver de novo
          </Button>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </div>
    );
  }
  return (
    <div className={styles.controls}>
      {show.phase === 'match' && (
        <Button
          variant="secondary"
          onClick={() => {
            show.setPaused(!show.paused);
          }}
        >
          {show.paused ? 'Continuar' : 'Pausar'}
        </Button>
      )}
      <Button
        variant="quiet"
        onClick={() => {
          show.setPhase('result');
        }}
      >
        Pular
      </Button>
    </div>
  );
}
