import type { ReactNode } from 'react';

import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** What to do when there is nothing to show yet. */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <section className={styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
