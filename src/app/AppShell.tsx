import type { ReactNode } from 'react';
import { Link } from 'react-router';

import styles from './AppShell.module.css';
import { MainNav } from './MainNav';
import { PATHS } from './paths';

interface AppShellProps {
  clubName: string;
  /** Right side of the header, e.g. the account menu. */
  account?: ReactNode;
  children: ReactNode;
}

export function AppShell({ clubName, account, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.bar}>
          <div className={styles.rule}>
            <Link to={PATHS.reading} className={styles.wordmark}>
              {clubName}
            </Link>
            <MainNav />
            {account && <div className={styles.account}>{account}</div>}
          </div>
        </div>
      </header>
      <main id="conteudo" className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
