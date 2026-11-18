import styles from './Button.module.css';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonLook {
  variant: ButtonVariant;
  block?: boolean | undefined;
  /** The 44px button that sits beside a line of text. */
  compact?: boolean | undefined;
  className?: string | undefined;
}

/** Shared by `<Button>` and `<LinkButton>` so links can look like buttons. */
export function buttonClass({
  variant,
  block = false,
  compact = false,
  className,
}: ButtonLook): string {
  return cx(
    styles.button,
    styles[variant],
    block && styles.block,
    compact && styles.compact,
    className,
  );
}
