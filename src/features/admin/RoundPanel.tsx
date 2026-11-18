import { useId, useState } from 'react';

import { useBackend } from '@/app/services';
import { splitTitle } from '@/domain/book';
import type { Cycle } from '@/domain/types';
import { useCycles, useMemberCount } from '@/features/club/use-club';
import type { Backend } from '@/services/backend';
import { advance, finishCurrentReading, openNominations } from '@/services/election';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { FINISHED, peopleOutOf, RESPONDED, VOTED } from '@/ui/format';
import { Notice } from '@/ui/Notice';
import { Loading } from '@/ui/Spinner';

import styles from './AdminPage.module.css';
import { roundOf, type Round } from './round';
import { useAction } from './use-admin';

interface RoundAction {
  label: string;
  /** Asked first when the action skips people who have not done their part. */
  confirm: { title: string; body: string } | null;
  run: () => Promise<unknown>;
}

interface RoundView {
  headline: string;
  detail: string;
  action: RoundAction | null;
}

interface Context {
  backend: Backend;
  cycles: readonly Cycle[];
  members: number;
}

const bookOf = (cycle: Cycle) => splitTitle(cycle.winner?.book.title ?? '').title;

function nominatingView(cycle: Cycle, { backend, members }: Context): RoundView {
  const responded = peopleOutOf(cycle.responses, members, RESPONDED);
  const nobody = cycle.nominationIds.length === 0;
  return {
    headline: `Rodada ${String(cycle.number)}: indicações abertas`,
    detail: `${responded} ${nobody ? 'Ninguém indicou ainda.' : 'A votação abre quando todos responderem.'}`,
    action: nobody
      ? null
      : {
          label: 'Abrir a votação agora',
          confirm: {
            title: 'Abrir a votação sem esperar todos?',
            body: `${responded} Quem não respondeu fica sem indicar, mas ainda vota.`,
          },
          run: () =>
            backend.flow.startVoting({
              cycleId: cycle.id,
              options: cycle.nominationIds,
              votingDeadline: null,
            }),
        },
  };
}

function votingView(cycle: Cycle, { backend, members }: Context): RoundView {
  const voted = peopleOutOf(cycle.ballots, members, VOTED);
  return {
    headline: `Rodada ${String(cycle.number)}: votação aberta`,
    detail: `${voted} O resultado sai quando todos votarem.`,
    action: {
      label: 'Encerrar a votação agora',
      confirm: {
        title: 'Encerrar a votação sem esperar todos?',
        body: `${voted} O resultado sai com os votos que já chegaram.`,
      },
      run: () => backend.flow.closeVoting(cycle.id),
    },
  };
}

function readingView(cycle: Cycle, upcoming: Cycle | null, context: Context): RoundView {
  const { backend, cycles, members } = context;
  const finished = peopleOutOf(cycle.finishedReaders, members, FINISHED);
  const next = upcoming
    ? `A próxima leitura, ${bookOf(upcoming)}, começa em seguida.`
    : `As indicações da rodada ${String(cycle.number + 1)} abrem em seguida.`;
  return {
    headline: `Lendo: ${bookOf(cycle)}`,
    detail: `${finished} A próxima rodada abre quando todos terminarem.`,
    action: {
      label: 'Encerrar a leitura agora',
      confirm: { title: 'Encerrar a leitura sem esperar todos?', body: `${finished} ${next}` },
      run: () =>
        upcoming
          ? finishCurrentReading(backend.admin, cycles)
          : backend.flow.finishAndOpenNext({ cycleId: cycle.id, nextNumber: cycle.number + 1 }),
    },
  };
}

function viewOf(round: Round, context: Context): RoundView {
  const { backend, cycles } = context;
  switch (round.kind) {
    case 'idle':
      return {
        headline: 'Nenhuma rodada em andamento',
        detail: 'Abra as indicações para começar. Depois disso, o clube anda sozinho.',
        action: {
          label: 'Abrir indicações',
          confirm: null,
          run: () => openNominations(backend.admin, cycles, null),
        },
      };
    case 'nominating':
      return nominatingView(round.cycle, context);
    case 'voting':
      return votingView(round.cycle, context);
    case 'tallying':
      return {
        headline: `Rodada ${String(round.cycle.number)}: apurando`,
        detail: 'O resultado sai em instantes.',
        action: {
          label: 'Apurar agora',
          confirm: null,
          run: () => advance(backend, { kind: 'declare', cycle: round.cycle }, cycles),
        },
      };
    case 'reading':
      return readingView(round.cycle, round.upcoming, context);
  }
}

function RoundBody({ view }: { view: RoundView }) {
  const action = useAction();
  const [asking, setAsking] = useState(false);
  const step = view.action;

  const run = async () => {
    if (step && (await action.run(step.run))) setAsking(false);
  };

  return (
    <>
      <div className={styles.line}>
        <div>
          <p className={styles.headline}>{view.headline}</p>
          <p className={styles.detail}>{view.detail}</p>
        </div>
        {step && (
          <Button
            variant={step.confirm ? 'secondary' : 'primary'}
            compact
            busy={action.busy && !asking}
            onClick={() => {
              action.reset();
              if (step.confirm) setAsking(true);
              else void run();
            }}
          >
            {step.label}
          </Button>
        )}
      </div>
      {action.error && !asking && <Notice tone="error">{action.error}</Notice>}
      {step?.confirm && (
        <ConfirmDialog
          open={asking}
          title={step.confirm.title}
          confirmLabel={step.label}
          busy={action.busy}
          onConfirm={() => {
            void run();
          }}
          onCancel={() => {
            setAsking(false);
          }}
        >
          <p>{step.confirm.body}</p>
          {action.error && <Notice tone="error">{action.error}</Notice>}
        </ConfirmDialog>
      )}
    </>
  );
}

/** The round in one line, and the one thing the organizer can do about it. */
export function RoundPanel() {
  const backend = useBackend();
  const cycles = useCycles();
  const members = useMemberCount();
  const headingId = useId();

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        Rodada
      </h2>
      {cycles.status === 'ready' ? (
        <RoundBody
          view={viewOf(roundOf(cycles.value), { backend, cycles: cycles.value, members })}
        />
      ) : (
        <Loading />
      )}
    </section>
  );
}
