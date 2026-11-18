import { ConfigError } from '@/config/env';
import { Spinner } from '@/ui/Spinner';

import styles from './StartupScreens.module.css';

/** Shown while the backend loads, so the first paint is never blank. */
export function Splash({ clubName }: { clubName: string }) {
  return (
    <div className={styles.screen} role="status" aria-label="Carregando">
      <p className={styles.name}>{clubName}</p>
      <span className={styles.spinner}>
        <Spinner />
      </span>
    </div>
  );
}

/** Explains a broken setup instead of showing a blank page. */
export function StartupError({ error }: { error: unknown }) {
  const missing = error instanceof ConfigError ? error.missing : [];
  return (
    <div className={styles.error} role="alert">
      <h1>O site não conseguiu iniciar</h1>
      {missing.length > 0 ? (
        <>
          <p>Faltam estas variáveis de ambiente (veja o README):</p>
          <ul>
            {missing.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Recarregue a página. Se continuar, avise quem organiza o clube.</p>
      )}
    </div>
  );
}
