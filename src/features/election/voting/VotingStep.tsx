import type { Watched } from '@/app/use-watch';
import { byTitle } from '@/domain/book';
import { isPastDeadline } from '@/domain/cycle';
import type { Cycle, Nomination, NominationId } from '@/domain/types';
import { ballotSeat } from '@/domain/review';
import { ownNominationOf } from '@/domain/voting';
import { useMember } from '@/features/auth/session';
import { useHasVoted, useNominations, useOwnAnswer } from '@/features/club/use-club';
import { describeError } from '@/ui/describe-error';
import { Notice } from '@/ui/Notice';
import { PageSide } from '@/ui/Page';
import { Loading } from '@/ui/Spinner';

import { NominationList } from '../nomination/NominationList';

import { Ballot } from './Ballot';
import styles from './Ballot.module.css';

interface VotingData {
  voted: boolean;
  /** The readings on the ballot, alphabetically. */
  options: Nomination[];
  own: NominationId | null;
  /** The member's nomination was merged: it already counts as their first choice. */
  merged: boolean;
}

/** Everything the voting step needs, as one value: loading, failed or ready. */
function useVotingData(cycle: Cycle, uid: string): Watched<VotingData> {
  const voted = useHasVoted(cycle.id, uid);
  const answer = useOwnAnswer(cycle.id, uid);
  const nominations = useNominations(cycle.id);

  const failed = [voted, answer, nominations].find((item) => item.status === 'error');
  if (failed?.status === 'error') return failed;
  if (voted.status !== 'ready' || answer.status !== 'ready' || nominations.status !== 'ready') {
    return { status: 'loading' };
  }
  const options = nominations.value.filter((nomination) => cycle.options.includes(nomination.id));
  return {
    status: 'ready',
    value: {
      voted: voted.value,
      options: byTitle(options),
      ...ballotSeat(ownNominationOf(answer.value), cycle.merged),
    },
  };
}

function Waiting({ title, children }: { title: string; children: string }) {
  return (
    <div className={styles.waiting}>
      <p className={styles.waitingTitle}>{title}</p>
      <p>{children}</p>
    </div>
  );
}

export function VotingStep({ cycle }: { cycle: Cycle }) {
  const { user } = useMember();
  const data = useVotingData(cycle, user.uid);

  if (data.status === 'error') return <Notice tone="error">{describeError(data.error)}</Notice>;
  if (data.status === 'loading') return <Loading />;

  const { voted, options, own, merged } = data.value;
  const open = cycle.status === 'voting' && !isPastDeadline(cycle.votingDeadline);
  if (open && !voted) {
    return <Ballot cycle={cycle} options={options} own={own} merged={merged} uid={user.uid} />;
  }
  return (
    <div className={styles.done}>
      <PageSide>
        {voted ? (
          <Waiting title="Seu voto foi registrado.">
            Ele é anônimo: fica só a contagem, sem ligação com você. O resultado sai quando todos
            votarem.
          </Waiting>
        ) : (
          <Waiting title="A votação fechou.">O resultado sai em instantes.</Waiting>
        )}
      </PageSide>
      <NominationList nominations={options} own={own} title="Leituras na votação" />
    </div>
  );
}
