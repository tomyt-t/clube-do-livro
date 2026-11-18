import styles from './Button.module.css';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonLook {
  variant: ButtonVariant;
  block?: boolean | undefined;
  className?: string | undefined;
}

/** Shared by `<Button>` and `<LinkButton>` so links can look like buttons. */
export function buttonClass({ variant, block = false, className }: ButtonLook): string {
  return cx(styles.button, styles[variant], block && styles.block, className);
}
