import type { ReactNode } from 'react';

import { useConfig } from '@/app/services';

import styles from './GateScreen.module.css';

interface GateScreenProps {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}

/** A full-page message shown before the club opens: denied, confirm email, retry. */
export function GateScreen({ title, children, actions }: GateScreenProps) {
  const { clubName } = useConfig();
  return (
    <main className={styles.screen}>
      <p className={styles.club}>{clubName}</p>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.text}>{children}</div>
      <div className={styles.actions}>{actions}</div>
    </main>
  );
}
