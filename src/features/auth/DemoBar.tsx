import { useState } from 'react';

import { useBackend } from '@/app/services';
import type { Backend } from '@/services/backend';
import { DEMO_SCENARIOS, type DemoBackend, type DemoScenario } from '@/services/demo';

import styles from './DemoBar.module.css';
import { useSession } from './session';

function isDemo(backend: Backend): backend is DemoBackend {
  return backend.kind === 'demo';
}

function ScenarioSwitch({ backend }: { backend: DemoBackend }) {
  const [scenario, setScenario] = useState<DemoScenario>('nominating');
  return (
    <label className={styles.switch}>
      <span className={styles.switchLabel}>Etapa</span>
      <select
        value={scenario}
        onChange={(event) => {
          const next = DEMO_SCENARIOS.find(({ id }) => id === event.target.value);
          if (!next) return;
          setScenario(next.id);
          backend.loadScenario(next.id);
        }}
      >
        {DEMO_SCENARIOS.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Demo only: says the data is fake and lets you try the club as anyone, at any stage. */
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
      <p className={styles.about}>
        <strong>Demonstração.</strong> Os dados voltam ao início quando a página recarrega.
      </p>
      <div className={styles.switches}>
        <ScenarioSwitch backend={backend} />
        <label className={styles.switch}>
          <span className={styles.switchLabel}>Entrar como</span>
          <select value={current} onChange={(event) => switchTo(event.target.value)}>
            <option value="">Ninguém</option>
            {backend.personas.map((persona) => (
              <option key={persona.uid} value={persona.uid}>
                {persona.note ? `${persona.name} (${persona.note})` : persona.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  );
}
