import styles from './Spinner.module.css';

export function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

/** A loading message announced to screen readers. */
export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p className={styles.status} role="status">
      <Spinner />
      {label}
    </p>
  );
}
