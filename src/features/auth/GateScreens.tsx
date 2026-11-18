import { useState, type SyntheticEvent } from 'react';

import { isEmail, normalizeEmail } from '@/domain/email';
import { Button } from '@/ui/Button';
import { describeError } from '@/ui/describe-error';
import { TextField } from '@/ui/TextField';

import { GateScreen } from './GateScreen';
import { useSession } from './session';

export function AccessDenied({ email }: { email: string }) {
  const { actions } = useSession();
  return (
    <GateScreen
      title="Este email não está na lista do clube"
      actions={
        <Button variant="secondary" block onClick={() => void actions.signOut()}>
          Entrar com outra conta
        </Button>
      }
    >
      <p>
        Você entrou como <strong>{email || 'uma conta sem email'}</strong>. Peça para quem organiza
        o clube incluir esse endereço, ou entre com outro.
      </p>
    </GateScreen>
  );
}

/** The sign-in link was opened on a device that does not remember the email. */
export function ConfirmLinkEmail() {
  const { actions } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const address = normalizeEmail(email);
    if (!isEmail(address)) {
      setError('Digite o mesmo email em que você recebeu o link.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await actions.confirmLinkEmail(address);
    } catch (failure) {
      setError(describeError(failure));
      setBusy(false);
    }
  }

  return (
    <GateScreen
      title="Confirme seu email"
      actions={
        <form onSubmit={(event) => void submit(event)} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={error}
          />
          <Button type="submit" block busy={busy}>
            Entrar
          </Button>
        </form>
      }
    >
      <p>Este link foi aberto num aparelho diferente do que pediu. Confirme o email para entrar.</p>
    </GateScreen>
  );
}

export function AccessCheckFailed() {
  const { actions } = useSession();
  return (
    <GateScreen
      title="Não foi possível verificar seu acesso"
      actions={
        <>
          <Button block onClick={actions.retry}>
            Tentar de novo
          </Button>
          <Button variant="quiet" onClick={() => void actions.signOut()}>
            Sair
          </Button>
        </>
      }
    >
      <p>Pode ser a conexão. Confira a internet e tente de novo.</p>
    </GateScreen>
  );
}
