import { byTitle } from '@/domain/book';
import { isPastDeadline } from '@/domain/cycle';
import { isLetGo } from '@/domain/review';
import type { Cycle, OwnAnswer } from '@/domain/types';
import { ownNominationOf } from '@/domain/voting';
import { useMember } from '@/features/auth/session';
import {
  useMemberCount,
  useNominations,
  useOwnAnswer,
  useOwnNomination,
} from '@/features/club/use-club';
import type { Watched } from '@/app/use-watch';
import { describeError } from '@/ui/describe-error';
import { peopleOutOf, RESPONDED, until } from '@/ui/format';
import { Notice } from '@/ui/Notice';
import { PageSide } from '@/ui/Page';
import { Loading } from '@/ui/Spinner';

import { NominationForm } from './NominationForm';
import { HiddenNominations } from './HiddenNominations';
import { NominationList } from './NominationList';
import styles from './NominationStep.module.css';

function OwnAnswerNote({ answer }: { answer: OwnAnswer }) {
  return (
    <div className={styles.answered}>
      <p className={styles.answeredTitle}>
        {answer.kind === 'nominated'
          ? 'Sua indicação foi registrada.'
          : 'Você não indicou nesta rodada.'}
      </p>
      <p className={styles.answeredText}>
        {answer.kind === 'nominated'
          ? 'Ninguém vê quem indicou cada leitura. A resposta não muda mais.'
          : 'Você vota normalmente quando a votação abrir.'}
      </p>
    </div>
  );
}

interface AnswerAreaProps {
  cycle: Cycle;
  uid: string;
  answer: Watched<OwnAnswer | null>;
}

/** The member's part: the form, or what they already answered. */
function AnswerArea({ cycle, uid, answer }: AnswerAreaProps) {
  if (answer.status === 'loading') return <Loading />;
  if (answer.status === 'error') {
    return <Notice tone="error">{describeError(answer.error)}</Notice>;
  }
  if (isLetGo(answer.value, cycle)) {
    return (
      <>
        <Notice title="Sua indicação foi liberada para trocar">
          Quem organiza tirou a sua indicação da lista, porque outra pessoa indicou a mesma leitura.
          Indique outra, sabendo o que já está na lista abaixo.
        </Notice>
        <NominationForm cycleId={cycle.id} uid={uid} />
      </>
    );
  }
  if (answer.value) return <OwnAnswerNote answer={answer.value} />;
  if (isPastDeadline(cycle.nominationDeadline)) {
    return (
      <Notice title="As indicações encerraram">
        Você não chegou a responder, mas vota normalmente quando a votação abrir.
      </Notice>
    );
  }
  return <NominationForm cycleId={cycle.id} uid={uid} />;
}

/** The list as it stands, for a member choosing again after their nomination was let go. */
function CurrentList({ cycle }: { cycle: Cycle }) {
  const nominations = useNominations(cycle.id);
  if (nominations.status === 'loading') return <Loading />;
  if (nominations.status === 'error') {
    return <Notice tone="error">{describeError(nominations.error)}</Notice>;
  }
  return (
    <NominationList
      nominations={byTitle(nominations.value)}
      own={null}
      title="Indicações até agora"
    />
  );
}

function headingOf(cycle: Cycle, closed: boolean, answer: Watched<OwnAnswer | null>): string {
  if (closed) return 'Indicações encerradas';
  const answered =
    answer.status === 'ready' && answer.value !== null && !isLetGo(answer.value, cycle);
  return answered ? 'Indicações abertas' : 'Indique uma leitura';
}

export function NominationStep({ cycle }: { cycle: Cycle }) {
  const { user } = useMember();
  const answer = useOwnAnswer(cycle.id, user.uid);
  const members = useMemberCount();
  const closed = isPastDeadline(cycle.nominationDeadline);
  const own =
    answer.status === 'ready' && !isLetGo(answer.value, cycle)
      ? ownNominationOf(answer.value)
      : null;
  const ownNomination = useOwnNomination(cycle.id, own);
  const meta = [
    closed ? null : until(cycle.nominationDeadline),
    peopleOutOf(cycle.responses, members, RESPONDED),
  ];

  return (
    <div className={styles.step}>
      <PageSide>
        <header>
          <h2 className={styles.heading}>{headingOf(cycle, closed, answer)}</h2>
          <p className={styles.meta}>{meta.filter(Boolean).join(' ')}</p>
        </header>
      </PageSide>
      <div className={styles.answer}>
        <AnswerArea cycle={cycle} uid={user.uid} answer={answer} />
      </div>
      {answer.status === 'ready' && isLetGo(answer.value, cycle) ? (
        <CurrentList cycle={cycle} />
      ) : (
        <HiddenNominations
          count={cycle.nominationIds.length}
          own={ownNomination.status === 'ready' ? ownNomination.value : null}
        />
      )}
    </div>
  );
}
