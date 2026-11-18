import { useState } from 'react';

import { useConfig } from '@/app/services';
import clubScene from '@/assets/illustrations/boteco-clube.svg';
import { Button } from '@/ui/Button';
import { describeError } from '@/ui/describe-error';
import { GoogleMark } from '@/ui/icons';
import { Notice } from '@/ui/Notice';

import { EmailLinkForm } from './EmailLinkForm';
import { useSession } from './session';
import styles from './SignInPage.module.css';

function GoogleButton() {
  const { actions } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await actions.signInWithGoogle();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      <Button variant="secondary" block busy={busy} onClick={() => void signIn()}>
        {!busy && <GoogleMark />}
        Entrar com Google
      </Button>
    </>
  );
}

export function SignInPage() {
  const { clubName } = useConfig();

  return (
    <main className={styles.page}>
      <div className={styles.intro}>
        <div className={styles.mast}>
          <span>Sociedade de leitura</span>
          <span>Acesso de membros</span>
        </div>
        <h1 className={styles.title}>{clubName}</h1>
        <p className={styles.lede}>
          Indique leituras, vote em segredo e acompanhe o que o clube está lendo.
        </p>
      </div>
      <img
        className={styles.scene}
        src={clubScene}
        alt="Bichos lendo e discutindo livros em volta das mesas de um boteco"
        width="428"
        height="296"
      />
      <div className={styles.access}>
        <GoogleButton />
        <p className={styles.divider}>ou receba um link</p>
        <EmailLinkForm />
        <p className={styles.fine}>Você continua conectado neste aparelho até sair.</p>
      </div>
    </main>
  );
}
