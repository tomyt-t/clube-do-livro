import type { AdminPort } from '../backend';

import {
  allowEmails,
  closeRound,
  declareWinner,
  deleteCycle,
  enterTiebreak,
  finishReading,
  openCycle,
  openRound,
  recordResults,
  revokeEmail,
  setDeadline,
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
    openRound: (input) => guard(openRound(db, input)),
    closeRound: (cycleId, round) => guard(closeRound(db, cycleId, round)),
    recordResults: (cycleId, round) => guard(recordResults(db, cycleId, round)),
    enterTiebreak: (cycleId) => guard(enterTiebreak(db, cycleId)),
    declareWinner: (input) => guard(declareWinner(db, input)),
    startReading: (cycleId) => guard(startReading(db, cycleId)),
    finishReading: (cycleId) => guard(finishReading(db, cycleId)),
    watchAllowlist: (subscriber) => listenToQuery(refs.allowlist(db), toAllowlistEntry, subscriber),
    allowEmails: (emails) => guard(allowEmails(db, emails)),
    revokeEmail: (email) => guard(revokeEmail(db, email)),
  };
}
