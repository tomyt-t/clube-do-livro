import type { ReactNode } from 'react';

import { useConfig } from '@/app/services';
import { Splash } from '@/app/StartupScreens';

import { AccessCheckFailed, AccessDenied, ConfirmLinkEmail } from './GateScreens';
import { useSession } from './session';
import { SignInPage } from './SignInPage';

/** Shows the club only to allowlisted members; everyone else gets the right screen. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const { clubName } = useConfig();

  switch (state.status) {
    case 'loading':
    case 'checking':
      return <Splash clubName={clubName} />;
    case 'signed-out':
      return <SignInPage />;
    case 'needs-email':
      return <ConfirmLinkEmail />;
    case 'denied':
      return <AccessDenied email={state.user.email} taken={state.taken} />;
    case 'error':
      return <AccessCheckFailed />;
    case 'member':
      return children;
  }
}
