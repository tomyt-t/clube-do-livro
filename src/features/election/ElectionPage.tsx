import { electionStep, findActiveElection } from '@/domain/cycle';
import type { Cycle } from '@/domain/types';
import { useCycles } from '@/features/club/use-club';
import { describeError } from '@/ui/describe-error';
import { EmptyState } from '@/ui/EmptyState';
import { Notice } from '@/ui/Notice';
import { Page } from '@/ui/Page';
import { Loading } from '@/ui/Spinner';

import { ElectionSteps } from './ElectionSteps';
import { NominationStep } from './nomination/NominationStep';

function ElectionOverview({ cycles }: { cycles: readonly Cycle[] }) {
  const election = findActiveElection(cycles);
  if (!election) {
    return (
      <EmptyState title="Nenhuma votação aberta">
        Quando quem organiza o clube abrir as indicações, é por aqui que você indica uma leitura.
      </EmptyState>
    );
  }
  return (
    <>
      <ElectionSteps current={electionStep(election.status)} />
      {election.status === 'nominating' ? (
        <NominationStep cycle={election} />
      ) : (
        <EmptyState title="A votação está aberta">
          A cédula com primeira e segunda opção chega na próxima etapa do site.
        </EmptyState>
      )}
    </>
  );
}

export function ElectionPage() {
  const cycles = useCycles();
  return (
    <Page title="Votação">
      {cycles.status === 'loading' && <Loading />}
      {cycles.status === 'error' && (
        <Notice tone="error" title="Não foi possível abrir a votação">
          {describeError(cycles.error)}
        </Notice>
      )}
      {cycles.status === 'ready' && <ElectionOverview cycles={cycles.value} />}
    </Page>
  );
}
