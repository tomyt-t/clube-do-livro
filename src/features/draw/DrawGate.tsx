import { useCallback, useState } from 'react';

import type { Cycle } from '@/domain/types';
import { useNominations } from '@/features/club/use-club';
import { Button } from '@/ui/Button';

import { drawCastOf, markSeen, unseenDraw } from './draw-data';
import { DrawShow } from './DrawShow';

const headingOf = (cycle: Cycle) => `O sorteio da leitura nº ${String(cycle.number)}`;

/** Loads the tied readings, then plays the show. */
function DrawFor({
  cycle,
  onShown,
  onClose,
}: {
  cycle: Cycle;
  onShown?: () => void;
  onClose: () => void;
}) {
  const nominations = useNominations(cycle.id);
  if (nominations.status !== 'ready') return null;
  const cast = drawCastOf(cycle, nominations.value);
  if (!cast) return null;
  return <DrawShow heading={headingOf(cycle)} {...cast} onShown={onShown} onClose={onClose} />;
}

/**
 * Opens the show by itself on the first visit after a draw (marked on this
 * device once it is on screen); later visits leave it to Histórico.
 */
export function DrawGate({ cycles }: { cycles: readonly Cycle[] }) {
  const [cycle, setCycle] = useState(() => unseenDraw(cycles));
  const cycleId = cycle?.id;
  const onShown = useCallback(() => {
    if (cycleId) markSeen(cycleId);
  }, [cycleId]);
  if (!cycle) return null;
  return (
    <DrawFor
      cycle={cycle}
      onShown={onShown}
      onClose={() => {
        setCycle(null);
      }}
    />
  );
}

/** "Ver o sorteio", for a round won by a draw. */
export function DrawReplay({ cycle }: { cycle: Cycle }) {
  const [open, setOpen] = useState(false);
  if (cycle.winner?.method !== 'draw' || cycle.winner.drawnFrom.length < 2) return null;
  return (
    <>
      <Button
        variant="secondary"
        compact
        onClick={() => {
          setOpen(true);
        }}
      >
        Ver o sorteio
      </Button>
      {open && (
        <DrawFor
          cycle={cycle}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
