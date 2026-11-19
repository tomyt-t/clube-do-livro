import type { CSSProperties } from 'react';

import type { Book } from '@/domain/types';
import { BookCover } from '@/ui/BookCover';
import { cx } from '@/ui/cx';

import styles from './GameViews.module.css';
import { DuckFigure, RingFigure, WrestlerFigure } from './figures';
import type { BattleMoment } from './playback';

/** A CSS custom property, which React's style type does not list. */
const custom = (name: string, value: number) => ({ [name]: value }) as CSSProperties;

/** Each duck carries a cover down its lane; the line is on the right. */
export function RaceView({ cast, progress }: { cast: readonly Book[]; progress: number[] }) {
  return (
    <div className={styles.race} style={custom('--lanes', cast.length)}>
      {cast.map((book, lane) => (
        <div key={lane} className={styles.lane}>
          <div className={styles.runner} style={custom('--at', progress[lane] ?? 0)}>
            <BookCover book={book} className={styles.rider} />
            <DuckFigure className={styles.duck} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface FighterProps {
  book: Book;
  health: number;
  /** The tick of the blow it just took or struck, which restarts the animation. */
  struck: number | null;
  striking: boolean;
  damage: number | null;
}

function Fighter({ book, health, struck, striking, damage }: FighterProps) {
  return (
    <li className={cx(styles.fighter, health <= 0 && styles.out, striking && styles.striking)}>
      <div key={struck ?? 'calm'} className={cx(styles.body, struck !== null && styles.struck)}>
        <BookCover book={book} className={styles.fighterCover} />
        {damage !== null && <span className={styles.damage}>−{Math.round(damage * 100)}</span>}
      </div>
      <span className={styles.health}>
        <span
          style={{
            inlineSize: `${String(Math.round(health * 100))}%`,
            backgroundColor: health > 0.35 ? '#3f9a5f' : '#e2532d',
          }}
        />
      </span>
    </li>
  );
}

/** Two columns for a few, more for a crowd, so everyone fits on a phone. */
function columnsFor(fighters: number): number {
  if (fighters <= 4) return 2;
  return fighters <= 9 ? 3 : 4;
}

/** Everyone in one arena, each with a health bar; the last one standing wins. */
export function BattleView({ cast, moment }: { cast: readonly Book[]; moment: BattleMoment }) {
  const { hp, blow } = moment;
  return (
    <ol className={styles.arena} style={custom('--columns', columnsFor(cast.length))}>
      {cast.map((book, seat) => {
        const struck = blow?.hit.to === seat ? blow.tick : null;
        return (
          <Fighter
            key={seat}
            book={book}
            health={hp[seat] ?? 1}
            struck={struck}
            striking={blow?.hit.from === seat}
            damage={struck === null ? null : (blow?.hit.damage ?? null)}
          />
        );
      })}
    </ol>
  );
}

/** Two wrestlers in the ring; whoever is pushed past the straw loses. */
export function SumoView({ cast, offset }: { cast: readonly Book[]; offset: number }) {
  const [left, right] = cast;
  if (!left || !right) return null;
  return (
    <div className={styles.ring}>
      <RingFigure className={styles.clay} />
      <div className={styles.pair} style={custom('--offset', offset)}>
        <div className={cx(styles.wrestler, styles.left, offset <= -1 && styles.fallen)}>
          <WrestlerFigure facing="right" className={styles.wrestlerBody} />
          <BookCover book={left} className={styles.badge} />
        </div>
        <div className={cx(styles.wrestler, styles.right, offset >= 1 && styles.fallen)}>
          <WrestlerFigure facing="left" className={styles.wrestlerBody} />
          <BookCover book={right} className={styles.badge} />
        </div>
      </div>
    </div>
  );
}
