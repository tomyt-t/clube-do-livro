import { useEffect, useRef, useState } from 'react';

import { splitTitle } from '@/domain/book';
import type { CycleId, MemberId, NominationAnswer } from '@/domain/types';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Notice } from '@/ui/Notice';
import { TextField } from '@/ui/TextField';

import { checkDraft, EMPTY_DRAFT, type Draft } from './draft';
import styles from './NominationForm.module.css';
import { ReviewNomination } from './ReviewNomination';
import { useSendAnswer } from './use-send-answer';

type Stage = 'choose' | 'details' | 'review';

function ChooseAnswer({ onNominate, onPass }: { onNominate: () => void; onPass: () => void }) {
  return (
    <div className={styles.choose}>
      <Button block onClick={onNominate}>
        Indicar uma leitura
      </Button>
      <Button block variant="danger" onClick={onPass}>
        Não quero indicar
      </Button>
      <p className={styles.note}>
        Vale livro, mangá, quadrinho, qualquer leitura. As indicações ficam escondidas até todos
        responderem, e o clube não vê quem indicou (quem organiza só vê se a leitura parecer
        repetida).
      </p>
    </div>
  );
}

interface DetailsFormProps {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onBack: () => void;
  onNext: () => void;
}

function DetailsForm({ draft, onChange, onBack, onNext }: DetailsFormProps) {
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  /** Only typos stop the member: a reading nominated twice is sorted out after the call. */
  const submit = () => {
    const found = checkDraft(draft);
    setError(found);
    if (!found) onNext();
  };

  return (
    <form
      className={styles.details}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        ref={titleRef}
        label="Título"
        value={draft.title}
        maxLength={200}
        autoComplete="off"
        hint="Por exemplo: Torto Arado"
        error={error}
        onChange={(event) => {
          onChange({ ...draft, title: event.target.value });
        }}
      />
      <TextField
        label="Autor (opcional)"
        value={draft.author}
        maxLength={120}
        autoComplete="off"
        hint="Ajuda a achar a capa e a sinopse certas."
        onChange={(event) => {
          onChange({ ...draft, author: event.target.value });
        }}
      />
      <div className={styles.actions}>
        <Button type="submit">Continuar</Button>
        <Button variant="quiet" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </form>
  );
}

interface ConfirmAnswerProps {
  answer: NominationAnswer | null;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmAnswer({ answer, busy, error, onConfirm, onCancel }: ConfirmAnswerProps) {
  const passing = answer?.kind === 'pass';
  const title = answer?.kind === 'nominate' ? splitTitle(answer.book.title).title : '';
  return (
    <ConfirmDialog
      open={answer !== null}
      title={passing ? 'Não indicar nesta rodada?' : 'Enviar esta indicação?'}
      confirmLabel={passing ? 'Não indicar' : 'Enviar indicação'}
      tone={passing ? 'danger' : 'primary'}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        {passing
          ? 'Tem certeza de que não quer indicar nesta rodada? Você ainda vota normalmente.'
          : `“${title}” entra na lista de indicações.`}{' '}
        Depois não dá para mudar.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
    </ConfirmDialog>
  );
}

interface NominationFormProps {
  cycleId: CycleId;
  uid: MemberId;
}

/** Nominate a reading or pass: either answer is final, so both ask first. */
export function NominationForm({ cycleId, uid }: NominationFormProps) {
  const [stage, setStage] = useState<Stage>('choose');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [pending, setPending] = useState<NominationAnswer | null>(null);
  const sending = useSendAnswer(cycleId, uid);

  const ask = (answer: NominationAnswer) => {
    sending.clearError();
    setPending(answer);
  };

  return (
    <>
      {stage === 'choose' && (
        <ChooseAnswer
          onNominate={() => {
            setStage('details');
          }}
          onPass={() => {
            ask({ kind: 'pass' });
          }}
        />
      )}
      {stage === 'details' && (
        <DetailsForm
          draft={draft}
          onChange={setDraft}
          onBack={() => {
            setStage('choose');
          }}
          onNext={() => {
            setStage('review');
          }}
        />
      )}
      {stage === 'review' && (
        <ReviewNomination
          draft={draft}
          onBack={() => {
            setStage('details');
          }}
          onSend={(book) => {
            ask({ kind: 'nominate', book });
          }}
        />
      )}
      <ConfirmAnswer
        answer={pending}
        busy={sending.busy}
        error={sending.error}
        onConfirm={() => {
          if (pending) void sending.send(pending);
        }}
        onCancel={() => {
          setPending(null);
        }}
      />
    </>
  );
}
