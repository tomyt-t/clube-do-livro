import type { AdminPort } from '../backend';

import {
  allowEmails,
  closeVoting,
  declareWinner,
  deleteCycle,
  finishReading,
  openCycle,
  readResults,
  revokeEmail,
  setDeadline,
  startReading,
  startVoting,
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
    startVoting: (input) => guard(startVoting(db, input)),
    closeVoting: (cycleId) => guard(closeVoting(db, cycleId)),
    readResults: (cycleId) => guard(readResults(db, cycleId)),
    declareWinner: (input) => guard(declareWinner(db, input)),
    startReading: (cycleId) => guard(startReading(db, cycleId)),
    finishReading: (cycleId) => guard(finishReading(db, cycleId)),
    watchAllowlist: (subscriber) => listenToQuery(refs.allowlist(db), toAllowlistEntry, subscriber),
    allowEmails: (emails) => guard(allowEmails(db, emails)),
    revokeEmail: (email) => guard(revokeEmail(db, email)),
  };
}
