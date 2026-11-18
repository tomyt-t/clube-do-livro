import { byTitle } from '@/domain/book';
import type { CycleReview } from '@/domain/review';
import type { Cycle } from '@/domain/types';
import { ownNominationOf } from '@/domain/voting';
import { useMember } from '@/features/auth/session';
import { useNominations, useOwnAnswer } from '@/features/club/use-club';
import { describeError } from '@/ui/describe-error';
import { Notice } from '@/ui/Notice';
import { PageSide } from '@/ui/Page';
import { Loading } from '@/ui/Spinner';

import { NominationList } from './NominationList';
import styles from './NominationStep.module.css';

/** What members see of the check: never which readings were flagged, nor who nominated them. */
function ReviewNotice({ review }: { review: CycleReview }) {
  if (review.conflicts === null) {
    return (
      <Notice title="Procurando indicações repetidas">
        Antes da votação, o site confere se alguma leitura foi indicada duas vezes, com outro nome.
      </Notice>
    );
  }
  if (review.conflicts.length > 0) {
    return (
      <Notice title="Houve um conflito">
        Algumas indicações parecem ser a mesma leitura. Quem organiza está resolvendo com quem
        indicou, e a votação abre em seguida.
      </Notice>
    );
  }
  return (
    <Notice title="Tudo certo">Nenhuma indicação repetida. A votação abre em instantes.</Notice>
  );
}

/** Everyone answered: the list is open to all while it is checked for repeats. */
export function ReviewStep({ cycle, review }: { cycle: Cycle; review: CycleReview }) {
  const { user } = useMember();
  const answer = useOwnAnswer(cycle.id, user.uid);
  const nominations = useNominations(cycle.id);
  const own = answer.status === 'ready' ? ownNominationOf(answer.value) : null;

  return (
    <div className={styles.step}>
      <PageSide>
        <header>
          <h2 className={styles.heading}>Conferindo indicações</h2>
          <p className={styles.meta}>Todos responderam.</p>
        </header>
      </PageSide>
      <ReviewNotice review={review} />
      {nominations.status === 'loading' && <Loading />}
      {nominations.status === 'error' && (
        <Notice tone="error">{describeError(nominations.error)}</Notice>
      )}
      {nominations.status === 'ready' && (
        <NominationList nominations={byTitle(nominations.value)} own={own} title="Indicações" />
      )}
    </div>
  );
}
