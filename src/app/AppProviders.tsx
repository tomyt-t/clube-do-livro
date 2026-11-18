import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

import { AppServicesContext, type AppServices } from './services';

interface AppProvidersProps {
  services: AppServices;
  children: ReactNode;
}

export function AppProviders({ services, children }: AppProvidersProps) {
  return (
    <AppServicesContext value={services}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </AppServicesContext>
  );
}
