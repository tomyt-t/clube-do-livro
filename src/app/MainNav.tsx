import { motion } from 'motion/react';
import type { ComponentType, SVGProps } from 'react';
import { NavLink } from 'react-router';

import { BallotIcon, OpenBookIcon, ShelfIcon } from '@/ui/icons';

import styles from './MainNav.module.css';
import { PATHS } from './paths';

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ITEMS: readonly NavItem[] = [
  { to: PATHS.reading, label: 'Lendo', Icon: OpenBookIcon },
  { to: PATHS.election, label: 'Votação', Icon: BallotIcon },
  { to: PATHS.history, label: 'Histórico', Icon: ShelfIcon },
];

const MARKER_SPRING = { type: 'spring', stiffness: 520, damping: 44 } as const;

export function MainNav() {
  return (
    <nav aria-label="Principal" className={styles.nav}>
      <ul className={styles.list}>
        {ITEMS.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink to={to} end className={styles.link}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-marker"
                      className={styles.marker}
                      transition={MARKER_SPRING}
                    />
                  )}
                  <Icon className={styles.icon} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
