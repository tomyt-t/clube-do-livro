import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './Notice.module.css';

interface NoticeProps {
  tone?: 'info' | 'error';
  title?: string;
  children: ReactNode;
}

/** An inline message. Errors are announced to screen readers right away. */
export function Notice({ tone = 'info', title, children }: NoticeProps) {
  return (
    <div
      className={cx(styles.notice, tone === 'error' && styles.error)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {title && <p className={styles.title}>{title}</p>}
      <div>{children}</div>
    </div>
  );
}
