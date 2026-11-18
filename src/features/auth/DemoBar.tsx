import { useBackend } from '@/app/services';
import type { Backend } from '@/services/backend';
import type { DemoBackend } from '@/services/demo';

import styles from './DemoBar.module.css';
import { useSession } from './session';

function isDemo(backend: Backend): backend is DemoBackend {
  return backend.kind === 'demo';
}

/** Demo only: says the data is fake and lets you try the club as anyone. */
export function DemoBar() {
  const backend = useBackend();
  const { state } = useSession();
  if (!isDemo(backend)) return null;

  const current = 'user' in state && state.user ? state.user.uid : '';
  const switchTo = (uid: string) => {
    if (uid) backend.auth.signInAs(uid);
    else void backend.auth.signOut();
  };

  return (
    <aside className={styles.bar} aria-label="Demonstração">
      <p>
        <strong>Demonstração.</strong> Os dados voltam ao início quando a página recarrega.
      </p>
      <label className={styles.switch}>
        Entrar como
        <select value={current} onChange={(event) => switchTo(event.target.value)}>
          <option value="">Ninguém</option>
          {backend.personas.map((persona) => (
            <option key={persona.uid} value={persona.uid}>
              {persona.note ? `${persona.name} (${persona.note})` : persona.name}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}
