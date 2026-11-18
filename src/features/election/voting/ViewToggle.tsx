import { cx } from '@/ui/cx';
import { CardsIcon, ListIcon } from '@/ui/icons';

import styles from './Ballot.module.css';

export type BallotView = 'list' | 'cards';

const VIEWS = [
  { view: 'list', label: 'Lista', Icon: ListIcon },
  { view: 'cards', label: 'Cartas', Icon: CardsIcon },
] as const;

/** Two ways to look at the same ballot: a list to mark, or one card at a time to read. */
export function ViewToggle({
  view,
  onChange,
}: {
  view: BallotView;
  onChange: (view: BallotView) => void;
}) {
  return (
    <div className={styles.toggle} role="group" aria-label="Ver como">
      {VIEWS.map(({ view: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          className={cx(view === option && styles.on)}
          aria-pressed={view === option}
          onClick={() => {
            onChange(option);
          }}
        >
          <Icon width={15} height={15} />
          {label}
        </button>
      ))}
    </div>
  );
}
