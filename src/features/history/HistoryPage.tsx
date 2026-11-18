import { splitTitle } from '@/domain/book';
import { useCycles } from '@/features/club/use-club';
import { BookCover } from '@/ui/BookCover';
import { describeError } from '@/ui/describe-error';
import { EmptyState } from '@/ui/EmptyState';
import { Notice } from '@/ui/Notice';
import { Page, PageSide } from '@/ui/Page';
import { Loading } from '@/ui/Spinner';

import { CycleRecord } from './CycleRecord';
import { decidedCycles, type DecidedCycle } from './history';
import styles from './HistoryPage.module.css';

const anchorOf = (cycle: DecidedCycle) => `leitura-${String(cycle.number)}`;

function scrollToRecord(cycle: DecidedCycle) {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById(anchorOf(cycle))
    ?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
}

/** Every book the club chose, standing on one shelf; each opens its round below. */
function Shelf({ cycles }: { cycles: readonly DecidedCycle[] }) {
  return (
    <nav className={styles.shelf} aria-label="Estante">
      <ol>
        {cycles.map((cycle) => (
          <li key={cycle.id}>
            <button
              type="button"
              aria-label={`Leitura nº ${String(cycle.number)}: ${splitTitle(cycle.winner.book.title).title}`}
              onClick={() => {
                scrollToRecord(cycle);
              }}
            >
              <BookCover book={cycle.winner.book} className={styles.book} />
              <span className={styles.number} aria-hidden="true">
                {cycle.number}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function HistoryOverview({ cycles }: { cycles: readonly DecidedCycle[] }) {
  if (cycles.length === 0) {
    return (
      <EmptyState title="Nada no histórico ainda">
        Cada leitura escolhida pelo clube, e como foi a votação, fica guardada aqui.
      </EmptyState>
    );
  }
  return (
    <>
      <PageSide>
        <Shelf cycles={cycles} />
      </PageSide>
      <div className={styles.records}>
        {cycles.map((cycle) => (
          <CycleRecord key={cycle.id} cycle={cycle} anchor={anchorOf(cycle)} />
        ))}
      </div>
    </>
  );
}

export function HistoryPage() {
  const cycles = useCycles();
  return (
    <Page title="Histórico">
      {cycles.status === 'loading' && <Loading />}
      {cycles.status === 'error' && (
        <Notice tone="error" title="Não foi possível abrir o histórico">
          {describeError(cycles.error)}
        </Notice>
      )}
      {cycles.status === 'ready' && <HistoryOverview cycles={decidedCycles(cycles.value)} />}
    </Page>
  );
}
