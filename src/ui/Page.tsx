import type { ReactNode } from 'react';

import tableScene from '@/assets/illustrations/boteco-mesa.svg';

import { cx } from './cx';
import styles from './Page.module.css';

interface PageProps {
  /** Every page has one `<h1>`; hide it when the design shows the title another way. */
  title: string;
  hideTitle?: boolean;
  width?: 'content' | 'wide';
  /** The boteco scene behind the title. Decorative: hidden from assistive tech. */
  art?: boolean;
  children: ReactNode;
}

export function Page({
  title,
  hideTitle = false,
  width = 'content',
  art = true,
  children,
}: PageProps) {
  return (
    <div className={cx(styles.page, width === 'wide' && styles.wide)}>
      {art && (
        <img
          className={styles.art}
          src={tableScene}
          alt=""
          aria-hidden="true"
          width="224"
          height="186"
          decoding="async"
        />
      )}
      <h1 className={hideTitle ? 'visually-hidden' : styles.title}>{title}</h1>
      {children}
    </div>
  );
}
