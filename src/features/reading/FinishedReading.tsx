import { useState } from 'react';

import { useBackend } from '@/app/services';
import type { Cycle } from '@/domain/types';
import { useMember } from '@/features/auth/session';
import { useHasFinished, useMemberCount } from '@/features/club/use-club';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { describeError } from '@/ui/describe-error';
import { FINISHED, peopleOutOf } from '@/ui/format';
import { CheckIcon } from '@/ui/icons';
import { Notice } from '@/ui/Notice';

import styles from './FinishedReading.module.css';

/**
 * "Acabei de ler!": once everyone has marked it, the book ends and the next
 * round of nominations opens. Others only ever see how many, never who.
 */
export function FinishedReading({ cycle }: { cycle: Cycle }) {
  const { club } = useBackend();
  const { user } = useMember();
  const finished = useHasFinished(cycle.id, user.uid);
  const members = useMemberCount();
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  const mark = async () => {
    setSending({ busy: true, error: null });
    try {
      await club.markFinished({ cycleId: cycle.id, uid: user.uid });
      setSending({ busy: false, error: null });
      setAsking(false);
    } catch (error) {
      setSending({ busy: false, error: describeError(error) });
    }
  };

  if (finished.status !== 'ready') return null;
  const count = peopleOutOf(cycle.finishedReaders, members, FINISHED);

  return (
    <div className={styles.finished}>
      {finished.value ? (
        <p className={styles.done}>
          <CheckIcon width={18} height={18} />
          Você terminou de ler.
        </p>
      ) : (
        <Button
          variant="secondary"
          compact
          onClick={() => {
            setAsking(true);
          }}
        >
          Acabei de ler!
        </Button>
      )}
      <p className={styles.count}>{count}</p>
      <ConfirmDialog
        open={asking}
        title="Terminou a leitura?"
        confirmLabel="Acabei de ler!"
        busy={sending.busy}
        onConfirm={() => {
          void mark();
        }}
        onCancel={() => {
          setAsking(false);
        }}
      >
        <p>
          Quando todos terminarem, as indicações da próxima leitura abrem. Não dá para desmarcar.
        </p>
        {sending.error && <Notice tone="error">{sending.error}</Notice>}
      </ConfirmDialog>
    </div>
  );
}
