import { useId } from 'react';

import { cx } from '@/ui/cx';
import { CheckIcon } from '@/ui/icons';

import type { ChartRow } from './history';
import styles from './VoteChart.module.css';

const pct = (value: number, max: number) => `${String(max === 0 ? 0 : (value / max) * 100)}%`;

function describeRow(row: ChartRow): string {
  const votes = row.votes === 1 ? '1 voto' : `${String(row.votes)} votos`;
  return `${row.title}: ${votes}, ${String(row.firsts)} como 1ª opção${row.winner ? ', venceu' : ''}.`;
}

function Bars({ row, max }: { row: ChartRow; max: number }) {
  return (
    <div className={styles.track} aria-hidden="true">
      <span className={styles.bar} style={{ inlineSize: pct(row.votes, max) }}>
        {row.firsts > 0 && (
          <span
            className={styles.first}
            style={{ flexGrow: row.firsts }}
            title={`${String(row.firsts)} como 1ª opção`}
          />
        )}
        {row.seconds > 0 && (
          <span
            className={styles.second}
            style={{ flexGrow: row.seconds }}
            title={`${String(row.seconds)} como 2ª opção`}
          />
        )}
        <span className={styles.value}>{row.votes}</span>
      </span>
    </div>
  );
}

function NumbersTable({ rows }: { rows: readonly ChartRow[] }) {
  return (
    <details className={styles.table}>
      <summary>Ver números</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Leitura</th>
            <th scope="col">Votos</th>
            <th scope="col">1ª opção</th>
            <th scope="col">2ª opção</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.title}</th>
              <td>{row.votes}</td>
              <td>{row.firsts}</td>
              <td>{row.seconds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

interface VoteChartProps {
  rows: readonly ChartRow[];
  /** "6 votaram". */
  caption: string;
}

/**
 * Votes per reading as horizontal bars from one baseline: first choices
 * solid, second choices lighter, the total at the bar's tip.
 */
export function VoteChart({ rows, caption }: VoteChartProps) {
  const captionId = useId();
  const max = Math.max(1, ...rows.map((row) => row.votes));

  return (
    <figure className={styles.chart} aria-labelledby={captionId}>
      <figcaption id={captionId} className={styles.caption}>
        <span>{caption}</span>
        <span className={styles.legend} aria-hidden="true">
          <i className={styles.first} />
          1ª opção
          <i className={styles.second} />
          2ª opção
        </span>
      </figcaption>
      <ol className={styles.rows}>
        {rows.map((row) => (
          <li key={row.id} className={cx(styles.row, row.winner && styles.winner)}>
            <p className={styles.label} aria-hidden="true">
              <span>{row.title}</span>
              {row.winner && <CheckIcon width={16} height={16} />}
            </p>
            <Bars row={row} max={max} />
            <span className="visually-hidden">{describeRow(row)}</span>
          </li>
        ))}
      </ol>
      <NumbersTable rows={rows} />
    </figure>
  );
}
