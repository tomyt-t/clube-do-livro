import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';

import { AppProviders } from '@/app/AppProviders';
import type { AppConfig } from '@/config/env';
import { SessionGate } from '@/features/auth/SessionGate';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { createDemoBackend, type DemoBackend } from '@/services/demo';

export const TEST_CONFIG: AppConfig = {
  mode: 'demo',
  clubName: 'Clube de Teste',
  googleBooksApiKey: null,
};

interface RenderOptions {
  route?: string;
  backend?: DemoBackend;
  config?: AppConfig;
}

/** Renders inside the app's providers and a router (animations are off in tests). */
export function renderWithApp(ui: ReactElement, options: RenderOptions = {}) {
  const backend = options.backend ?? createDemoBackend();
  const config = options.config ?? TEST_CONFIG;
  const user = userEvent.setup();
  const result = render(
    <AppProviders services={{ config, backend }}>
      <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
    </AppProviders>,
  );
  return { ...result, user, backend };
}

/** Like `renderWithApp`, with the session context but no gate. */
export function renderWithSession(ui: ReactElement, options: RenderOptions = {}) {
  return renderWithApp(<SessionProvider>{ui}</SessionProvider>, options);
}

/**
 * Renders behind the session gate, signed in as a demo persona
 * ("marina" organizes the club). Wait with `findBy…` for the content.
 */
export function renderAsMember(ui: ReactElement, uid = 'marina', options: RenderOptions = {}) {
  const backend = options.backend ?? createDemoBackend();
  backend.auth.signInAs(uid);
  return renderWithSession(<SessionGate>{ui}</SessionGate>, { ...options, backend });
}
