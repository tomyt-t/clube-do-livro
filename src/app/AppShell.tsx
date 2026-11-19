import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ClubPhotos } from '@/features/club/ClubPhotos';
import { CLUB_PHOTOS, type ClubPhoto } from '@/features/club/photos';

import styles from './AppShell.module.css';
import { MainNav } from './MainNav';
import { PATHS } from './paths';

interface AppShellProps {
  clubName: string;
  /** Right side of the header, e.g. the account menu. */
  account?: ReactNode;
  /** The club's photos for the footer strip; none, no footer. */
  photos?: readonly ClubPhoto[];
  children: ReactNode;
}

export function AppShell({ clubName, account, photos = CLUB_PHOTOS, children }: AppShellProps) {
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
      {photos.length > 0 && (
        <footer className={styles.footer}>
          <ClubPhotos photos={photos} />
        </footer>
      )}
    </div>
  );
}
