import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './Page.module.css';

interface PageProps {
  /** Every page has one `<h1>`; hide it when the design shows the title another way. */
  title: string;
  hideTitle?: boolean;
  width?: 'content' | 'wide';
  children: ReactNode;
}

export function Page({ title, hideTitle = false, width = 'content', children }: PageProps) {
  return (
    <div className={cx(styles.page, width === 'wide' && styles.wide)}>
      <h1 className={hideTitle ? styles.hiddenTitle : styles.title}>{title}</h1>
      {children}
    </div>
  );
}
