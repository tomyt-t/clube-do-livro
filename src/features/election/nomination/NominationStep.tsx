import { byTitle } from '@/domain/book';
import { isPastDeadline } from '@/domain/cycle';
import type { Cycle, Nomination, OwnAnswer } from '@/domain/types';
import { ownNominationOf } from '@/domain/voting';
import { useMember } from '@/features/auth/session';
import { useNominations, useOwnAnswer } from '@/features/club/use-club';
import type { Watched } from '@/app/use-watch';
import { describeError } from '@/ui/describe-error';
import { peopleWho, RESPONDED, until } from '@/ui/format';
import { Notice } from '@/ui/Notice';
import { Loading } from '@/ui/Spinner';

import { NominationForm } from './NominationForm';
import { NominationList } from './NominationList';
import styles from './NominationStep.module.css';

function OwnAnswerNote({ answer }: { answer: OwnAnswer }) {
  return (
    <div className={styles.answered}>
      <p className={styles.answeredTitle}>
        {answer.kind === 'nominated'
          ? 'Sua indicação está na lista.'
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

function headingOf(closed: boolean, answer: Watched<OwnAnswer | null>): string {
  if (closed) return 'Indicações encerradas';
  const answered = answer.status === 'ready' && answer.value !== null;
  return answered ? 'Indicações abertas' : 'Indique uma leitura';
}

function sorted(nominations: Watched<Nomination[]>): Nomination[] {
  return nominations.status === 'ready' ? byTitle(nominations.value) : [];
}

export function NominationStep({ cycle }: { cycle: Cycle }) {
  const { user } = useMember();
  const answer = useOwnAnswer(cycle.id, user.uid);
  const nominations = useNominations(cycle.id);
  const closed = isPastDeadline(cycle.nominationDeadline);
  const own = answer.status === 'ready' ? ownNominationOf(answer.value) : null;
  const meta = [
    closed ? null : until(cycle.nominationDeadline),
    peopleWho(cycle.responses, RESPONDED),
  ];

  return (
    <div className={styles.step}>
      <header>
        <h2 className={styles.heading}>{headingOf(closed, answer)}</h2>
        <p className={styles.meta}>{meta.filter(Boolean).join(' ')}</p>
      </header>
      <AnswerArea cycle={cycle} uid={user.uid} answer={answer} />
      <NominationList nominations={sorted(nominations)} own={own} />
    </div>
  );
}
