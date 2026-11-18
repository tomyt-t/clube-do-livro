import type { AdminPort } from '../backend';

import {
  allowEmails,
  deleteCycle,
  finishReading,
  openCycle,
  revokeEmail,
  setDeadline,
  setMemberCount,
  startReading,
} from './admin-writes';
import type { FirebaseServices } from './app';
import { toAllowlistEntry } from './converters';
import { guard } from './errors';
import { listenToQuery } from './listen';
import { refs } from './refs';

export function createFirebaseAdmin({ db }: FirebaseServices): AdminPort {
  return {
    openCycle: (input) => guard(openCycle(db, input)),
    setDeadline: (cycleId, field, deadline) => guard(setDeadline(db, cycleId, field, deadline)),
    deleteCycle: (cycleId) => guard(deleteCycle(db, cycleId)),
    startReading: (cycleId) => guard(startReading(db, cycleId)),
    finishReading: (cycleId) => guard(finishReading(db, cycleId)),
    watchAllowlist: (subscriber) => listenToQuery(refs.allowlist(db), toAllowlistEntry, subscriber),
    allowEmails: (emails) => guard(allowEmails(db, emails)),
    revokeEmail: (email) => guard(revokeEmail(db, email)),
    setMemberCount: (members) => guard(setMemberCount(db, members)),
  };
}
