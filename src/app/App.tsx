import { HashRouter } from 'react-router';

import { AppProviders } from './AppProviders';
import { AppRoutes } from './AppRoutes';
import { AppShell } from './AppShell';
import type { AppServices } from './services';

export function App({ services }: { services: AppServices }) {
  return (
    <AppProviders services={services}>
      <HashRouter>
        <AppShell clubName={services.config.clubName}>
          <AppRoutes />
        </AppShell>
      </HashRouter>
    </AppProviders>
  );
}
