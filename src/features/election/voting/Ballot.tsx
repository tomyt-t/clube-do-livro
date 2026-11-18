import { useState, type ReactNode } from 'react';

import tableScene from '@/assets/illustrations/boteco-mesa.svg';

import type { Cycle, Nomination, NominationId } from '@/domain/types';
import { requiredChoices } from '@/domain/voting';
import { useMemberCount } from '@/features/club/use-club';
import { cx } from '@/ui/cx';
import { peopleOutOf, VOTED } from '@/ui/format';
import { useMediaQuery, WIDE } from '@/ui/use-media-query';

import {
  EMPTY_BALLOT,
  isComplete,
  swapPicks,
  toggleDislike,
  togglePick,
  type BallotDraft,
} from './ballot-draft';
import { BallotDeck } from './BallotDeck';
import { BallotList } from './BallotList';
import styles from './Ballot.module.css';
import { BarSummary, ConfirmBallot, SideSummary } from './BallotSummary';
import { useCastBallot } from './use-cast-ballot';
import { ViewToggle, type BallotView } from './ViewToggle';

const VIEW_KEY = 'clube-do-livro:cedula';

/** The list or the cards, remembered on this device only. */
function useBallotView() {
  const [view, setView] = useState<BallotView>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list';
    } catch {
      return 'list';
    }
  });
  const change = (next: BallotView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Storage may be blocked (private mode): the choice lasts this visit.
    }
  };
  return [view, change] as const;
}

function BallotHeader({
  cycle,
  required,
  view,
  onView,
}: {
  cycle: Cycle;
  required: number;
  view: BallotView;
  onView: (view: BallotView) => void;
}) {
  const members = useMemberCount();
  return (
    <header className={styles.header}>
      <div className={styles.viewbar}>
        <div>
          <h2>{required === 1 ? 'Escolha uma leitura' : 'Escolha duas leituras'}</h2>
          <p>{peopleOutOf(cycle.ballots, members, VOTED).replace(/\.$/, '')}</p>
        </div>
        <ViewToggle view={view} onChange={onView} />
      </div>
      {required === 2 && (
        <p className={styles.tip}>Cada escolha vale um voto; a 1ª só desempata.</p>
      )}
    </header>
  );
}

/** The ballot being filled in, with the ways to change it. */
function useBallotDraft(required: number) {
  const [ballot, setBallot] = useState<BallotDraft>(EMPTY_BALLOT);
  return {
    ballot,
    pick: (id: NominationId) => {
      setBallot((current) => togglePick(current, id, required));
    },
    dislike: (id: NominationId) => {
      setBallot((current) => toggleDislike(current, id));
    },
    swap: () => {
      setBallot(swapPicks);
    },
  };
}

interface BallotProps {
  cycle: Cycle;
  /** In the order to show. */
  options: readonly Nomination[];
  own: NominationId | null;
  uid: string;
  /** Title and steps, at the top of the sidebar on wide screens. */
  intro?: ReactNode;
}

export function Ballot({ cycle, options, own, uid, intro }: BallotProps) {
  const required = requiredChoices(cycle.options, own);
  const { ballot, pick, dislike, swap } = useBallotDraft(required);
  const [view, setView] = useBallotView();
  const [confirming, setConfirming] = useState(false);
  const casting = useCastBallot(cycle.id, uid);
  const wide = useMediaQuery(WIDE);

  const picks = ballot.picks.flatMap((id) => options.filter((option) => option.id === id));
  const summary = {
    picks,
    required,
    complete: isComplete(ballot, required),
    onSwap: swap,
    onConfirm: () => {
      setConfirming(true);
    },
  };
  const choose = {
    options,
    ballot,
    required,
    own,
    onPick: pick,
  };
  const header = <BallotHeader cycle={cycle} required={required} view={view} onView={setView} />;
  const choices =
    view === 'list' ? (
      <BallotList {...choose} />
    ) : (
      <BallotDeck {...choose} wide={wide} keyboard={!confirming} onDislike={dislike} />
    );

  return (
    <div className={cx(styles.ballot, wide && styles.wide)}>
      {wide ? (
        <>
          <aside className={styles.side}>
            {intro}
            {header}
            <SideSummary {...summary} />
            <img className={styles.sideArt} src={tableScene} alt="" aria-hidden="true" />
          </aside>
          <div className={styles.stage}>{choices}</div>
        </>
      ) : (
        <>
          {header}
          {choices}
          <BarSummary {...summary} />
        </>
      )}
      <ConfirmBallot
        open={confirming}
        picks={picks}
        busy={casting.busy}
        error={casting.error}
        onConfirm={() => {
          void casting.cast(ballot.picks);
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </div>
  );
}
