import { useId, type ReactNode } from 'react';

import { PATHS } from '@/app/paths';
import { splitTitle } from '@/domain/book';
import type { Cycle } from '@/domain/types';
import { useMember } from '@/features/auth/session';
import { useHasVoted, useOwnAnswer } from '@/features/club/use-club';
import { LinkButton } from '@/ui/Button';
import { peopleWho, RESPONDED, until, VOTED } from '@/ui/format';

import { nextReadingOf, type NextReading } from './next-reading';
import styles from './NextReadingSection.module.css';

interface LineProps {
  headline: string;
  details?: (string | null)[];
  action?: ReactNode;
}

function Line({ headline, details = [], action }: LineProps) {
  const detail = details.filter(Boolean).join(' ');
  return (
    <div className={styles.line}>
      <div>
        <p className={styles.headline}>{headline}</p>
        {detail && <p className={styles.detail}>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function ElectionLink({ done, label }: { done: boolean; label: string }) {
  return (
    <LinkButton to={PATHS.election} variant={done ? 'secondary' : 'primary'} compact>
      {done ? 'Acompanhar' : label}
    </LinkButton>
  );
}

function Nominating({ cycle, closed }: { cycle: Cycle; closed: boolean }) {
  const { user } = useMember();
  const answer = useOwnAnswer(cycle.id, user.uid);
  if (closed) {
    return <Line headline="Indicações encerradas" details={['A votação abre em breve.']} />;
  }

  const answered = answer.status === 'ready' && answer.value !== null;
  const responses = peopleWho(cycle.responses, RESPONDED);
  return (
    <Line
      headline="Indicações abertas"
      details={[until(cycle.nominationDeadline), responses, answered ? 'Você já respondeu.' : null]}
      action={answer.status === 'ready' && <ElectionLink done={answered} label="Indicar" />}
    />
  );
}

function Voting({ cycle, closed }: { cycle: Cycle; closed: boolean }) {
  const { user } = useMember();
  const voted = useHasVoted(cycle.id, user.uid);
  if (closed) {
    return <Line headline="Votação encerrada" details={['O resultado sai em breve.']} />;
  }

  const done = voted.status === 'ready' && voted.value;
  const ballots = peopleWho(cycle.ballots, VOTED);
  return (
    <Line
      headline="Votação aberta"
      details={[until(cycle.votingDeadline), ballots, done ? 'Você já votou.' : null]}
      action={voted.status === 'ready' && <ElectionLink done={done} label="Votar" />}
    />
  );
}

function NextReadingLine({ next }: { next: NextReading }) {
  switch (next.kind) {
    case 'queued':
      return (
        <Line
          headline={splitTitle(next.book.title).title}
          details={['Já escolhida. Começa quando a leitura atual terminar.']}
        />
      );
    case 'nominating':
      return <Nominating cycle={next.cycle} closed={next.closed} />;
    case 'voting':
      return <Voting cycle={next.cycle} closed={next.closed} />;
    case 'tallying':
      return <Line headline="Apurando os votos" details={['O resultado sai em breve.']} />;
    case 'none':
      return (
        <Line
          headline="Nenhuma votação aberta"
          details={['Quem organiza o clube abre as indicações da próxima leitura.']}
        />
      );
  }
}

export function NextReadingSection({ cycles }: { cycles: readonly Cycle[] }) {
  const headingId = useId();
  return (
    <section className={styles.next} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        Próxima leitura
      </h2>
      <NextReadingLine next={nextReadingOf(cycles)} />
    </section>
  );
}
