import type { ElectionStep } from '@/domain/cycle';
import { cx } from '@/ui/cx';

import styles from './ElectionSteps.module.css';

const STEPS: { step: ElectionStep; label: string }[] = [
  { step: 'nominations', label: 'Indicações' },
  { step: 'voting', label: 'Votação' },
  { step: 'result', label: 'Resultado' },
];

/** Where the cycle is: a real sequence, so the steps are numbered. */
export function ElectionSteps({ current }: { current: ElectionStep }) {
  const now = STEPS.findIndex(({ step }) => step === current);
  return (
    <ol className={styles.steps} aria-label="Etapas da votação">
      {STEPS.map(({ step, label }, index) => (
        <li
          key={step}
          className={cx(index < now && styles.done, index === now && styles.now)}
          aria-current={index === now ? 'step' : undefined}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}
