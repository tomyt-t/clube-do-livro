import { Navigate } from 'react-router';

import { PATHS } from '@/app/paths';
import { useMember } from '@/features/auth/session';
import { Page } from '@/ui/Page';

import { ConflictsPanel } from './ConflictsPanel';
import { MembersPanel } from './MembersPanel';
import { RoundPanel } from './RoundPanel';

/** The organizer's page: the round's manual controls and who belongs to the club. */
export function AdminPage() {
  const { isAdmin } = useMember();
  if (!isAdmin) return <Navigate to={PATHS.reading} replace />;
  return (
    <Page title="Organizar">
      <RoundPanel />
      <ConflictsPanel />
      <MembersPanel />
    </Page>
  );
}
