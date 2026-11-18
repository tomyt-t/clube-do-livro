import { lazy, Suspense } from 'react';
import { HashRouter } from 'react-router';

import { AccountMenu } from '@/features/auth/AccountMenu';
import { SessionGate } from '@/features/auth/SessionGate';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { CycleFlow } from '@/features/club/CycleFlow';

import { AppProviders } from './AppProviders';
import { AppRoutes } from './AppRoutes';
import { AppShell } from './AppShell';
import type { AppServices } from './services';

import { DEMO_BUILD } from '@/services';

/** Only demo builds include the demo bar (and, through it, the demo's data). */
const DemoBar = DEMO_BUILD
  ? lazy(() => import('@/features/auth/DemoBar').then(({ DemoBar: bar }) => ({ default: bar })))
  : null;

export function App({ services }: { services: AppServices }) {
  return (
    <AppProviders services={services}>
      <SessionProvider>
        <HashRouter>
          {DemoBar && (
            <Suspense fallback={null}>
              <DemoBar />
            </Suspense>
          )}
          <SessionGate>
            <CycleFlow />
            <AppShell clubName={services.config.clubName} account={<AccountMenu />}>
              <AppRoutes />
            </AppShell>
          </SessionGate>
        </HashRouter>
      </SessionProvider>
    </AppProviders>
  );
}
