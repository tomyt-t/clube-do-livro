import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useId, useRef, useState } from 'react';

import { PATHS } from '@/app/paths';
import { Button, LinkButton } from '@/ui/Button';
import { useDismiss } from '@/ui/use-dismiss';

import styles from './AccountMenu.module.css';
import { monogram } from './monogram';
import { useMember, useSession } from './session';

const PANEL_MOTION = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.16 },
} as const;

export function AccountMenu() {
  const { user, isAdmin } = useMember();
  const { actions } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className={styles.menu}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Conta de ${user.name}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {monogram(user.name)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div id={panelId} className={styles.panel} {...PANEL_MOTION}>
            <p className={styles.name}>{user.name}</p>
            <p className={styles.detail}>{user.email}</p>
            {isAdmin && (
              <LinkButton to={PATHS.admin} variant="secondary" block onClick={close}>
                Organizar o clube
              </LinkButton>
            )}
            <Button variant="secondary" block onClick={() => void actions.signOut()}>
              Sair
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
