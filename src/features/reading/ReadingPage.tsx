import { findCurrentReading } from '@/domain/cycle';
import type { Cycle } from '@/domain/types';
import { useCycles } from '@/features/club/use-club';
import { EmptyState } from '@/ui/EmptyState';
import { Notice } from '@/ui/Notice';
import { Page } from '@/ui/Page';
import { Loading } from '@/ui/Spinner';
import { describeError } from '@/ui/describe-error';

import { CurrentReading } from './CurrentReading';
import { NextReadingSection } from './NextReadingSection';

function ReadingOverview({ cycles }: { cycles: readonly Cycle[] }) {
  const reading = findCurrentReading(cycles);
  return (
    <>
      {reading?.winner ? (
        <CurrentReading cycle={reading} winner={reading.winner} />
      ) : (
        <EmptyState title="Nenhuma leitura em andamento">
          Quando o clube escolher a próxima leitura, ela aparece aqui.
        </EmptyState>
      )}
      <NextReadingSection cycles={cycles} />
    </>
  );
}

export function ReadingPage() {
  const cycles = useCycles();
  return (
    <Page title="Lendo agora" hideTitle>
      {cycles.status === 'loading' && <Loading />}
      {cycles.status === 'error' && (
        <Notice tone="error" title="Não foi possível abrir a leitura atual">
          {describeError(cycles.error)}
        </Notice>
      )}
      {cycles.status === 'ready' && <ReadingOverview cycles={cycles.value} />}
    </Page>
  );
}
