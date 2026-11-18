import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import tableScene from '@/assets/illustrations/boteco-mesa.svg';

import { cx } from './cx';
import styles from './Page.module.css';
import { useMediaQuery, WIDE } from './use-media-query';

/** Where `PageSide` content goes on desktop; null where it stays in place. */
const SideSlot = createContext<HTMLElement | null>(null);

interface PageProps {
  /** Every page has one `<h1>`. */
  title: string;
  /**
   * Phones show the page another way (the reading's own title), so there the
   * `<h1>` is kept for screen readers only. Desktop always shows it.
   */
  titleOnPhones?: boolean;
  children: ReactNode;
}

/**
 * Every tab's frame. On phones and tablets, one column: the title, then the
 * content. On desktop, the prototype's grid, the same in every tab: a
 * sidebar with the title, the page's state and actions (`PageSide`) and the
 * boteco scene, and the content beside it.
 */
export function Page({ title, titleOnPhones = true, children }: PageProps) {
  const wide = useMediaQuery(WIDE);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  return (
    <div className={styles.page}>
      <div className={styles.side}>
        <h1 className={cx(styles.title, !titleOnPhones && styles.phoneHidden)}>{title}</h1>
        <div className={styles.slot} ref={setSlot} />
        <img
          className={styles.art}
          src={tableScene}
          alt=""
          aria-hidden="true"
          width="224"
          height="186"
          decoding="async"
        />
      </div>
      <div className={styles.content}>
        <SideSlot.Provider value={wide ? slot : null}>{children}</SideSlot.Provider>
      </div>
    </div>
  );
}

/**
 * Part of a page that belongs in the desktop sidebar, under the title: the
 * page's state and actions. On phones it stays where it is written. Blocks
 * reach the sidebar in the order they first render.
 */
export function PageSide({ children }: { children: ReactNode }) {
  const slot = useContext(SideSlot);
  return slot ? createPortal(<div className={styles.block}>{children}</div>, slot) : children;
}
