import { createContext, useContext } from 'react';

import type { AppConfig } from '@/config/env';
import type { Backend } from '@/services/backend';

export interface AppServices {
  config: AppConfig;
  backend: Backend;
}

export const AppServicesContext = createContext<AppServices | null>(null);

function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error('AppServicesContext ausente: use <AppProviders>.');
  return services;
}

export function useBackend(): Backend {
  return useAppServices().backend;
}

export function useConfig(): AppConfig {
  return useAppServices().config;
}
