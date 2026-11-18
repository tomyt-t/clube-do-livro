import { useState, type SyntheticEvent } from 'react';

import { isEmail, normalizeEmail } from '@/domain/email';
import { Button } from '@/ui/Button';
import { describeError } from '@/ui/describe-error';
import { Notice } from '@/ui/Notice';
import { TextField } from '@/ui/TextField';

import { useSession } from './session';

type Step =
  { kind: 'editing'; error: string | null } | { kind: 'sending' } | { kind: 'sent'; email: string };

/** Passwordless sign-in: we email a one-time link to the address. */
export function EmailLinkForm() {
  const { actions } = useSession();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'editing', error: null });

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const address = normalizeEmail(email);
    if (!isEmail(address)) {
      setStep({ kind: 'editing', error: 'Digite um email válido, como nome@exemplo.com.' });
      return;
    }
    setStep({ kind: 'sending' });
    try {
      await actions.sendSignInLink(address);
      setStep({ kind: 'sent', email: address });
    } catch (error) {
      setStep({ kind: 'editing', error: describeError(error) });
    }
  }

  if (step.kind === 'sent') {
    return (
      <div role="status">
        <Notice title="Confira seu email">
          Enviamos um link para <strong>{step.email}</strong>. Abra pelo mesmo aparelho para entrar.
        </Notice>
        <Button variant="quiet" onClick={() => setStep({ kind: 'editing', error: null })}>
          Usar outro email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <TextField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={step.kind === 'editing' ? step.error : null}
      />
      <Button type="submit" block busy={step.kind === 'sending'}>
        Enviar link de acesso
      </Button>
    </form>
  );
}
