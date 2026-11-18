import { useId, useState } from 'react';

import { useBackend } from '@/app/services';
import { parseEmails } from '@/domain/email';
import { useMember } from '@/features/auth/session';
import { useSettings } from '@/features/club/use-club';
import type { AllowlistEntry } from '@/services/backend';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { describeError } from '@/ui/describe-error';
import { countOf } from '@/ui/format';
import { Notice } from '@/ui/Notice';
import { Loading } from '@/ui/Spinner';
import { TextArea } from '@/ui/TextField';

import styles from './AdminPage.module.css';
import { useAction, useAllowlist, useMemberCountSync } from './use-admin';

const EMAIL_ORDER = new Intl.Collator('pt-BR');

/** What is wrong with a pasted list, in words; null when it can be added. */
function problemWith(invalid: readonly string[], fresh: readonly string[]): string | null {
  if (invalid.length > 0) return `Estes não parecem emails: ${invalid.join(', ')}.`;
  return fresh.length === 0 ? 'Nenhum email novo para adicionar.' : null;
}

function AddEmails({ listed }: { listed: readonly string[] }) {
  const { admin } = useBackend();
  const action = useAction();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  const submit = async () => {
    const { valid, invalid } = parseEmails(text);
    const fresh = valid.filter((email) => !listed.includes(email));
    const found = problemWith(invalid, fresh);
    setAdded(null);
    setProblem(found);
    if (found) return;
    if (await action.run(() => admin.allowEmails(fresh))) {
      setText('');
      setAdded(fresh.length);
    }
  };

  return (
    <form
      className={styles.add}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <TextArea
        label="Adicionar emails"
        rows={3}
        value={text}
        hint="Cole um ou vários, separados por vírgula, espaço ou um por linha."
        error={problem ?? action.error}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <div className={styles.addActions}>
        <Button type="submit" compact busy={action.busy}>
          Adicionar
        </Button>
        {added !== null && (
          <p className={styles.detail} role="status">
            {countOf(added, 'email adicionado', 'emails adicionados')}.
          </p>
        )}
      </div>
    </form>
  );
}

function MemberRow({
  entry,
  isSelf,
  onRemove,
}: {
  entry: AllowlistEntry;
  isSelf: boolean;
  onRemove: () => void;
}) {
  return (
    <li className={styles.member}>
      <span className={styles.email}>{entry.email}</span>
      {entry.isAdmin && <span className={styles.tag}>organiza</span>}
      {isSelf ? (
        <span className={styles.self}>você</span>
      ) : (
        <Button variant="quiet" compact onClick={onRemove} aria-label={`Remover ${entry.email}`}>
          Remover
        </Button>
      )}
    </li>
  );
}

function RemoveDialog({ email, onDone }: { email: string | null; onDone: () => void }) {
  const { admin } = useBackend();
  const action = useAction();
  return (
    <ConfirmDialog
      open={email !== null}
      title="Remover do clube?"
      confirmLabel="Remover"
      tone="danger"
      busy={action.busy}
      onConfirm={() => {
        if (email) void action.run(() => admin.revokeEmail(email)).then((ok) => ok && onDone());
      }}
      onCancel={onDone}
    >
      <p>
        {email} deixa de entrar no clube. O que essa pessoa já indicou e votou continua contando.
      </p>
      {action.error && <Notice tone="error">{action.error}</Notice>}
    </ConfirmDialog>
  );
}

/** Who may sign in. Only the organizer ever sees these emails. */
export function MembersPanel() {
  const { user } = useMember();
  const allowlist = useAllowlist();
  const settings = useSettings();
  const headingId = useId();
  const [removing, setRemoving] = useState<string | null>(null);

  const entries =
    allowlist.status === 'ready'
      ? [...allowlist.value].sort((a, b) => EMAIL_ORDER.compare(a.email, b.email))
      : [];
  useMemberCountSync(
    allowlist.status === 'ready' ? entries.length : null,
    settings.status === 'ready' ? settings.value.members : null,
  );

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        Membros
      </h2>
      {allowlist.status === 'loading' && <Loading />}
      {allowlist.status === 'error' && (
        <Notice tone="error">{describeError(allowlist.error)}</Notice>
      )}
      {allowlist.status === 'ready' && (
        <>
          <p className={styles.headline}>{countOf(entries.length, 'pessoa', 'pessoas')} no clube</p>
          <p className={styles.detail}>
            Só estes emails entram no site. Indicações, votos e leituras esperam por todos eles.
          </p>
          <ul className={styles.members}>
            {entries.map((entry) => (
              <MemberRow
                key={entry.email}
                entry={entry}
                isSelf={entry.email === user.email.toLowerCase()}
                onRemove={() => {
                  setRemoving(entry.email);
                }}
              />
            ))}
          </ul>
          <AddEmails listed={entries.map((entry) => entry.email)} />
        </>
      )}
      <RemoveDialog
        email={removing}
        onDone={() => {
          setRemoving(null);
        }}
      />
    </section>
  );
}
