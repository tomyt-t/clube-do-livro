import type { AdminPort } from '../backend';

import {
  allowEmails,
  deleteCycle,
  endEmptyRound,
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
import { findNominators, reopenNominations, updateReview } from './review-writes';

export function createFirebaseAdmin({ db }: FirebaseServices): AdminPort {
  return {
    openCycle: (input) => guard(openCycle(db, input)),
    setDeadline: (cycleId, field, deadline) => guard(setDeadline(db, cycleId, field, deadline)),
    deleteCycle: (cycleId) => guard(deleteCycle(db, cycleId)),
    startReading: (cycleId) => guard(startReading(db, cycleId)),
    finishReading: (cycleId) => guard(finishReading(db, cycleId)),
    endEmptyRound: (cycleId) => guard(endEmptyRound(db, cycleId)),
    watchAllowlist: (subscriber) => listenToQuery(refs.allowlist(db), toAllowlistEntry, subscriber),
    findNominators: (cycleId, nominationIds) => guard(findNominators(db, cycleId, nominationIds)),
    updateReview: (input) => guard(updateReview(db, input)),
    reopenNominations: (input) => guard(reopenNominations(db, input)),
    allowEmails: (emails) => guard(allowEmails(db, emails)),
    revokeEmail: (email) => guard(revokeEmail(db, email)),
    setMemberCount: (members) => guard(setMemberCount(db, members)),
  };
}
