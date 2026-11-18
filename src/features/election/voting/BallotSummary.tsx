import { splitTitle } from '@/domain/book';
import type { Nomination } from '@/domain/types';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { cx } from '@/ui/cx';
import { SwapIcon } from '@/ui/icons';
import { Notice } from '@/ui/Notice';

import { rankLabel } from './ballot-draft';
import styles from './Ballot.module.css';

const titleOf = (nomination: Nomination) => splitTitle(nomination.book.title).title;

interface SummaryProps {
  picks: readonly Nomination[];
  required: number;
  complete: boolean;
  onSwap: () => void;
  onConfirm: () => void;
}

function SwapButton({ onSwap }: { onSwap: () => void }) {
  return (
    <button type="button" className={styles.swap} onClick={onSwap} aria-label="Inverter a ordem">
      <SwapIcon width={20} height={20} />
    </button>
  );
}

/** Desktop sidebar: the choices in order, the swap and the confirm button. */
export function SideSummary({ picks, required, complete, onSwap, onConfirm }: SummaryProps) {
  const slots = Array.from({ length: required }, (_, index) => picks[index]);
  return (
    <section className={styles.summary} aria-label="Suas escolhas">
      <div className={styles.summaryHeading}>
        <h3>Suas escolhas</h3>
        {picks.length === 2 && <SwapButton onSwap={onSwap} />}
      </div>
      <ol className={styles.slots}>
        {slots.map((pick, index) => (
          <li key={pick?.id ?? `empty-${String(index)}`} className={cx(!pick && styles.empty)}>
            <i>{index + 1}</i>
            {pick ? titleOf(pick) : 'Falta escolher'}
          </li>
        ))}
      </ol>
      <Button block disabled={!complete} onClick={onConfirm}>
        Confirmar voto
      </Button>
      <p className={styles.note}>O voto é anônimo e não pode ser mudado depois de confirmado.</p>
    </section>
  );
}

/** Phone: a bar pinned above the tabs with the choices and the confirm button. */
export function BarSummary({ picks, required, complete, onSwap, onConfirm }: SummaryProps) {
  return (
    <div className={styles.bar}>
      <span className={styles.count} aria-live="polite">
        <b>{picks.length}</b> de {required} {required === 1 ? 'escolhida' : 'escolhidas'}
      </span>
      {picks.length === 2 && <SwapButton onSwap={onSwap} />}
      <Button disabled={!complete} onClick={onConfirm}>
        Confirmar voto
      </Button>
    </div>
  );
}

interface ConfirmBallotProps {
  open: boolean;
  picks: readonly Nomination[];
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmBallot({
  open,
  picks,
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmBallotProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Confirmar seu voto?"
      confirmLabel="Confirmar voto"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <ul className={styles.confirmList}>
        {picks.map((pick, index) => (
          <li key={pick.id}>
            <b>{rankLabel(index + 1)}:</b> {titleOf(pick)}
          </li>
        ))}
      </ul>
      <p>O voto é anônimo e não dá para mudar depois.</p>
      {error && <Notice tone="error">{error}</Notice>}
    </ConfirmDialog>
  );
}
