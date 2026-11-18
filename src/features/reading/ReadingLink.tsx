import { useState, type SyntheticEvent } from 'react';

import { useBackend } from '@/app/services';
import { isSecureLink } from '@/domain/book';
import { isReadingNominator } from '@/domain/review';
import type { Cycle } from '@/domain/types';
import { useMember } from '@/features/auth/session';
import { useOwnAnswer } from '@/features/club/use-club';
import { Button } from '@/ui/Button';
import { describeError } from '@/ui/describe-error';
import { TextField } from '@/ui/TextField';

import styles from './ReadingLink.module.css';

const INVALID = 'Use um link completo, começando com https://.';

interface EditorProps {
  cycle: Cycle;
  link: string | null;
  onDone: () => void;
}

/** The link field, saved for the whole club; nothing records who changed it. */
function LinkForm({ cycle, link, onDone }: EditorProps) {
  const { club } = useBackend();
  const { user } = useMember();
  const [value, setValue] = useState(link ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (next: string | null) => {
    const clean = next?.trim() ? next.trim() : null;
    if (clean !== null && !isSecureLink(clean)) {
      setError(INVALID);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await club.setReadingLink({ cycleId: cycle.id, uid: user.uid, link: clean });
      onDone();
    } catch (failure) {
      setError(describeError(failure));
      setBusy(false);
    }
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    void save(value);
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <TextField
        label="Link da leitura"
        type="url"
        inputMode="url"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        hint="Uma sinopse, onde ler ou comprar. Ninguém vê quem mudou."
        error={error}
      />
      <div className={styles.actions}>
        <Button type="submit" compact busy={busy}>
          Salvar
        </Button>
        {link && (
          <Button variant="quiet" compact disabled={busy} onClick={() => void save(null)}>
            Remover o link
          </Button>
        )}
        <Button variant="quiet" compact disabled={busy} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/**
 * For the member who nominated the reading (or a reading merged into it)
 * only: a way to add or change its link. Everyone else sees nothing here.
 */
export function ReadingLink({ cycle, link }: { cycle: Cycle; link: string | null }) {
  const { user } = useMember();
  const answer = useOwnAnswer(cycle.id, user.uid);
  const [editing, setEditing] = useState(false);
  if (answer.status !== 'ready' || !isReadingNominator(answer.value, cycle)) return null;

  if (editing) {
    return (
      <LinkForm
        cycle={cycle}
        link={link}
        onDone={() => {
          setEditing(false);
        }}
      />
    );
  }
  return (
    <p className={styles.offer}>
      <button
        type="button"
        className={styles.textButton}
        onClick={() => {
          setEditing(true);
        }}
      >
        {link ? 'Trocar o link' : 'Adicionar um link'}
      </button>{' '}
      <span className={styles.hint}>Só você vê isto, porque indicou esta leitura.</span>
    </p>
  );
}
