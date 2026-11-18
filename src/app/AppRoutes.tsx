import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';

import { ElectionPage } from '@/features/election/ElectionPage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { ReadingPage } from '@/features/reading/ReadingPage';

import { PATHS } from './paths';

const PAGE_TRANSITION = { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const;

export function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={PAGE_TRANSITION}
      >
        <Routes location={location}>
          <Route path={PATHS.reading} element={<ReadingPage />} />
          <Route path={PATHS.election} element={<ElectionPage />} />
          <Route path={PATHS.history} element={<HistoryPage />} />
          <Route path="*" element={<Navigate to={PATHS.reading} replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}
