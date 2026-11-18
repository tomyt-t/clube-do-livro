import { collection, doc, type Firestore } from 'firebase/firestore';

import type { CycleId, MemberId, NominationId } from '@/domain/types';

/**
 * Every Firestore location the app touches. The layout mirrors the
 * `match` blocks in `firestore.rules`.
 */
export const refs = {
  allowlist: (db: Firestore) => collection(db, 'allowlist'),
  allowlistEntry: (db: Firestore, email: string) => doc(db, 'allowlist', email),

  members: (db: Firestore) => collection(db, 'members'),
  member: (db: Firestore, uid: MemberId) => doc(db, 'members', uid),

  cycles: (db: Firestore) => collection(db, 'cycles'),
  cycle: (db: Firestore, cycleId: CycleId) => doc(db, 'cycles', cycleId),

  nominations: (db: Firestore, cycleId: CycleId) =>
    collection(db, 'cycles', cycleId, 'nominations'),
  nomination: (db: Firestore, cycleId: CycleId, nominationId: NominationId) =>
    doc(db, 'cycles', cycleId, 'nominations', nominationId),

  answer: (db: Firestore, cycleId: CycleId, uid: MemberId) =>
    doc(db, 'cycles', cycleId, 'answers', uid),

  tally: (db: Firestore, cycleId: CycleId) => doc(db, 'cycles', cycleId, 'tally', 'counts'),
  receipt: (db: Firestore, cycleId: CycleId, uid: MemberId) =>
    doc(db, 'cycles', cycleId, 'receipts', uid),
};
