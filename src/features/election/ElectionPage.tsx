import { electionStep, findActiveElection } from '@/domain/cycle';
import type { Cycle } from '@/domain/types';
import { useCycles } from '@/features/club/use-club';
import { describeError } from '@/ui/describe-error';
import { EmptyState } from '@/ui/EmptyState';
import { Notice } from '@/ui/Notice';
import { Page, PageSide } from '@/ui/Page';
import { Loading } from '@/ui/Spinner';

import { ElectionSteps } from './ElectionSteps';
import { NominationStep } from './nomination/NominationStep';
import { ReviewStep } from './nomination/ReviewStep';
import { VotingStep } from './voting/VotingStep';

/** The step the round is at: nominating, the check before the vote, or the vote itself. */
function CurrentStep({ election }: { election: Cycle }) {
  if (election.status !== 'nominating') return <VotingStep cycle={election} />;
  if (election.review) return <ReviewStep cycle={election} review={election.review} />;
  return <NominationStep cycle={election} />;
}

/** Where the round stands, under the title on desktop; then the step itself. */
function ElectionOverview({ cycles }: { cycles: readonly Cycle[] }) {
  const election = findActiveElection(cycles);
  if (!election) {
    return (
      <EmptyState title="Nenhuma votação aberta">
        As indicações da próxima leitura abrem quando todos terminarem a leitura atual.
      </EmptyState>
    );
  }
  return (
    <>
      <PageSide>
        <ElectionSteps current={electionStep(election.status)} />
      </PageSide>
      <CurrentStep election={election} />
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
