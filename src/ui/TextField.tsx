import { useId, type ComponentProps, type ReactNode } from 'react';

import { cx } from './cx';
import styles from './TextField.module.css';

interface FieldText {
  label: string;
  hint?: ReactNode;
  /** Shown below the field and announced to screen readers. */
  error?: string | null;
}

interface ControlProps {
  id: string;
  className: string | undefined;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

/** Label, hint and error around any control, wired for screen readers. */
function Field({
  label,
  hint,
  error,
  control,
}: FieldText & { control: (props: ControlProps) => ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {control({
        id,
        className: styles.input,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Omit<ComponentProps<'input'>, 'id' | 'className'>;

export function TextField({ label, hint, error, ...input }: FieldText & InputProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      control={(props) => <input {...input} {...props} />}
    />
  );
}

type TextAreaProps = Omit<ComponentProps<'textarea'>, 'id' | 'className'>;

export function TextArea({ label, hint, error, ...area }: FieldText & TextAreaProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      control={(props) => (
        <textarea {...area} {...props} className={cx(props.className, styles.area)} />
      )}
    />
  );
}
