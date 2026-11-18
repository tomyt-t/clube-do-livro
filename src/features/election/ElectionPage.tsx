import { electionStep, findActiveElection } from '@/domain/cycle';
import type { Watched } from '@/app/use-watch';
import type { Cycle } from '@/domain/types';
import { useCycles } from '@/features/club/use-club';
import { describeError } from '@/ui/describe-error';
import { EmptyState } from '@/ui/EmptyState';
import { Notice } from '@/ui/Notice';
import { Page } from '@/ui/Page';
import { Loading } from '@/ui/Spinner';
import { useMediaQuery, WIDE } from '@/ui/use-media-query';

import styles from './ElectionPage.module.css';
import { ElectionSteps } from './ElectionSteps';
import { NominationStep } from './nomination/NominationStep';
import { VotingStep } from './voting/VotingStep';

/**
 * On a wide screen the ballot follows the prototype: title and steps head a
 * sidebar, and the readings start at the top beside them.
 */
function ElectionOverview({ cycles, sidebar }: { cycles: readonly Cycle[]; sidebar: boolean }) {
  const election = findActiveElection(cycles);
  if (!election) {
    return (
      <EmptyState title="Nenhuma votação aberta">
        As indicações da próxima leitura abrem quando todos terminarem a leitura atual.
      </EmptyState>
    );
  }
  const steps = <ElectionSteps current={electionStep(election.status)} />;
  if (election.status === 'nominating') {
    return (
      <>
        {steps}
        <NominationStep cycle={election} />
      </>
    );
  }
  if (sidebar) {
    const intro = (
      <>
        <p className={styles.sideTitle} aria-hidden="true">
          Votação
        </p>
        {steps}
      </>
    );
    return <VotingStep cycle={election} intro={intro} />;
  }
  return (
    <>
      {steps}
      <VotingStep cycle={election} />
    </>
  );
}

/** The ballot needs the room of a wide page; nominations read better narrow. */
function isVoting(cycles: Watched<Cycle[]>): boolean {
  return cycles.status === 'ready' && findActiveElection(cycles.value)?.status === 'voting';
}

export function ElectionPage() {
  const cycles = useCycles();
  const wide = useMediaQuery(WIDE);
  const voting = isVoting(cycles);
  const sidebar = voting && wide;
  return (
    <Page title="Votação" hideTitle={sidebar} art={!sidebar} width={voting ? 'wide' : 'content'}>
      {cycles.status === 'loading' && <Loading />}
      {cycles.status === 'error' && (
        <Notice tone="error" title="Não foi possível abrir a votação">
          {describeError(cycles.error)}
        </Notice>
      )}
      {cycles.status === 'ready' && <ElectionOverview cycles={cycles.value} sidebar={sidebar} />}
    </Page>
  );
}
