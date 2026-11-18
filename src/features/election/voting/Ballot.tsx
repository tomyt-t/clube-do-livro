import { useState } from 'react';

import type { Cycle, Nomination, NominationId } from '@/domain/types';
import { requiredChoices } from '@/domain/voting';
import { useMemberCount } from '@/features/club/use-club';
import { peopleOutOf, VOTED } from '@/ui/format';
import { PageSide } from '@/ui/Page';
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
  merged,
  view,
  onView,
}: {
  cycle: Cycle;
  required: number;
  merged: boolean;
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
      {merged && (
        <p className={styles.tip}>
          Sua indicação foi juntada com uma igual e já conta como sua 1ª opção. Escolha mais uma.
        </p>
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
  /** The member's nomination was merged: it already counts as their first choice. */
  merged: boolean;
  uid: string;
}

export function Ballot({ cycle, options, own, merged, uid }: BallotProps) {
  const required = requiredChoices(cycle.options, own, merged);
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
  const header = (
    <BallotHeader cycle={cycle} required={required} merged={merged} view={view} onView={setView} />
  );
  const choices =
    view === 'list' ? (
      <BallotList {...choose} />
    ) : (
      <BallotDeck {...choose} wide={wide} keyboard={!confirming} onDislike={dislike} />
    );

  // Desktop: the header and the choices so far go to the page's sidebar.
  return (
    <div className={styles.ballot}>
      <PageSide>
        {header}
        {wide && <SideSummary {...summary} />}
      </PageSide>
      {choices}
      {!wide && <BarSummary {...summary} />}
      <ConfirmBallot
        open={confirming}
        picks={picks}
        busy={casting.busy}
        error={casting.error}
        onConfirm={() => {
          void casting.cast(ballot.picks, !merged);
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </div>
  );
}
