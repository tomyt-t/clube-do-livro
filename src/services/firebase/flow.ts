import type { FlowPort } from '../backend';

import type { FirebaseServices } from './app';
import { guard } from './errors';
import {
  closeVoting,
  declareWinner,
  finishAndOpenNext,
  readResults,
  recordReview,
  startReview,
  startVoting,
} from './flow-writes';

export function createFirebaseFlow({ db }: FirebaseServices): FlowPort {
  return {
    startReview: (cycleId) => guard(startReview(db, cycleId)),
    recordReview: (cycleId, groups) => guard(recordReview(db, cycleId, groups)),
    startVoting: (input) => guard(startVoting(db, input)),
    closeVoting: (cycleId) => guard(closeVoting(db, cycleId)),
    readResults: (cycleId) => guard(readResults(db, cycleId)),
    declareWinner: (input) => guard(declareWinner(db, input)),
    finishAndOpenNext: (input) => guard(finishAndOpenNext(db, input)),
  };
}
