import { cx } from './cx';
import styles from './SynopsisText.module.css';

interface SynopsisTextProps {
  text: string;
  id?: string;
  className?: string;
}

/** A synopsis as paragraphs; single line breaks stay as typed. */
export function SynopsisText({ text, id, className }: SynopsisTextProps) {
  return (
    <div id={id} className={cx(styles.synopsis, className)}>
      {text.split(/\n{2,}/).map((paragraph, index) => (
        // Paragraphs never move, so their position is a stable key.
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
