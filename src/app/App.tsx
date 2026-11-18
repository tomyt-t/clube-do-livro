import { HashRouter } from 'react-router';

import { AccountMenu } from '@/features/auth/AccountMenu';
import { DemoBar } from '@/features/auth/DemoBar';
import { SessionGate } from '@/features/auth/SessionGate';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { CycleFlow } from '@/features/club/CycleFlow';

import { AppProviders } from './AppProviders';
import { AppRoutes } from './AppRoutes';
import { AppShell } from './AppShell';
import type { AppServices } from './services';

export function App({ services }: { services: AppServices }) {
  return (
    <AppProviders services={services}>
      <SessionProvider>
        <HashRouter>
          <DemoBar />
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
