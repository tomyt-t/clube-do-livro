import { useState, type SyntheticEvent } from 'react';

import { useBackend } from '@/app/services';
import { isSecureLink } from '@/domain/book';
import { isReadingNominator } from '@/domain/review';
import type { Cycle, SynopsisDisplay, Winner } from '@/domain/types';
import { useMember } from '@/features/auth/session';
import { useOwnAnswer } from '@/features/club/use-club';
import { Button } from '@/ui/Button';
import { describeError } from '@/ui/describe-error';
import { TextField } from '@/ui/TextField';

import { materialsOf } from './materials';
import styles from './ReadingMaterials.module.css';

const INVALID = 'Use um link completo, começando com https://.';

interface Fields {
  link: string;
  display: SynopsisDisplay;
  pdfUrl: string;
}

interface FieldErrors {
  link: string | null;
  pdfUrl: string | null;
}

const NO_ERRORS: FieldErrors = { link: null, pdfUrl: null };

function cleaned(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function linkError(value: string): string | null {
  const clean = cleaned(value);
  return clean !== null && !isSecureLink(clean) ? INVALID : null;
}

function fieldsOf(winner: Winner): Fields {
  const { display, pdfUrl } = materialsOf(winner);
  return { link: winner.book.synopsisUrl ?? '', display, pdfUrl: pdfUrl ?? '' };
}

interface DisplayChoiceProps {
  value: SynopsisDisplay;
  onChange: (value: SynopsisDisplay) => void;
}

/** Only when the reading has a synopsis text: show it, or only its link. */
function DisplayChoice({ value, onChange }: DisplayChoiceProps) {
  const options: [SynopsisDisplay, string][] = [
    ['text', 'O texto da sinopse'],
    ['link', 'Só o link'],
  ];
  return (
    <fieldset className={styles.choice}>
      <legend>Na página da leitura, mostrar</legend>
      {options.map(([option, label]) => (
        <label key={option} className={styles.option}>
          <input
            type="radio"
            name="display"
            checked={value === option}
            onChange={() => {
              onChange(option);
            }}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

interface EditorProps {
  cycle: Cycle;
  winner: Winner;
  onDone: () => void;
}

/** Saved for the whole club in one go; nothing records who changed it. */
function MaterialsForm({ cycle, winner, onDone }: EditorProps) {
  const { club } = useBackend();
  const { user } = useMember();
  const [fields, setFields] = useState(() => fieldsOf(winner));
  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (change: Partial<Fields>) => {
    setFields((current) => ({ ...current, ...change }));
  };

  const save = async () => {
    const found = { link: linkError(fields.link), pdfUrl: linkError(fields.pdfUrl) };
    setErrors(found);
    if (found.link ?? found.pdfUrl) return;
    setBusy(true);
    setFailure(null);
    try {
      const { display } = fields;
      const [link, pdfUrl] = [cleaned(fields.link), cleaned(fields.pdfUrl)];
      await club.setReadingMaterials({ cycleId: cycle.id, uid: user.uid, link, display, pdfUrl });
      onDone();
    } catch (error) {
      setFailure(describeError(error));
      setBusy(false);
    }
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    void save();
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <TextField
        label="Link da leitura"
        type="url"
        inputMode="url"
        value={fields.link}
        onChange={(event) => {
          set({ link: event.target.value });
        }}
        hint="Uma sinopse, onde ler ou comprar. Em branco, sem link."
        error={errors.link}
      />
      {winner.book.synopsis !== null && (
        <DisplayChoice
          value={fields.display}
          onChange={(display) => {
            set({ display });
          }}
        />
      )}
      <TextField
        label="Link do PDF"
        type="url"
        inputMode="url"
        value={fields.pdfUrl}
        onChange={(event) => {
          set({ pdfUrl: event.target.value });
        }}
        hint="Opcional: o PDF no Google Drive ou em outro lugar, aberto a quem tiver o link."
        error={errors.pdfUrl ?? failure}
      />
      <div className={styles.actions}>
        <Button type="submit" compact busy={busy}>
          Salvar
        </Button>
        <Button variant="quiet" compact disabled={busy} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/**
 * For the member who nominated the reading (or a reading merged into it)
 * only: its link, how its synopsis shows and its PDF. Everyone else sees
 * nothing here, and nothing says who changed them.
 */
export function ReadingMaterials({ cycle, winner }: { cycle: Cycle; winner: Winner }) {
  const { user } = useMember();
  const answer = useOwnAnswer(cycle.id, user.uid);
  const [editing, setEditing] = useState(false);
  if (answer.status !== 'ready' || !isReadingNominator(answer.value, cycle)) return null;

  if (editing) {
    return (
      <MaterialsForm
        cycle={cycle}
        winner={winner}
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
        Editar link, sinopse e PDF
      </button>{' '}
      <span className={styles.hint}>Só você vê isto, porque indicou esta leitura.</span>
    </p>
  );
}
