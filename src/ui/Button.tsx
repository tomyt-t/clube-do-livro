import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

import { buttonClass, type ButtonVariant } from './button-class';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Full width of its container. */
  block?: boolean;
  /** The 44px button that sits beside a line of text. */
  compact?: boolean;
  /** Shows a spinner and blocks clicks while an action runs. */
  busy?: boolean;
}

export function Button({
  variant = 'primary',
  block = false,
  compact = false,
  busy = false,
  type = 'button',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClass({ variant, block, compact, className })}
      disabled={disabled === true || busy}
      aria-busy={busy || undefined}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  block?: boolean;
  compact?: boolean;
}

export function LinkButton({
  variant = 'primary',
  block = false,
  compact = false,
  className,
  ...props
}: LinkButtonProps) {
  return <Link {...props} className={buttonClass({ variant, block, compact, className })} />;
}
